import { SOFTWARE_COMPARISON_AXIS_IDS, normalizeSoftwareComparisonAxis } from '../_lib/build_comparison_axes.js';

const AXES = SOFTWARE_COMPARISON_AXIS_IDS;

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}
function parse(value, fallback = {}) { try { return JSON.parse(value || '') || fallback; } catch { return fallback; } }
function cleanSlug(value) { return String(value || '').replace(/^field-/, ''); }

async function readRows(env) {
  const articles = (await env.DB.prepare(
    "SELECT slug,title,subject,updated_at,meta FROM articles WHERE slug LIKE 'field-%' AND published=1 ORDER BY title",
  ).all()).results || [];
  const discourse = (await env.DB.prepare(
    "SELECT id,slug,claimed_model,actor_cap,stance,body,status,filed_at FROM discourse WHERE slug LIKE 'field-%' ORDER BY filed_at DESC",
  ).all()).results || [];
  const tasks = (await env.DB.prepare(
    "SELECT id,status,body,source,created_at,trace FROM tasks WHERE source='landscape-research' ORDER BY id",
  ).all()).results || [];
  const bySlug = new Map();
  for (const row of discourse) {
    if (!bySlug.has(row.slug)) bySlug.set(row.slug, []);
    bySlug.get(row.slug).push(row);
  }
  const taskBySlug = new Map();
  for (const task of tasks) {
    const body = parse(task.body);
    if (body.slug) taskBySlug.set(body.slug, { ...task, body });
  }
  return articles.map(article => {
    const meta = parse(article.meta);
    const target = meta.landscape_target || { id: cleanSlug(article.slug), name: article.title };
    const entries = bySlug.get(article.slug) || [];
    const submissions = entries.map(entry => {
      const payload = parse(entry.body, null);
      return {
        id: entry.id, model: entry.claimed_model || entry.actor_cap || 'unknown', stance: entry.stance,
        status: entry.status, filed_at: entry.filed_at, payload, raw_body: payload ? undefined : entry.body,
        link: 'https://miscsubjects.com/i/discourse/' + entry.id,
      };
    });
    const researchClaims = (Array.isArray(meta.claims) ? meta.claims : []).filter(claim => String(claim.register || '').startsWith('landscape_'));
    const sources = Array.isArray(meta.sources) ? meta.sources : [];
    const outsideAxes = {};
    for (const claim of researchClaims) {
      const axis = normalizeSoftwareComparisonAxis(claim.section);
      if (!AXES.includes(axis)) continue;
      const cell = outsideAxes[axis] || { publisher_claims: [], evidence_findings: [] };
      const view = {
        claim_id: claim.id, text: claim.text, source_ids: claim.source_ids || [],
        sources: (claim.source_ids || []).map(id => sources.find(source => source.id === id)).filter(Boolean),
        actor: claim.posted_by?.actor || claim.who_claims || null,
      };
      if (claim.register === 'landscape_field_claim') cell.publisher_claims.push(view);
      else cell.evidence_findings.push(view);
      outsideAxes[axis] = cell;
    }
    const hasResearch = Object.keys(outsideAxes).length > 0;
    const task = taskBySlug.get(article.slug) || null;
    return {
      slug: article.slug, name: target.name || article.title, repository: target.repository || null,
      cohort: target.cohort || null, github_rank: target.github_rank ?? null,
      article: 'https://miscsubjects.com/a/' + article.slug,
      machine_article: 'https://miscsubjects.com/api/articles/' + article.slug,
      discourse: 'https://miscsubjects.com/api/articles/' + article.slug + '/discourse',
      state: hasResearch ? 'evidence_voxels_present' : task?.status || target.status || 'unresearched',
      accepted_axes: meta.landscape_axes || {}, evidence_axes: outsideAxes,
      claim_voxels: researchClaims.length, source_voxels: sources.length, source_chain_head: meta.source_head || 'genesis',
      submissions: submissions.length, open_challenges: submissions.filter(x => x.status === 'open').length,
      task: task ? { id: task.id, status: task.status, created_at: task.created_at } : null,
    };
  });
}

