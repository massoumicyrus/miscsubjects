#!/usr/bin/env node
// Seed the peptide article repository: publish stub bodies, queue protocol/write + populate jobs.
// Run: TERMINAL_KEY=... node scripts/seed_peptide_repo.mjs
// Options: --queue-only  skip stub publish  |  --stubs-only  publish stubs, no queue

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'https://miscsubjects.com';
const KEY = process.env.TERMINAL_KEY || '';
const args = new Set(process.argv.slice(2));
const queueOnly = args.has('--queue-only');
const stubsOnly = args.has('--stubs-only');
const useD1 = args.has('--d1') || !KEY;

if (!KEY && !useD1) {
  console.error('Set TERMINAL_KEY or pass --d1 to seed via wrangler d1 execute');
  process.exit(1);
}

const hdr = { 'content-type': 'application/json', 'x-terminal-key': KEY };

const PEPTIDE_DEFS = `PEPTIDE DEFINITIONS (use for mechanism accuracy; no medical claims):
BPC-157 — Body Protection Compound. Derived from gastric juice protein. Builds new blood vessels into damaged tissue locally. 100+ animal/cell studies (tendon, gut, muscle, bone, nerve).
TB-500 — Synthetic Thymosin Beta-4. Moves repair cells to damage; clears stuck inflammation systemically. Production drops ~60% by age 60.
ARA-290 — Nerve repair peptide with human clinical trial data. Regrows damaged nerves; does not mask nerve pain.
Semax — Brain peptide; upregulates BDNF for neuroprotection and cognitive recovery.
Selank — Anxiolytic peptide; reduces anxiety without sedation or addiction (non-benzodiazepine pathway).
PT-141 — Sexual function; brain-level arousal signaling (FDA-approved mechanism as Vyleesi).
DSIP — Delta Sleep Inducing Peptide; natural deep sleep without Ambien-class hangover.
KPV — Gut-specific anti-inflammatory; calms gut lining without systemic immune suppression.
GHK-Cu — Tissue remodeling; builds collagen scaffolding. Production drops 60-80% with age.
Thymosin Alpha-1 — Immune modulation; supports immune function without suppressing it.`;

const PEPTIDE_STUBS = [
  ['bpc-157', 'BPC-157: Body Protection Compound', ['peptide', 'bpc-157']],
  ['tb-500', 'TB-500: Thymosin Beta-4', ['peptide', 'tb-500']],
  ['ara-290', 'ARA-290: Nerve Repair Peptide', ['peptide', 'ara-290']],
  ['semax', 'Semax: BDNF Upregulation', ['peptide', 'semax']],
  ['selank', 'Selank: Non-Sedating Anxiolytic', ['peptide', 'selank']],
  ['pt-141', 'PT-141: Brain-Level Arousal', ['peptide', 'pt-141']],
  ['dsip', 'DSIP: Natural Deep Sleep', ['peptide', 'dsip']],
  ['kpv', 'KPV: Gut-Specific Anti-Inflammatory', ['peptide', 'kpv']],
  ['ghk-cu', 'GHK-Cu: Collagen Scaffolding', ['peptide', 'ghk-cu']],
  ['thymosin-alpha-1', 'Thymosin Alpha-1: Immune Modulation', ['peptide', 'thymosin-alpha-1']],
];

const STUB_BODIES = {
  'bpc-157': `BPC-157 is a piece of a protein your own stomach makes. Your gut produces it already.

Used as a peptide, it does one main thing: it grows new blood vessels into damaged tissue. New blood vessels carry blood. Blood is what rebuilds a wound. That is why it is studied for healing.

It works at the spot where it is placed — local, not all over the body.

Most of what we know is from animal studies. There are over 100 published animal and cell studies across tendon, gut, muscle, bone, and nerve. There is no large human trial yet.

So the honest line is two lines. In rats, it repaired tissue and grew blood vessels into the damage. In people, the benefit is reported by users, not proven in a trial. Those are different strengths of evidence. They should not be blurred together.`,
  'tb-500': `TB-500 is a lab-made copy of Thymosin Beta-4, a repair protein found in nearly every cell in your body.

Its job is movement. It moves repair cells to the site of damage faster, and it clears stuck inflammation so repair can start. It works body-wide, following the damage signal, not just at one spot.

Your own production of this protein drops about 60% by age 60. That is part of why healing slows as you get older.

In wound studies, tissue healed 30 to 50% faster with it. That is animal and lab data.

It does not build muscle like a steroid. It maintains and repairs the tissue you already have.`,
  'ara-290': `ARA-290 is a nerve-repair peptide.

It is the strongest one here on human evidence. It has actual human clinical trial data, not only rat studies. It is studied for regrowing damaged nerve fibers and bringing back feeling.

The difference from a nerve-pain drug matters. A pain drug quiets the alarm coming from a damaged nerve. ARA-290 is studied for repairing the nerve itself, so the alarm has less reason to fire.

Repair, not masking.`,
};

