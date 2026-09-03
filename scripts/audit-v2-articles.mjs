import { pathToFileURL } from 'node:url';

export const V2_ARTICLE_SLUGS = [
  'claude-code-on-cloudflare-ai-gateway',
  'what-is-the-anthropic-messages-api',
  'cloudflare-ai-gateway-setup',
  'cloudflare-unified-billing',
  'workers-ai-coding-models',
  'mcp-tool-search-cost',
  'tooling-as-data',
  'directory-row-contract',
  'dispatch-four-step-loop',
  'tool-search-vs-catalogue-as-data',
  'mcp-as-a-projection',
  'cloudflare-os',
  'cloudflare-os-d1',
  'cloudflare-os-kv',
  'cloudflare-os-r2',
  'cloudflare-os-functions',
  'cloudflare-os-workers',
  'cloudflare-os-async',
  'cloudflare-os-browser',
  'cloudflare-os-email',
  'cloudflare-os-access',
];

const PEOPLE_TYPES = new Set([
  'people', 'operator', 'github', 'github_issue', 'github_discussion', 'hn', 'reddit',
  'forum', 'community', 'stack_overflow',
]);
const RUNTIME_ERROR = /internal server error|runtime error|workers\.dev.*error|error 1101|application error/i;
const EVIDENCE_LABELS = ['observed', 'derived', 'specified', 'implemented', 'deployed', 'reproduced', 'externally attested'];

function normalizedVisibleText(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:#x[0-9a-f]+|#\d+|[a-z]+);/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function evidenceLabelsForClaims(sources, claims) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const labels = new Set();
  for (const claim of claims) {
    for (const label of String(claim.evidence_status || '').toLowerCase().split(/\s*\+\s*/)) {
      if (EVIDENCE_LABELS.includes(label)) labels.add(label);
    }
    for (const sourceId of claim.source_ids || []) {
      const type = String(sourceById.get(sourceId)?.type || '').toLowerCase();
      if (/first_party_measurement|independent_measurement|runtime_receipt/.test(type)) labels.add('observed');
      if (/publisher_documentation|specification|standard/.test(type)) labels.add('specified');
      if (/repository|source_code/.test(type)) labels.add('implemented');
      if (/deployment/.test(type)) labels.add('deployed');
      if (/benchmark|reproduction/.test(type)) labels.add('reproduced');
      if (PEOPLE_TYPES.has(type)) labels.add('externally attested');
    }
  }
  return EVIDENCE_LABELS.filter((label) => labels.has(label));
}

function tableCount(body) {
  return String(body || '').split('\n').filter((line) =>
    /^\s*\|?\s*:?-{3,}:?\s*\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line),
  ).length;
}

async function fetchStatus(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, { redirect: 'follow' });
    return { ok: response.ok, status: response.status, url: response.url || url };
  } catch (error) {
    return { ok: false, status: 0, url, error: error.message };
  }
}

function graphFailures(sources, claims) {
  const failures = [];
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  for (const source of sources) {
    if (!source.id) failures.push('source without id');
    if (!Array.isArray(source.claim_ids) || !source.claim_ids.length) {
      failures.push(`source ${source.id || '<missing>'} has no claim_ids`);
      continue;
    }
    for (const claimId of source.claim_ids) {
      const claim = claimById.get(claimId);
      if (!claim) failures.push(`source ${source.id} references missing claim ${claimId}`);
      else if (!(claim.source_ids || []).includes(source.id)) {
        failures.push(`source ${source.id} -> ${claimId} lacks reverse claim edge`);
      }
    }
  }
  for (const claim of claims) {
    if (!claim.id) failures.push('claim without id');
    if (!Array.isArray(claim.source_ids) || !claim.source_ids.length) {
      failures.push(`claim ${claim.id || '<missing>'} has no source_ids`);
      continue;
    }
    for (const sourceId of claim.source_ids) {
      const source = sourceById.get(sourceId);
      if (!source) failures.push(`claim ${claim.id} references missing source ${sourceId}`);
      else if (!(source.claim_ids || []).includes(claim.id)) {
        failures.push(`claim ${claim.id} -> ${sourceId} lacks reverse source edge`);
      }
    }
  }
  return failures;
}

