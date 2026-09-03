#!/usr/bin/env node
// SITE RESOLUTION LAW (2026-08-05). A paid lookup is bought at most once per lead, and a website is
// written onto a lead only when the looked-up business is verifiably the same business.
//
// Built from the exact failure. On 2026-08-05 leadsResolveSitesPlaces was measured live and had three
// defects at once, all of which this gate would have caught:
//
//   1. It selected `(website IS NULL OR website='') AND status='new' ORDER BY id LIMIT n` and wrote
//      nothing on a miss. So every call re-bought the identical head of the queue — five nail salons
//      from an early import — at $0.04 per row, and no chiropractor was ever reachable by it. The lane
//      had never advanced a single row past the first page in its whole life.
//   2. It looked practices up by `name + ' ' + city` on Text Search. NPPES names are ALL-CAPS legal
//      entities, so `5150FITNESS Los Angeles` came back as CrossFit 5150 in a different city, and the
//      code wrote that stranger's website onto the lead for the crawler to harvest.
//   3. Nothing compared the returned name to the registry name. Measured over 60 real chiropractic
//      rows, 59% of phone matches answered for a different business than the record named.
//
// Enforcement, in the invariants below: every outcome path stamps the lead, the query excludes stamped
// leads, the lookup joins on phone rather than name, and a website write is guarded by name agreement.
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const failures = [];
const src = readFileSync(ROOT + '/functions/_lib/fn_runners.js', 'utf8');

// Measure the function body, not the file. A needle satisfiable by the comment block above — or by any
// other resolver in this 5,000-line file — would test nothing.
const start = src.indexOf('async leadsResolveSitesPlaces(');
if (start === -1) {
  failures.push('fn_runners.js: leadsResolveSitesPlaces is gone — site resolution has no implementation to measure');
} else {
  const next = src.indexOf('\n  async ', start + 10);
  const body = src.slice(start, next === -1 ? src.length : next);
  // Strip line comments, but never the `//` inside a URL — an earlier draft of this gate used a bare
  // /\/\/[^\n]*/ and silently deleted `https://maps.googleapis.com/...?inputtype=phonenumber`, then
  // failed the very invariant that code satisfied. Require the slashes not to follow a colon.
  const stripped = body.replace(/(^|[^:])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

  // 1. The queue must advance: attempts are stamped, and stamped leads are excluded from selection.
  if (!/resolve:/.test(stripped)) {
    failures.push('leadsResolveSitesPlaces no longer stamps an outcome onto the lead — every call will re-buy the same rows forever');
  }
  for (const outcome of ['no_place', 'name_mismatch', 'no_website']) {
    if (!new RegExp("'" + outcome + "'").test(stripped)) {
      failures.push(`leadsResolveSitesPlaces has no ${outcome} outcome stamp — that miss path will be re-bought on every call`);
    }
  }
  if (!/notes NOT LIKE '%resolve:%'/.test(stripped)) {
    failures.push("leadsResolveSitesPlaces selection no longer excludes already-attempted leads (notes NOT LIKE '%resolve:%') — the queue cannot advance");
  }

  // 1b. Claim and select must be ONE atomic statement. Selecting first and stamping after is the same
  //     re-buying defect wearing a concurrency costume: measured 2026-08-05, six parallel workers read
  //     the same unstamped queue head and $13.79 bought 9 websites at $1.53 instead of $0.19 each.
  if (!/UPDATE leads SET notes[\s\S]*?RETURNING id/.test(stripped)) {
    failures.push('leadsResolveSitesPlaces no longer claims leads with a single UPDATE ... RETURNING — parallel callers will re-buy the same lookups');
  }
  if (/SELECT id, name, city, phone FROM leads WHERE/.test(stripped)) {
    failures.push('leadsResolveSitesPlaces reintroduced a bare SELECT of the queue head — claiming must be atomic with selection');
  }
  if (!/'resolve:claimed'/.test(stripped)) {
    failures.push("leadsResolveSitesPlaces has no resolve:claimed in-flight mark — a lead being worked on is invisible to other callers");
  }
  // The claim must resolve into the outcome, not accumulate a second mark beside it, or a lead reads as
  // two outcomes at once and the per-lead counts a report is built from stop being countable.
  if (!/replace\(notes, 'resolve:claimed'/.test(stripped)) {
    failures.push('leadsResolveSitesPlaces does not replace the claim mark with the outcome — leads would carry multiple resolve: marks and per-lead counts become unreliable');
  }

  // 2. The lookup must join on phone, which identifies a practice. Name+city does not.
  if (!/inputtype=phonenumber/.test(stripped)) {
    failures.push('leadsResolveSitesPlaces no longer looks the practice up by phone number — name+city resolves ALL-CAPS registry names to unrelated businesses');
  }
  if (/textQuery:\s*l\.name/.test(stripped)) {
    failures.push('leadsResolveSitesPlaces reintroduced the name+city textQuery that returned confident wrong businesses');
  }

  // 3. A website may only be written when the two names agree.
  const write = stripped.match(/UPDATE leads SET website[^\n]*/);
  if (!write) {
    failures.push('leadsResolveSitesPlaces: could not find the website write to check it is guarded');
  } else if (!/agrees\(/.test(stripped)) {
    failures.push('leadsResolveSitesPlaces writes a website with no name-agreement guard — outreach could be addressed to a business we only guessed at');
  } else {
    // The guard must sit before the write and must skip on failure, not merely be computed.
    const guardAt = stripped.indexOf('agrees(');
    const writeAt = stripped.indexOf('UPDATE leads SET website');
    if (guardAt > writeAt) failures.push('leadsResolveSitesPlaces computes name agreement only AFTER writing the website — the guard is decorative');
    if (!/if \(!agrees\([^)]*\)\)[^\n]*continue/.test(stripped)) {
      failures.push('leadsResolveSitesPlaces does not skip the lead when the names disagree — the guard does not gate anything');
    }
  }

  // The cost basis must name the SKU actually billed, so a report cannot quote the wrong unit price.
  if (/Text Search Enterprise/.test(stripped)) {
    failures.push('leadsResolveSitesPlaces still reports the Text Search Enterprise cost basis while calling Find Place — the reported cost would be wrong by 2.4x');
  }
  if (!/PLACES_FINDPLACE_USD/.test(stripped)) {
    failures.push('leadsResolveSitesPlaces no longer meters against PLACES_FINDPLACE_USD — spend on this lane would be misreported');
  }
}

if (!/const PLACES_FINDPLACE_USD\s*=\s*0\.017/.test(src)) {
  failures.push('PLACES_FINDPLACE_USD is not 0.017 — the Find Place / Place Details Basic Data SKU bills $17.00/1,000 requests');
}

if (failures.length) {
  console.error('check-site-resolution: FAIL');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('check-site-resolution: ok — 17 invariants measured on the leadsResolveSitesPlaces body');
