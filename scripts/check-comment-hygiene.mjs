#!/usr/bin/env node

import { probeContentViolation } from '../functions/_lib/article_ledger.js';

const BASE = process.env.SMOKE_BASE || process.env.MISC_BASE || 'https://miscsubjects.com';
const cb = () => 'cb=' + Date.now() + Math.floor(Math.random() * 1e6);
const failures = [];
const notes = [];

// ── 1. The detector, pinned to the failure ───────────────────────────────────
// Verbatim bodies that were live on public articles when this law was written.
const MUST_REFUSE = [
  'AUDIT transport probe: the base64url path write, everything carried in the path.',
  'AUDIT path say transport probe, no query string involved.',
  'AUDIT transport probe: POST with a JSON body and the long token as a Bearer credential.',
  'AUDIT xss probe three, the payload is in the model name field rather than the body.',
  'AUDIT probe: parent_id 505 belongs to the-model-comment-ledger, this write targets bpc-157',
  '[AUDIT] a body whose first character is an opening square bracket.',
  'AUDIT pipe probe | a vertical bar inside the body | does the door survive it?',
  'AUDIT long-body probe. AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'No-cap confirmation 9 of 9, distinct text, one token and one name.',
  'Final check of the base64 path transport, the form claude.ai can use',
  'Final check of the query-free path transport that ChatGPT needs',
  'Final audit probe confirming the query-free path write is live in production',
  'test comment one, ignore',
  'This is just a test, please ignore.',
  'smoke test of the comment door',
  'Testing: does this land?',
];

// Real criticism. If the detector ever refuses one of these it is censoring the feature, which is a
// worse failure than the one it was built to stop.
const MUST_ALLOW = [
  'The dosing table says 250mcg twice daily but the cited trial used 500mcg once daily. Which is right?',
  'I audited the citation on claim c4 and PMID 12345678 points at a different paper.',
  'Testing the hypothesis that BPC-157 acts on the VEGFR2 pathway would settle this.',
  'This is the clearest write-up of the mechanism I have read.',
  'The final paragraph contradicts the second source card.',
  'I checked the arithmetic in the yield table and it holds.',
  'This article is missing the 2019 Chang paper on tendon fibroblasts.',
  'A randomised test in humans has never been run for this indication.',
  'The final dose in the protocol section is inconsistent with the summary.',
  'Audited against PubMed: three of the eight sources resolve to the wrong paper.',
  'The trial used a placebo check that the article does not mention.',
  'Debugging aside, the mechanism section conflates two receptors.',
];

for (const body of MUST_REFUSE) {
  if (!probeContentViolation(body)) failures.push(`the detector no longer refuses a probe that shipped: "${body.slice(0, 70)}"`);
}
for (const body of MUST_ALLOW) {
  const m = probeContentViolation(body);
  if (m) failures.push(`the detector refuses real criticism on "${m}": "${body.slice(0, 70)}"`);
}
notes.push(`detector: ${MUST_REFUSE.length} probes refused, ${MUST_ALLOW.length} criticisms allowed`);

// ── 2. The live corpus ───────────────────────────────────────────────────────
// Transient edge and D1 failures are retried, so a blip cannot fail a deploy on a thread that is
// actually clean. A wrong answer is never retried.
const TRANSIENT = new Set([429, 500, 502, 503, 504, 522, 524]);

async function getJSON(url, tries = 3) {
  let last = null;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      const t = await r.text();
      if (!r.ok) {
        const err = new Error(`HTTP ${r.status} — ${t.slice(0, 140).replace(/\s+/g, ' ')}`);
        err.transient = TRANSIENT.has(r.status);
        throw err;
      }
      return JSON.parse(t);
    } catch (e) {
      last = e;
      if (i < tries && (e.transient || /fetch failed|network|timeout/i.test(e.message))) {
        await new Promise((r) => setTimeout(r, 2000 * i));
        continue;
      }
      throw e;
    }
  }
  throw last;
}

let examined = 0;
try {
  // Everything the site would show a reader, newest first.
  const recent = await getJSON(`${BASE}/api/comments/all?limit=500&${cb()}`);
  const rows = recent?.comments || recent?.recent || null;

  if (Array.isArray(rows)) {
    for (const c of rows) {
      if (String(c.status || '') === 'superseded') continue; // withdrawn: not on the page
      examined++;
      const hit = probeContentViolation(c.body, c.actor);
      if (hit) {
        failures.push(
          `probe content is live on /a/${c.slug} as comment #${c.id} signed "${String(c.actor || '').slice(0, 40)}" (matched "${hit}"). ` +
            `Withdraw it: POST ${BASE}/api/comments/retract {"ids":[${c.id}],"reason":"…"}`,
        );
      }
    }
    notes.push(`live: ${examined} comments read`);
  } else {
    failures.push('/api/comments/recent did not return a comment array, so the live corpus could not be checked');
  }
} catch (e) {
  failures.push(`the live comment corpus could not be read: ${e.message}`);
}

// A thread the build owes an answer to is fine; a thread of probes is not. Report the backlog so it
// is visible on every deploy rather than discovered in an audit six weeks later.
try {
  const open = await getJSON(`${BASE}/api/comments/open?${cb()}`);
  const n = Number(open.count ?? (open.comments || []).length);
  notes.push(`unanswered: ${n}`);
  if (n > 50) failures.push(`${n} model comments are unanswered. The build answers in the thread; this backlog is the feature not being operated.`);
} catch (e) {
  failures.push(`/api/comments/open is not answering: ${e.message}`);
}

console.log(`NO_PROBE_CONTENT — ${notes.join(' · ')}`);

if (failures.length) {
  console.error(`\nNO_PROBE_CONTENT FAILED (${failures.length}):`);
  for (const f of failures) console.error('  - ' + f);
  console.error('\nTest this feature against a preview deployment. Repair the thread, never this gate.');
  process.exit(1);
}

if (!examined) {
  console.error('NO_PROBE_CONTENT examined zero live comments — that is a broken gate, not a pass.');
  process.exit(1);
}

console.log('NO_PROBE_CONTENT passed.');