export async function auditArticle(slug, {
  baseUrl = 'https://miscsubjects.com',
  fetchImpl = fetch,
} = {}) {
  const failures = [];
  const warnings = [];
  const apiUrl = `${baseUrl}/api/articles/${encodeURIComponent(slug)}`;
  let apiResponse;
  try {
    apiResponse = await fetchImpl(apiUrl, { redirect: 'follow' });
  } catch (error) {
    return { slug, pass: false, failures: [`article API fetch failed: ${error.message}`], metrics: {} };
  }
  if (!apiResponse.ok) {
    return { slug, pass: false, failures: [`article API status ${apiResponse.status}`], metrics: {} };
  }
  const payload = await apiResponse.json();
  const article = payload.article || payload;
  const body = String(article.body || '');
  const sources = Array.isArray(article.sources) ? article.sources : [];
  const claims = Array.isArray(article.claims) ? article.claims : [];
  const widgets = Array.isArray(article.widgets) ? article.widgets : [];
  const peopleSources = sources.filter((source) => PEOPLE_TYPES.has(String(source.type || '').toLowerCase())).length;
  const tables = tableCount(body);
  const labels = evidenceLabelsForClaims(sources, claims);
  const metrics = {
    body_chars: body.length,
    sources: sources.length,
    people_sources: peopleSources,
    claims: claims.length,
    widgets: widgets.length,
    tables,
    evidence_labels: labels,
  };
  if (article.slug !== slug) failures.push(`API slug mismatch: ${article.slug || '<missing>'}`);
  if (!String(article.title || '').trim()) failures.push('title missing');
  if (body.length < 14_000) failures.push(`body_chars ${body.length} < 14000`);
  if (sources.length < 15) failures.push(`sources ${sources.length} < 15`);
  if (peopleSources < 5) failures.push(`people_sources ${peopleSources} < 5`);
  if (claims.length < 13) failures.push(`claims ${claims.length} < 13`);
  if (widgets.length < 6) failures.push(`widgets ${widgets.length} < 6`);
  if (tables < 3) failures.push(`tables ${tables} < 3`);
  if (!/^## Evidence status\s*$/m.test(body)) failures.push('body evidence-status key missing');
  if (!labels.includes('observed')) failures.push('claim evidence status missing: observed');
  if (labels.length < 2) failures.push(`evidence labels ${labels.length} < 2`);
  failures.push(...graphFailures(sources, claims));

  const links = [
    ...(article.hero ? [{ kind: 'hero', url: article.hero }] : []),
    ...sources.filter((source) => source.url).map((source) => ({ kind: `source ${source.id}`, url: source.url })),
  ];
  const linkResults = await Promise.all(links.map(async (link) => ({
    ...link,
    ...(await fetchStatus(fetchImpl, link.url)),
  })));
  for (const link of linkResults) {
    if (link.ok) continue;
    if (link.status === 404 || link.status === 410 || link.status === 0) {
      failures.push(`${link.kind} status ${link.status}: ${link.url}`);
    } else {
      warnings.push(`${link.kind} reachable but not publicly readable now (status ${link.status}): ${link.url}`);
    }
  }

  const renderUrl = `${baseUrl}/a/${encodeURIComponent(slug)}`;
  let render = { url: renderUrl, status: 0, bytes: 0, ok: false };
  try {
    const response = await fetchImpl(renderUrl, { redirect: 'follow' });
    const html = await response.text();
    render = { url: response.url || renderUrl, status: response.status, bytes: html.length, ok: response.ok };
    const renderedText = normalizedVisibleText(html);
    const normalizedTitle = normalizedVisibleText(article.title);
    const titleMatches = normalizedTitle.length > 0 && renderedText.includes(normalizedTitle);
    if (!response.ok) failures.push(`render status ${response.status}`);
    if (response.ok && html.length < 1_000) failures.push(`render bytes ${html.length} < 1000`);
    if (response.ok && !titleMatches) failures.push('render title does not match article API');
    if (RUNTIME_ERROR.test(html) && !titleMatches) failures.push('render contains runtime-error marker');
  } catch (error) {
    failures.push(`render fetch failed: ${error.message}`);
  }

  return {
    slug,
    pass: failures.length === 0,
    api_url: apiUrl,
    render,
    metrics,
    graph: {
      source_ids: sources.length,
      claim_ids: claims.length,
      valid: !failures.some((failure) => /missing (claim|source)|lacks reverse|has no (claim_ids|source_ids)/.test(failure)),
    },
    links: linkResults,
    warnings,
    failures,
  };
}

export async function auditV2Articles(options = {}) {
  const slugs = options.slugs || V2_ARTICLE_SLUGS;
  const articles = [];
  for (const slug of slugs) articles.push(await auditArticle(slug, options));
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    base_url: options.baseUrl || 'https://miscsubjects.com',
    pass: articles.every((article) => article.pass),
    passed: articles.filter((article) => article.pass).length,
    total: articles.length,
    articles,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const slugs = process.argv.slice(2);
  const report = await auditV2Articles({ slugs: slugs.length ? slugs : undefined });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.pass) process.exitCode = 1;
}
