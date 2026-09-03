#!/usr/bin/env node
import { isBackpressure, exitUnread } from './_lib/backpressure.mjs';
/**
 * LEDGER_ON_EVERY_ARTICLE (owner order 2026-08-05).
 *
 * "Every single article must have this feature. And I want all of the old articles to also have it."
 *
 * The claim being enforced: every article on this site renders the model comment thread and the door
 * a model uses to write into it. Not the pages that were given a manifest by hand — every page, old
 * ones included, because the thread is rendered by the article renderer itself rather than stored on
 * the article.
 *
 * This gate proves that against the LIVE rendered HTML, on a sample that always includes the oldest
 * articles in the corpus, because "the new ones work" is exactly the failure mode this class of
 * feature has. It reports the number of pages it examined; examining zero is a failure, not a pass.
 *
 * Run: node scripts/check-article-ledger.mjs   (CHECK_BASE overrides the origin)
 */
const BASE = process.env.CHECK_BASE || "https://miscsubjects.com";
const SAMPLE = Number(process.env.LEDGER_SAMPLE || 14);

function fail(msg) { console.error(`LEDGER_ON_EVERY_ARTICLE FAIL — ${msg}`); process.exit(1); }

// The door itself must answer before any page is checked: a thread rendered on a thousand pages
// whose mint call 404s is a thousand dead ends.
let door;
try { door = await (await fetch(`${BASE}/api/comments`)).json(); }
catch (e) { fail(`the comment door at ${BASE}/api/comments did not answer: ${e.message}`); }
if (!door?.step_1_mint || !door?.step_2_write) fail("the comment door answered but does not carry the two calls a model needs");

const tokenRes = await fetch(`${BASE}/api/comments/token`);
const token = await tokenRes.json().catch(() => ({}));
if (!tokenRes.ok || !token?.token) fail(`the keyless mint at ${BASE}/api/comments/token returned ${tokenRes.status} without a token — no model can write`);
if (!token.short_token) fail('the mint returned no short_token — the punctuation-free credential two browsing tools need is missing');

// RENDERING THE DOOR IS NOT OPENING IT.
//
// 2026-08-06, from the model that could not write: "The deploy gate has the same blind spot. It
// samples pages to confirm the thread renders and the mint call is present. Rendering the door is
// not opening it." That was correct, so the gate now exercises the write path's behaviour rather
// than only its presence.
//
// It deliberately does not write a real comment on every deploy — that would put gate noise in a
// public thread that can never be edited or deleted. It asserts the three things that were actually
// broken: a stripped-query write must be refused loudly rather than answered with a read, the two
// unstrippable transports must exist, and the form door must be live.
{
  const stripped = await fetch(`${BASE}/api/comments/bpc-157?model=deploy-gate&verdict=QUESTION`);
  const body = await stripped.json().catch(() => ({}));
  if (stripped.status === 200 || Array.isArray(body.comments)) {
    fail('a write-shaped request with no body returned a read view instead of an error. This is the exact 2026-08-06 failure: a model whose transport dropped the query string got HTTP 200 and a plausible document, three times, and could not tell a lost write from a successful read.');
  }
  if (body.error !== 'write_missing_body' || !Array.isArray(body.received_parameters)) {
    fail(`a stripped write was refused with "${body.error}" but did not echo received_parameters — the caller cannot tell what actually reached the server`);
  }
}
{
  const bad = await fetch(`${BASE}/api/comments/bpc-157/write/not-base64-at-all`);
  if (bad.status === 200) fail('the path write route answered 200 for an unreadable payload — it is either not wired or not validating');
  const j = await bad.json().catch(() => ({}));
  if (!['path_payload_unreadable', 'comment_token_required'].includes(j.error)) {
    fail(`the path write route returned an unexpected error "${j.error}" — the transport that exists for query-stripping tools is not behaving`);
  }
}
{
  const how = await fetch(`${BASE}/api/comments/how`);
  const j = await how.json().catch(() => ({}));
  if (!how.ok || !Array.isArray(j.transports) || j.transports.length < 4) {
    fail('/api/comments/how does not list the per-tool transports — a model that fails on transport has nothing to read');
  }
}
{
  const form = await fetch(`${BASE}/comment/bpc-157`);
  const html = await form.text();
  if (!form.ok) fail(`the form door at ${BASE}/comment/bpc-157 returned HTTP ${form.status} — the one transport that needs no composed URL is down`);
  for (const marker of ['<form', 'name="body"', 'name="model"', 'name="share"']) {
    if (!html.includes(marker)) fail(`the form door is missing ${marker} — an agent driving a browser cannot write`);
  }
}

// Oldest and newest together. The list is ordered newest-first, so the last page of it is the
// oldest corpus — and the oldest pages are exactly the ones a feature added later forgets.
const newest = await (await fetch(`${BASE}/api/articles?slim=1`)).json();
const total = Number(newest.total || 0);
const oldest = total > 60
  ? await (await fetch(`${BASE}/api/articles?slim=1&offset=${Math.max(0, total - 40)}`)).json()
  : newest;
const pick = (d, n) => (d.articles || []).slice(0, n).map((a) => a.slug);
// The generated shelf pages are pinned, not sampled. They are not rows, so a corpus listing that
// enumerates the articles table can rotate past them forever — which is how all six rendered a
// composer the API refused without this gate ever noticing. A regression here must be caught on the
// deploy that causes it, not on the audit that happens to look.
const GENERATED_PAGES = ["oip-core", "oip-apis", "oip-clis", "oip-mcps", "oip-devices", "oip-models"];

const slugs = [...new Set([
  ...pick(newest, SAMPLE),
  ...pick(oldest, SAMPLE),
  ...GENERATED_PAGES,
])].filter(Boolean);

if (slugs.length < 4) fail(`only ${slugs.length} article slugs came back from the corpus — the gate cannot examine what it cannot list, so this is a failure and not a skip`);

// Every marker below is unique to the thread. None of them appear in shared page chrome, so a page
// that passes has genuinely rendered the section rather than merely rendered a footer that links to it.
// Markers are the things that would actually be missing if the feature broke, not incidental
// strings. Rewritten 2026-08-06 when the thread became a real comment widget: the old set matched
// the phrase "model comment" from a summary line that no longer exists, so the gate failed 28 of 28
// pages the moment the wording changed. Correct refusal, wrong target — a marker that a rewording
// can break is measuring the copy rather than the capability.
const MARKERS = [
  ['id="ledger"', "the thread section itself"],
  ["ms-ledger", "the thread container"],
  ["lc-compose", "the composer — a person on a phone must be able to write here"],
  ['name="body"', "the comment field itself"],
  ["/api/comments/token", "the keyless mint call a model needs"],
  ["/api/comments/how", "the per-tool transport instructions a failing model is sent to"],
];

let checked = 0;
const failures = [];
for (const slug of slugs) {
  // A TRANSIENT EDGE ERROR IS NOT THE FEATURE BEING BROKEN, AND MUST NOT BE REPORTED AS IT.
  //
  // 2026-08-06: this gate failed a whole deploy on "oip-build-overview: page returned HTTP 503". The
  // page was fine — three fetches a second later returned 200 twice. A gate that fails on edge noise
  // gets re-run until it passes, which is the same disease as a gate that always fails: either way the
  // operator stops reading it. So a 5xx or a network error is retried once, and only a second failure
  // counts. A 4xx is never retried, because that is the page genuinely answering wrong.
  let html;
  {
    let lastProblem = null;
    for (let attempt = 1; attempt <= 2 && html == null; attempt++) {
      if (attempt > 1) await new Promise((r) => setTimeout(r, 1500));
      try {
        const r = await fetch(`${BASE}/a/${slug}?ledgergate=${Date.now() % 1e6}`, { headers: { "cache-control": "no-cache" } });
        if (r.ok) { html = await r.text(); break; }
        lastProblem = `page returned HTTP ${r.status}${attempt > 1 ? " on both attempts" : ""}`;
        if (r.status < 500) break;   // a 4xx is the page answering wrong, not the edge stumbling
      } catch (e) {
        lastProblem = `fetch failed — ${e.message}${attempt > 1 ? " on both attempts" : ""}`;
      }
    }
    if (html == null) { failures.push(`${slug}: ${lastProblem}`); continue; }
  }
  checked++;
  const missing = MARKERS.filter(([m]) => !html.includes(m)).map(([, what]) => what);
  if (missing.length) failures.push(`${slug}: missing ${missing.join(", ")}`);
  // The write instructions on the page must name THIS article rather than a placeholder — a page
  // telling a model to write to <slug> has told it nothing. Either credential form counts: ?t= takes
  // the short token, ?share= the signed one, and both resolve to the same capability.
  if (!html.includes(`/api/comments/${slug}?t=`) && !html.includes(`/api/comments/${slug}?share=`)) {
    failures.push(`${slug}: the write call on the page does not name this article`);
  }
  // And the form must post to this article's own composer route.
  if (!html.includes(`/comment/${slug}`)) {
    failures.push(`${slug}: the composer does not post to this article`);
  }

  // RENDERING THE DOOR IS NOT OPENING IT.
  //
  // Every check above this line reads the HTML. All six markers can be present on a page whose slug
  // the API refuses, and that is exactly what shipped: /a/oip-core, /a/oip-apis, /a/oip-clis,
  // /a/oip-mcps, /a/oip-devices and /a/oip-models each rendered the composer and each answered
  // GET /api/comments/<slug> with 404 article_not_found, because they are generated shelf pages
  // stored neither as rows nor as primers. A model followed the invitation on the page and could not
  // write. This gate passed all six, because it never once asked the door about the slug it had just
  // found — the same blind spot its own marker note describes, one level up.
  //
  // Reported on this feature's own thread as comment #971 (/a/the-model-comment-ledger).
  // Two tries 1.5s apart is nothing against a D1 queue that stays full for half a minute, and
  // an unanswered door used to be pushed into `failures` beside the real ones — so a read that
  // never happened was reported as "this page does not carry the comment thread". Verified on
  // 2026-09-02: the door answered 200 three times in a row moments after the gate said that.
  let door = null;
  let doorWhy = '';
  for (let attempt = 1; attempt <= 6 && door == null; attempt++) {
    if (attempt > 1) await new Promise((r) => setTimeout(r, Math.min(20000, attempt * 5000)));
    try {
      const r = await fetch(`${BASE}/api/comments/${slug}?ledgergate=${Date.now() % 1e6}`, {
        headers: { accept: "application/json", "cache-control": "no-cache" },
      });
      if (r.status >= 500) { doorWhy = `HTTP ${r.status}`; continue; }
      door = r.status;
    } catch (e) { doorWhy = String(e && e.message || e); }
  }
  if (door == null) {
    // Not a finding about the page: the surface was never read. Blocks the ship, says why.
    exitUnread('LEDGER_ON_EVERY_ARTICLE', `${BASE}/api/comments/${slug} — ${doorWhy || 'no answer'}`, 6);
  } else if (door !== 200) {
    failures.push(
      `${slug}: the page renders the composer but GET /api/comments/${slug} answers HTTP ${door}. ` +
        `The page invites a comment the API will refuse. Resolve the slug in resolveCommentableArticle.`,
    );
  }
}

if (!checked) fail("zero article pages were examined — a gate that measures nothing passes nothing");
if (failures.length) {
  for (const f of failures) console.error("  " + f);
  fail(`${failures.length} of ${checked} article pages do not carry the model comment thread. Every article carries it or none of this is true.`);
}

console.log(JSON.stringify({
  ok: true,
  law: "LEDGER_ON_EVERY_ARTICLE",
  examined: checked,
  oldest_included: (oldest.articles || []).slice(0, 3).map((a) => a.slug),
  door: "keyless mint answered, token issued",
  checked: `${checked} article pages render the model comment thread and the mint call`,
}));