function loadContentMap() {
  return JSON.parse(readFileSync(join(__dir, 'content_map_57.json'), 'utf8'));
}

function loadTopicBodies() {
  const src = readFileSync(join(__dir, 'write-articles.mjs'), 'utf8');
  const m = src.match(/const A = \{([\s\S]*?)\};\s*\nconst slugs/);
  if (!m) return {};
  const bodies = {};
  const re = /'((?:topic-\d{3}|peptide-[\w-]+))': `([\s\S]*?)`/g;
  let hit;
  while ((hit = re.exec(m[1])) !== null) bodies[hit[1]] = hit[2];
  return bodies;
}

function topicKey(i) {
  return 'topic-' + String(i + 1).padStart(3, '0');
}

function writeAsk(item) {
  return [
    PEPTIDE_DEFS,
    '',
    `Write a data-first, evidence-graded article: ${item.title}`,
    '',
    item.spec,
    '',
    'Rules: label every claim tier (human|preclinical|anecdotal|mechanistic|speculative). Separate rat studies from human trials from user reports. No medical claims or treatment promises. Use repair-vs-suppression framing where relevant. register: source_ledger.',
  ].join('\n');
}

async function publishStub(slug, title, body, tags) {
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify({
      slug,
      title,
      body,
      tags: tags || ['peptide'],
      register: 'source_ledger',
      prov: { model: 'seed_peptide_repo', action: 'stub' },
    }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && !j.error, slug, err: j.error || (r.ok ? null : r.status) };
}

