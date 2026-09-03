import { pathToFileURL } from 'node:url';

const STATUS_ORDER = ['observed', 'derived', 'specified', 'implemented', 'deployed', 'reproduced', 'externally attested'];
const PEOPLE_TYPES = new Set(['people', 'operator', 'github', 'github_issue', 'github_discussion', 'hn', 'reddit', 'forum', 'community', 'stack_overflow', 'x']);

const FLAGSHIP_MISSING_CLAIMS = [
  {
    id: 'c28',
    text: 'Operators use Claude Code with cheaper or local backends through base-URL and model settings, but these reports establish workable configurations rather than universal quality or savings.',
    section: 'Every other route',
    tier: 'operator',
    source_ids: ['s33', 's34', 's36', 's37'],
    why_material: 'Shows the practice exists while keeping anecdotal operator reports narrower than controlled benchmark evidence.',
    who_claims: 'Opus 5 (Claude Code)',
  },
  {
    id: 'c29',
    text: 'One operator published a working Claude Code configuration against a local llama-server with a 200k context setting; this is one externally attested setup, not a compatibility guarantee for every local runtime.',
    section: 'Every other route',
    tier: 'operator',
    source_ids: ['s34'],
    why_material: 'Narrowly records the local-runtime report without generalizing from one machine.',
    who_claims: 'Opus 5 (Claude Code)',
  },
  {
    id: 'c30',
    text: 'Operator evidence also runs in the other direction: one high-attention report describes moving from Kimi K3 back to Claude Opus 5, so lower price does not prove model substitution is acceptable for every task.',
    section: 'Do the models hold up',
    tier: 'operator',
    source_ids: ['s35'],
    why_material: 'Keeps the article from turning cost evidence into an unsupported universal model recommendation.',
    who_claims: 'Opus 5 (Claude Code)',
  },
];

function evidenceStatus(types) {
  const values = new Set();
  for (const raw of types) {
    const type = String(raw || '').toLowerCase();
    if (/first_party_measurement|independent_measurement|runtime_receipt/.test(type)) values.add('observed');
    if (/publisher_documentation|specification|standard/.test(type)) values.add('specified');
    if (/repository|source_code/.test(type)) values.add('implemented');
    if (/deployment/.test(type)) values.add('deployed');
    if (/benchmark|reproduction/.test(type)) values.add('reproduced');
    if (PEOPLE_TYPES.has(type)) values.add('externally attested');
  }
  return STATUS_ORDER.filter((status) => values.has(status)).join(' + ') || 'specified';
}

export function reconcileEvidenceGraph(article, { claimIdMap = {} } = {}) {
  const sources = structuredClone(article.sources || []);
  const claims = structuredClone(article.claims || []);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const claimById = new Map(claims.map((claim) => [claim.id, claim]));
  const edges = new Set();
  for (const source of sources) {
    for (const rawClaimId of source.claim_ids || []) {
      const claimId = claimById.has(rawClaimId) ? rawClaimId : claimIdMap[rawClaimId];
      if (!claimId || !claimById.has(claimId)) throw new Error(`source ${source.id} references missing claim ${rawClaimId}`);
      edges.add(`${source.id}\u0000${claimId}`);
    }
  }
  for (const claim of claims) {
    for (const sourceId of claim.source_ids || []) {
      if (!sourceById.has(sourceId)) throw new Error(`claim ${claim.id} references missing source ${sourceId}`);
      edges.add(`${sourceId}\u0000${claim.id}`);
    }
  }
  for (const source of sources) {
    source.claim_ids = [...edges]
      .map((edge) => edge.split('\u0000'))
      .filter(([sourceId]) => sourceId === source.id)
      .map(([, claimId]) => claimId)
      .sort();
    if (!source.claim_ids.length) throw new Error(`source ${source.id} has no evidence edge`);
  }
  for (const claim of claims) {
    claim.source_ids = [...edges]
      .map((edge) => edge.split('\u0000'))
      .filter(([, claimId]) => claimId === claim.id)
      .map(([sourceId]) => sourceId)
      .sort();
    if (!claim.source_ids.length) throw new Error(`claim ${claim.id} has no evidence edge`);
    claim.evidence_status = evidenceStatus(claim.source_ids.map((sourceId) => sourceById.get(sourceId)?.type));
  }
  return { ...article, sources, claims };
}

export function addEvidenceKey(body) {
  const text = String(body || '');
  if (/^## Evidence status\s*$/m.test(text)) return text;
  const key = `## Evidence status

**Observed** marks first-party measurements or runtime receipts from the named environment.
**Derived** marks arithmetic calculated from cited inputs. **Specified** marks vendor or standards
documentation. **Implemented** and **deployed** name code and live-state evidence, respectively.
**Reproduced** means the stated procedure was rerun. **Externally attested** marks operator reports;
those reports show that an experience occurred, not that it is universal.

`;
  const heading = text.search(/^##\s+/m);
  if (heading < 0) return `${text.trimEnd()}\n\n${key}`;
  return `${text.slice(0, heading)}${key}${text.slice(heading)}`;
}

function prepareArticle(slug, article) {
  const working = structuredClone(article);
  if (slug === 'claude-code-on-cloudflare-ai-gateway') {
    const ids = new Set((working.claims || []).map((claim) => claim.id));
    for (const claim of FLAGSHIP_MISSING_CLAIMS) if (!ids.has(claim.id)) working.claims.push(claim);
  }
  const repaired = reconcileEvidenceGraph(working);
  return {
    body: addEvidenceKey(repaired.body),
    sources: repaired.sources,
    claims: repaired.claims,
  };
}

async function applyRepair(slug, { baseUrl, terminalKey }) {
  const read = await fetch(`${baseUrl}/api/articles/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (!read.ok) throw new Error(`${slug}: read status ${read.status}`);
  const article = await read.json();
  const patch = prepareArticle(slug, article.article || article);
  const response = await fetch(`${baseUrl}/api/articles/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-terminal-key': terminalKey,
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(`${slug}: patch status ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return {
    slug,
    body_chars: patch.body.length,
    sources: patch.sources.length,
    claims: patch.claims.length,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const args = process.argv.slice(2);
  const apply = args[0] === '--apply';
  const slugs = apply ? args.slice(1) : args;
  if (!apply || !slugs.length) {
    process.stderr.write('Usage: TERMINAL_KEY=... node scripts/repair-v2-article-integrity.mjs --apply <slug...>\n');
    process.exitCode = 2;
  } else if (!process.env.TERMINAL_KEY) {
    process.stderr.write('TERMINAL_KEY is required\n');
    process.exitCode = 2;
  } else {
    const results = [];
    for (const slug of slugs) {
      results.push(await applyRepair(slug, {
        baseUrl: process.env.OIP_BASE_URL || 'https://miscsubjects.com',
        terminalKey: process.env.TERMINAL_KEY,
      }));
    }
    process.stdout.write(`${JSON.stringify({ ok: true, results }, null, 2)}\n`);
  }
}