function nextPacket(record, lane = 'field') {
  if (!record) return null;
  const assignments = {
    field: 'Begin the field-side comparison now. Research the named external target and OPOS on the same axes. Append opened sources as hash-chained source voxels and append separate publisher-claim and evidence-finding claims that cite those source ids.',
    build: 'Begin the build-side proof pass now. Inspect OPOS code, live state, successful receipts, failures, and article graph on the same axes. Append build sources and source-citing claims to the OPOS audit article. Registration without successful use remains registration.',
    opposition: 'Begin the opposition pass now. Read the target and OPOS claims, sources, and standing discourse. Attack unsupported equivalence, uniqueness, absence, reliability, and superiority claims. Append counter-sources, then attach each challenge to the exact current claim hash.',
    synthesis: 'Begin the synthesis pass now. Read the four-column build record, every researched target, and open challenges. Update only conclusions supported by the surviving source-citing claims. Return the direct answer and the public evidence and receipt links.',
  };
  return {
    object: 'One queued landscape-research assignment in the miscsubjects article voxel graph.',
    lane,
    active_assignment: assignments[lane] || assignments.field,
    target: { name: record.name, repository: record.repository, article: record.article },
    common_axes: AXES,
    current_article: record.machine_article,
    current_discourse: record.discourse,
    universal_constitution: 'https://miscsubjects.com/api/articles/constitution?format=markdown',
    primary_source_rule: 'Repository source, official documentation, releases, and reproducible runtime evidence remain separate source classes. Marketing text is a publisher claim. Stars measure adoption, not capability. Missing evidence stays unknown.',
    comparison_subject: 'https://miscsubjects.com/api/build-audit',
    append_endpoint: 'https://miscsubjects.com/api/protocol/voxel-batch',
    append_body: {
      key: '<research capability from the owner drop>', actor: '<model and version>',
      operations: [
        { op: 'source', slug: record.slug, id: 's-<stable-name>', type: 'documentation|repository|paper|other', url: '<opened URL>', title: '<source title>', quote: '<exact short excerpt>', summary: '<what the source establishes>', extra: { evidence_class: 'publisher_documentation|source_code|runtime_receipt|independent_test', observed_at: '<ISO-8601>' } },
        { op: 'claim', slug: record.slug, id: 'fc-<axis>-<short-id>', section: '<one common axis>', register: 'landscape_field_claim', text: '<what the project or publisher says>', tier: 'human', source_ids: ['s-<stable-name>'], who_claims: '<project or publisher>', why_material: '<comparison relevance>' },
        { op: 'claim', slug: record.slug, id: 'fe-<axis>-<short-id>', section: '<same common axis>', register: 'landscape_field_evidence', text: '<what opened evidence establishes, without expanding beyond it>', tier: 'human', source_ids: ['s-<stable-name>'], who_claims: '<research model and version>', why_material: '<comparison relevance>' },
      ],
    },
    opposing_lane: {
      read_claims: record.machine_article + '/claims', read_discourse: record.discourse,
      append: 'https://miscsubjects.com/api/protocol/voxel-challenge',
      effect: 'Challenges and support attach to exact claim hashes and remain public beside the source-backed claims.',
    },
    effect: 'Source operations fetch-check and hash-chain source voxels. Claim operations cite source IDs. Every operation returns a receipt and enters article provenance. Uncited prose does not populate the comparison table. A missing controlled outcome benchmark leaves outcome superiority unknown; it never ends material identification or capability comparison.',
    completion: 'The comparison answer plus public article, source, claim, discourse, and ledger receipt URLs. Asking the owner what to do with this object is a failed arrival.',
  };
}

function markdown(payload) {
  const lines = ['# Build landscape board', '', `Observed: ${payload.generated_at}`, '', `Population: ${payload.population.definition}`, '', `Targets: ${payload.summary.targets} · researched: ${payload.summary.with_outside_research} · queued: ${payload.summary.queued}`, '', '| Target | Repository | State | Outside findings | Article |', '|---|---|---:|---:|---|'];
  for (const row of payload.table) lines.push(`| ${row.name} | ${row.repository || 'unknown'} | ${row.state} | ${row.submissions} | ${row.article} |`);
  lines.push('', 'Machine table:', '', 'https://miscsubjects.com/api/build-landscape', '', 'Next queued research object:', '', 'https://miscsubjects.com/api/build-landscape?next=1');
  return lines.join('\n');
}