async function queueTask(job, source) {
  const r = await fetch(`${BASE}/api/tasks`, {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify({ ...job, role: job.role || source }),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.id, id: j.id, err: j.error };
}

function sqlEsc(s) {
  return String(s || '').replace(/'/g, "''");
}

const d1Stmts = [];

function d1Flush(label) {
  if (!d1Stmts.length) return true;
  const tmp = join(__dir, `.seed_${label}.sql`);
  writeFileSync(tmp, d1Stmts.splice(0, d1Stmts.length).join('\n'));
  try {
    execSync(
      'npx wrangler d1 execute loop-content-spine --remote --file=' + tmp,
      { cwd: join(__dir, '..'), stdio: 'pipe', env: { ...process.env, CLOUDFLARE_API_TOKEN: '' } },
    );
    return true;
  } catch (e) {
    console.error(String(e.stderr || e.stdout || e.message).slice(0, 600));
    return false;
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

function d1PublishStub(slug, title, body, tags) {
  const meta = JSON.stringify({ register: 'source_ledger', tags: tags || ['peptide'], status: 'published' });
  d1Stmts.push(`INSERT OR REPLACE INTO articles (slug, title, subject, published, created_at, updated_at, body, meta) VALUES ('${sqlEsc(slug)}', '${sqlEsc(title)}', '', 1, datetime('now'), datetime('now'), '${sqlEsc(body)}', '${sqlEsc(meta)}');`);
  return true;
}

function d1QueueTask(job, source) {
  const body = JSON.stringify({ ...job, role: job.role || source });
  d1Stmts.push(`INSERT INTO tasks (created_at, status, body, source) VALUES (datetime('now'), 'open', '${sqlEsc(body)}', '${sqlEsc(source)}');`);
  return true;
}

async function main() {
  const map = loadContentMap();
  const topicBodies = loadTopicBodies();
  let stubs = 0;
  let writes = 0;
  let populates = 0;

  if (!queueOnly) {
    console.log('Publishing peptide definition stubs...');
    for (const [slug, title, tags] of PEPTIDE_STUBS) {
      const altBody = topicBodies['peptide-' + slug] || STUB_BODIES[slug] || `## ${title}\n\nEvidence-graded overview. Sources loading via populate loop.`;
      const res = useD1
        ? { ok: d1PublishStub(slug, title, altBody, tags), slug }
        : await publishStub(slug, title, altBody, tags);
      console.log((res.ok ? '  stub OK ' : '  stub FAIL ') + slug + (res.err ? ' ' + res.err : ''));
      if (res.ok) stubs++;
    }

    console.log('Publishing content-map topic stubs...');
    for (let i = 0; i < map.length; i++) {
      const item = map[i];
      const tk = topicKey(i);
      const body = topicBodies[tk];
      if (!body) {
        console.log('  skip stub (no body) ' + item.slug);
        continue;
      }
      const res = useD1
        ? { ok: d1PublishStub(item.slug, item.title, body, ['peptide', 'topic']), slug: item.slug }
        : await publishStub(item.slug, item.title, body, ['peptide', 'topic']);
      console.log((res.ok ? '  stub OK ' : '  stub FAIL ') + item.slug);
      if (res.ok) stubs++;
    }
    if (useD1) d1Flush('stubs');
    console.log(`Stubs published: ${stubs}\n`);
  }

  if (stubsOnly) {
    console.log('Done (--stubs-only).');
    return;
  }

  const ordered = [
    ...map.filter((x) => x.priority),
    ...map.filter((x) => !x.priority),
  ];

  console.log('Queueing protocol/write jobs (priority first)...');
  for (const item of PEPTIDE_STUBS.map(([slug, title]) => ({ slug, title, spec: `General evidence-graded intro for ${title}. Data-first peptide definition article.`, priority: true }))) {
    const writeJob = {
      ask: writeAsk(item),
      slug: item.slug,
      web_search: true,
      register: 'source_ledger',
      model: 'grok/grok-4.3',
      max_tokens: 4000,
      post_to: '/api/protocol/write',
    };
    const res = useD1
      ? { ok: d1QueueTask(writeJob, 'writer') }
      : await queueTask(writeJob, 'writer');
    if (res.ok) writes++;
    console.log((res.ok ? '  write queued' : '  write FAIL ') + ' ' + item.slug);
  }

  for (const item of ordered) {
    const writeJob = {
      ask: writeAsk(item),
      slug: item.slug,
      web_search: true,
      register: 'source_ledger',
      model: 'grok/grok-4.3',
      max_tokens: 4000,
      post_to: '/api/protocol/write',
    };
    const res = useD1
      ? { ok: d1QueueTask(writeJob, 'writer') }
      : await queueTask(writeJob, 'writer');
    if (res.ok) writes++;
    console.log((res.ok ? '  write #' + res.id : '  write FAIL ') + ' ' + item.slug);
  }

  console.log('\nQueueing populate (source-hunt / widget) jobs...');
  const allSlugs = [
    ...PEPTIDE_STUBS.map(([slug]) => slug),
    ...map.map((x) => x.slug),
  ];
  for (const slug of allSlugs) {
    const item = map.find((x) => x.slug === slug);
    const peptide = item ? item.title : slug.replace(/-/g, ' ');
    const popJob = { slug, peptide, max_rounds: 4, post_to: '/api/protocol/populate' };
    const res = useD1
      ? { ok: d1QueueTask(popJob, 'writer-queue') }
      : await queueTask(popJob, 'writer-queue');
    if (res.ok) populates++;
    console.log((res.ok ? '  populate #' + res.id : '  populate FAIL ') + ' ' + slug);
  }

  if (useD1) d1Flush('tasks');
  console.log(`\n=== Queued ${writes} writes + ${populates} populate jobs ===`);
  if (useD1) {
    console.log('D1 seed complete. Enable autorun:');
    console.log('  npx wrangler kv key put writer_queue_autorun 1 --namespace-id 58b303e666a8431685624e0cfd2fd63f --remote');
  } else {
    console.log('Enable autorun: npx wrangler kv key put writer_queue_autorun 1 --namespace-id 58b303e666a8431685624e0cfd2fd63f --remote');
    console.log('Manual tick: curl -X POST ' + BASE + '/api/protocol/run?role=writer-queue -H "x-terminal-key: $TERMINAL_KEY"');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });