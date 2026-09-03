#!/usr/bin/env node
/**
 * Clear the open objection ledger.
 *
 * 207 model objections had accumulated against the corpus, 128 of them open, with no verdict on
 * any of them. A ledger that records attacks and never resolves them is theatre; the point of
 * recording an attack is that it is answered or the article changes.
 *
 * One model call per objection, batched in parallel through /api/invoke, prompt in the directory
 * (OBJECTION_JUDGE_V1) per MODEL_CALL_LAW. Each verdict is written back through the public answer
 * route, so the resolution is a normal ledgered invocation and shows on the article.
 *
 *   node scripts/adjudicate-objections.mjs            # all open objections
 *   node scripts/adjudicate-objections.mjs 20         # first 20 only
 */

const BASE = 'https://miscsubjects.com';
const KEY = process.env.TERMINAL_KEY;
const BATCH = 12;                 // parallel calls per /api/invoke request
const ARTICLE_CHARS = 9000;       // excerpt handed to the judge

if (!KEY) { console.error('TERMINAL_KEY not in env — source ~/.build-vault.env'); process.exit(1); }

const limit = Number(process.argv[2] || 0);

async function post(path, body) {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-terminal-key': KEY },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return { http: r.status, text: text.slice(0, 400) }; }
}

async function d1(sql) {
  const out = await post('/api/dispatch', { key: 'D1_QUERY', body: sql });
  const r = out.result;
  if (typeof r === 'string') {
    try { return JSON.parse(r); }
    catch { throw new Error('D1_QUERY refused: ' + r.slice(0, 300)); }
  }
  if (!r) throw new Error('dispatch returned no result: ' + JSON.stringify(out).slice(0, 300));
  return r;
}

function parseVerdict(text) {
  const t = String(text || '');
  const grab = (label) => {
    const m = t.match(new RegExp('^' + label + ':\\s*(.+)$', 'im'));
    return m ? m[1].trim() : '';
  };
  const verdict = grab('VERDICT').toUpperCase().split(/\s|\|/)[0] || '';
  return {
    verdict: ['UPHELD', 'REFUSED', 'UNDECIDABLE'].includes(verdict) ? verdict : '',
    ground: grab('GROUND'),
    patch: grab('PATCH'),
    confidence: grab('CONFIDENCE').toUpperCase().startsWith('HIGH') ? 'HIGH' : 'LOW',
    raw: t.slice(0, 1200),
  };
}

const open = await d1(
  "SELECT id, slug, objection, COALESCE(exact_claim,'') claim, COALESCE(attack_type,'') attack, " +
  "COALESCE(actor,'') actor FROM oip_objections WHERE status='open' ORDER BY id ASC" +
  (limit ? ' LIMIT ' + limit : '')
);
console.log('open objections:', open.length);
if (!open.length) process.exit(0);

// One article body per slug, fetched once and reused by every objection against it.
const slugs = [...new Set(open.map((o) => o.slug))];
const bodies = {};
for (const slug of slugs) {
  try {
    const r = await fetch(`${BASE}/api/articles/${encodeURIComponent(slug)}`, { headers: { 'x-terminal-key': KEY } });
    const j = await r.json();
    const a = j.article || j;
    bodies[slug] = String(a.body || a.body_md || '').slice(0, ARTICLE_CHARS);
  } catch { bodies[slug] = ''; }
}
console.log('articles fetched:', slugs.length);

const tally = { UPHELD: 0, REFUSED: 0, UNDECIDABLE: 0, unparsed: 0, failed: 0, written: 0 };

for (let i = 0; i < open.length; i += BATCH) {
  const slice = open.slice(i, i + BATCH);
  const calls = slice.map((o) => ({
    key: 'OBJECTION_JUDGE_V1',
    label: String(o.id),
    max_tokens: 400,
    temperature: 0,
    input:
      `ARTICLE SLUG: ${o.slug}\n` +
      `ARTICLE EXCERPT (may be truncated):\n${bodies[o.slug] || '(body unavailable)'}\n\n` +
      `OBJECTION (from ${o.actor || 'unnamed model'}${o.attack ? ', attack type ' + o.attack : ''}):\n${o.objection}\n` +
      (o.claim ? `\nEXACT CLAIM ATTACKED:\n${o.claim}\n` : ''),
  }));
  const res = await post('/api/invoke', { calls });
  const results = res.results || [];
  console.log(`batch ${i / BATCH + 1}: ${res.ok_count || 0}/${slice.length} answered in ${res.ms}ms`);

  for (const r of results) {
    const o = slice.find((x) => String(x.id) === String(r.label));
    if (!o) continue;
    if (!r.ok) { tally.failed++; continue; }
    let v = parseVerdict(r.text);
    // A model that answered in prose instead of the four lines is not a failed judgment, it is a
    // format miss. One retry on a different model, with the format restated, before giving up.
    if (!v.verdict) {
      const retry = await post('/api/invoke', {
        model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        key: 'OBJECTION_JUDGE_V1',
        temperature: 0,
        max_tokens: 400,
        input: calls.find((c) => c.label === r.label).input +
          '\n\nOutput ONLY the four lines VERDICT, GROUND, PATCH, CONFIDENCE. No other text.',
      });
      const rr = (retry.results || [])[0];
      if (rr && rr.ok) v = parseVerdict(rr.text);
      if (v.verdict) r.model = rr.model;
    }
    if (!v.verdict) { tally.unparsed++; continue; }
    tally[v.verdict]++;

    // UNDECIDABLE stays open: an unanswerable objection is not a settled one. UPHELD and REFUSED
    // are settled with the verdict, the ground, and the minimum patch recorded.
    const status = v.verdict === 'UNDECIDABLE' ? 'open' : 'settled';
    const answer =
      `${v.verdict} — ${v.ground}` +
      (v.patch && v.patch.toUpperCase() !== 'NONE' ? `\n\nMinimum patch: ${v.patch}` : '') +
      `\n\nJudged by ${r.model} under OBJECTION_JUDGE_V1, confidence ${v.confidence}.`;
    if (status === 'open') continue;
    const w = await post(`/api/articles/${encodeURIComponent(o.slug)}/objections/${o.id}/answer`, {
      answer,
      status,
      minimum_patch: v.patch && v.patch.toUpperCase() !== 'NONE' ? v.patch : undefined,
    });
    if (w.ok) tally.written++;
    else console.log('  write failed', o.id, JSON.stringify(w).slice(0, 160));
  }
}

console.log(JSON.stringify(tally, null, 2));