export async function onRequestGet(context) {
  const table = await readRows(context.env);
  const payload = {
    schema: 'miscsubjects-build-landscape/1.0', generated_at: new Date().toISOString(),
    population: {
      definition: 'Named direct neighbors plus reproducible GitHub cohorts. A GitHub cohort is valid only with the exact query, sort, capture time, and returned repository list stored in the graph.',
      current_cohorts: ['direct-neighbor'],
      planned_cohort: { name: 'github-top-100-llm-agent', state: 'not_captured', boundary: 'No top-100 claim exists until an exact GitHub query and snapshot are stored.' },
    },
    axes: AXES,
    summary: {
      targets: table.length,
      with_outside_research: table.filter(row => row.claim_voxels > 0).length,
      queued: table.filter(row => row.claim_voxels === 0).length,
    },
    table,
    graph: {
      truth_store: 'articles, claim voxels, source edges, discourse, and article lineage',
      work_queue: 'tasks rows with source=landscape-research',
      root_article: 'https://miscsubjects.com/a/opos-formal-audit',
      contribution_endpoint: 'https://miscsubjects.com/api/protocol/voxel-challenge',
    },
  };
  const url = new URL(context.request.url);
  if (url.searchParams.get('next') === '1') {
    const lane = ['field','build','opposition','synthesis'].includes(url.searchParams.get('lane')) ? url.searchParams.get('lane') : 'field';
    let next = table.find(row => row.task?.status === 'open') || table.find(row => row.claim_voxels === 0) || table[0];
    if (lane === 'opposition') next = table.find(row => row.claim_voxels > 0) || next;
    if (lane === 'build' || lane === 'synthesis') next = {
      slug: 'opos-formal-audit', name: 'OPOS / miscsubjects build', repository: 'https://github.com/[OWNER_HANDLE]/miscsubjects-pages',
      article: 'https://miscsubjects.com/a/opos-formal-audit', machine_article: 'https://miscsubjects.com/api/articles/opos-formal-audit',
      discourse: 'https://miscsubjects.com/api/articles/opos-formal-audit/discourse',
    };
    return json({ ...nextPacket(next, lane), queue_empty: !next });
  }
  if (['markdown', 'md'].includes(String(url.searchParams.get('format') || '').toLowerCase())) {
    return new Response(markdown(payload), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
  }
  return json(payload);
}

export async function onRequestPost(context) {
  if (!(await isBuildAuthed(context.request, context.env))) return json({ error: 'owner access required' }, 401);
  const body = await context.request.json().catch(() => ({}));
  if (body.action !== 'queue_targets' || !Array.isArray(body.targets)) return json({ error: 'action queue_targets and targets[] required' }, 400);
  const cohort = String(body.cohort || 'owner-defined').slice(0, 100);
  const capturedAt = String(body.captured_at || new Date().toISOString());
  const selection = {
    cohort, query: String(body.query || ''), sort: String(body.sort || ''), captured_at: capturedAt,
    source_url: String(body.source_url || ''), target_count: Math.min(500, body.targets.length),
  };
  let queued = 0;
  for (const raw of body.targets.slice(0, 500)) {
    const id = String(raw.id || raw.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    if (!id) continue;
    const slug = 'field-' + id;
    const name = String(raw.name || id).slice(0, 200);
    const repository = String(raw.repository || raw.url || '').slice(0, 1000);
    const meta = JSON.stringify({ tags: ['field-comparison'], register: 'audit', status: 'published', landscape_target: { id, name, repository, cohort, github_rank: raw.rank ?? null, status: 'queued', selection }, claims: [], sources: [] });
    await context.env.DB.prepare("INSERT INTO articles (slug,title,subject,published,created_at,updated_at,body,meta) VALUES (?,?, 'Field comparison target',1,datetime('now'),datetime('now'),?,?) ON CONFLICT(slug) DO NOTHING")
      .bind(slug, name, '# ' + name + ' — comparison record\n\nClaims and evidence for the common build-landscape axes live in this article graph.', meta).run();
    const exists = await context.env.DB.prepare("SELECT id FROM tasks WHERE source='landscape-research' AND json_extract(body,'$.slug')=? AND status IN ('open','running','done') LIMIT 1").bind(slug).first();
    if (!exists) {
      await context.env.DB.prepare("INSERT INTO tasks (created_at,status,body,source,trace_id) VALUES (datetime('now'),'open',?,'landscape-research',?)")
        .bind(JSON.stringify({ kind: 'landscape-research', lane: 'field', slug, target: name, article: 'https://miscsubjects.com/a/' + slug, selection }), 'landscape_' + id).run();
      queued++;
    }
  }
  const cohortSlug = 'landscape-cohort-' + cohort.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
  await context.env.DB.prepare("INSERT INTO articles (slug,title,subject,published,created_at,updated_at,body,meta) VALUES (?,?,'Comparison population',1,datetime('now'),datetime('now'),?,?) ON CONFLICT(slug) DO UPDATE SET body=excluded.body,meta=excluded.meta,updated_at=datetime('now')")
    .bind(cohortSlug, cohort + ' comparison cohort', '# ' + cohort + '\n\nQuery: ' + selection.query + '\n\nSort: ' + selection.sort + '\n\nCaptured: ' + capturedAt + '\n\nSource: ' + selection.source_url, JSON.stringify({ register: 'audit', status: 'published', landscape_cohort: selection, targets: body.targets.slice(0, 500) })).run();
  await logEvent(context.env, { source: 'build-landscape', key: 'LANDSCAPE_QUEUE', action: 'queue_targets', direction: 'in', status: 200, request: selection, response: { queued, cohort_article: cohortSlug } });
  return json({ ok: true, queued, cohort_article: 'https://miscsubjects.com/a/' + cohortSlug, next: 'https://miscsubjects.com/api/build-landscape?next=1' });
}
import { isBuildAuthed } from '../_lib/admin_session.js';
import { logEvent } from '../_lib/event_log.js';
