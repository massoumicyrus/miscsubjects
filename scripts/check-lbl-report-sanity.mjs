#!/usr/bin/env node
// PLAUSIBILITY_REVIEW_LAW — proves the common-sense review still catches the class of nonsense
// it was built for, and that the report path still refuses to send on a headline failure.
//
// Owner order 2026-08-07: a monthly report went out claiming Meta brought 38 buyers and 0 new
// customers for three months running, while Triple Whale reported 106 Facebook purchases and a
// $120.23 cost per new customer for the same month. The arithmetic was correct; the answer was
// absurd; nothing in the path was capable of noticing. His instruction was to build the
// structural logic that gates it, so this gate exists to keep that logic honest.
//
// These are fixtures, not live data: the gate must fail when the CHECKS rot, not when an API is
// down. A gate coupled to a third party is a gate that gets ignored.

import { reviewReport, reviewTrend } from '../functions/_lib/lbl_report_sanity.js';

let failed = 0;
const check = (name, cond, detail) => {
  if (cond) return;
  failed++;
  console.error(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
};

// 1. THE ORIGINAL DEFECT. A segment with real size showing zero new customers inside a business
//    that is visibly acquiring them must be caught and must suppress the figure.
{
  const r = reviewReport({
    revenue_cents: 29194400, orders: 761, aov_cents: 38363, buyers: 505,
    new_customers: 110, returning_customers: 395,
    spend_cents: 1358600, meta_attributed_cents: 3864247, meta_roas: 2.84,
    meta_orders: 61, meta_customers: 38, meta_new: 0, meta_existing: 38,
  }, {});
  check('segment_zero_against_population fires', r.failures.some((f) => f.check === 'segment_zero_against_population'));
  check('the withheld figure is meta_new', r.suppress.has('meta_new'));
}

// 2. The same shape must NOT fire when the business genuinely has almost no new customers —
//    the check compares a segment against its population, it does not simply hate zeros.
{
  const r = reviewReport({
    buyers: 500, new_customers: 4, returning_customers: 496,
    meta_customers: 40, meta_new: 0, meta_existing: 40,
  }, {});
  check('no false positive when the population is also ~0% new',
    !r.failures.some((f) => f.check === 'segment_zero_against_population'));
}

// 3. Nor on a segment too small to mean anything.
{
  const r = reviewReport({
    buyers: 500, new_customers: 100, returning_customers: 400,
    meta_customers: 3, meta_new: 0, meta_existing: 3,
  }, {});
  check('no false positive on a tiny segment',
    !r.failures.some((f) => f.check === 'segment_zero_against_population'));
}

// 4. Material spend against nothing at all is a headline failure — it must stop the send.
{
  const r = reviewReport({ spend_cents: 1358600, meta_attributed_cents: 0, meta_orders: 0 }, {});
  check('spend_without_attribution fires', r.failures.some((f) => f.check === 'spend_without_attribution'));
  check('spend_without_attribution is headline', r.headlineFailures.some((f) => f.check === 'spend_without_attribution'));
}

// 5. Coverage of the source, not agreement with it.
//    Last-platform-click is a SUBSET of the platform's own purchase count and is never expected
//    to match it: measured over July, 97 last-click orders against 106 platform purchases. The
//    earlier version of this check demanded they agree within a third and so fired on every
//    healthy window. What matters is that the derived set has not collapsed or gone impossible.
{
  const collapsed = reviewReport({ meta_orders: 12 }, { external: { source_attributed_orders: 106 } });
  check('derived_set_collapsed fires at 11% coverage', collapsed.failures.some((f) => f.check === 'derived_set_collapsed'));
  const healthy = reviewReport({ meta_orders: 97 }, { external: { source_attributed_orders: 106 } });
  check('a normal last-click subset raises nothing', healthy.failures.length === 0, JSON.stringify(healthy.failures));
  const impossible = reviewReport({ meta_orders: 400 }, { external: { source_attributed_orders: 106 } });
  check('derived_set_exceeds_source fires', impossible.failures.some((f) => f.check === 'derived_set_exceeds_source'));
}

// 5b. THE ATTRIBUTION BLIND SPOT, recorded so it cannot be quietly reintroduced.
//     Measured 2026-08-07 over all 712 July orders Triple Whale returned: 97.7% of first-time-
//     buyer orders carry no attribution (126 of 129) against 37.9% of repeat-buyer orders. A
//     first purchase has no session history to attribute, so no channel can be credited with
//     acquiring it. The report must therefore never print a per-channel new-versus-existing
//     figure — not zero, not a number. This asserts the report says so in words.
{
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../functions/_lib/lbl_report_email.js', import.meta.url), 'utf8'));
  check('the Meta customer row states it is not measurable', /not measurable/.test(src));
  check('the report explains the blind spot with its measurement', /97\.7%/.test(src) && /37\.9%/.test(src));
  check('no per-channel new/existing figure is printed', !/num\(cur\.meta_new\)/.test(src));
}

// 6. Arithmetic no store produces.
{
  check('roas_out_of_range fires', reviewReport({ meta_roas: 12405 }, {}).failures.some((f) => f.check === 'roas_out_of_range'));
  check('split must total buyers',
    reviewReport({ new_customers: 4, returning_customers: 30, buyers: 99 }, {}).failures.some((f) => f.check === 'customer_split_does_not_total'));
  check('orders without revenue fires',
    reviewReport({ revenue_cents: 0, orders: 36 }, {}).failures.some((f) => f.check === 'orders_without_revenue'));
}

// 7. A healthy report must produce no failures at all, or the gate is noise and gets ignored.
{
  const r = reviewReport({
    revenue_cents: 1836313, orders: 36, aov_cents: 51009, buyers: 34,
    new_customers: 4, returning_customers: 30,
    spend_cents: 125360, meta_attributed_cents: 259476, meta_roas: 2.07,
    meta_orders: 10, meta_customers: 7, meta_new: 1, meta_existing: 6,
  }, {});
  check('a sound report raises nothing', r.failures.length === 0, JSON.stringify(r.failures));
}

// 7b. THE 8 AUGUST 2026 REPORT, EXACTLY AS IT WENT OUT.
//     $7,205.56 across 17 real orders, and "0 new customers and 0 existing" printed beside it.
//     The order history in D1 had not loaded that day; revenue came from a live BigCommerce
//     call, so the money was right and the people were missing. Both halves of this are now
//     headline failures: the send stops rather than repeat that sentence.
{
  const aug8 = reviewReport({
    revenue_cents: 720556, orders: 17, aov_cents: 42386,
    buyers: 0, new_customers: 0, returning_customers: 0,
    spend_cents: 79538, meta_attributed_cents: 645386, meta_roas: 8.11,
  }, {});
  check('orders_without_buyers fires on the 8 Aug report', aug8.failures.some((f) => f.check === 'orders_without_buyers'));
  check('customer_split_all_zero fires on the 8 Aug report', aug8.failures.some((f) => f.check === 'customer_split_all_zero'));
  check('the 8 Aug report is refused, not sent', aug8.headlineFailures.length > 0);

  // The upstream fix returns null, not zero, for a window whose orders have not loaded. That
  // report must still SEND — with the customer figures reading "unavailable" — because a hole
  // that names itself is useful and a refused send tells the team nothing.
  const unavailable = reviewReport({
    revenue_cents: 720556, orders: 17, aov_cents: 42386,
    buyers: null, new_customers: null, returning_customers: null,
    spend_cents: 79538, meta_attributed_cents: 645386, meta_roas: 8.11,
  }, {});
  check('an unavailable customer count does not refuse the send', unavailable.headlineFailures.length === 0,
    JSON.stringify(unavailable.failures));

  // A genuinely quiet day — no orders, no buyers — is not a failure.
  const quiet = reviewReport({ revenue_cents: 0, orders: 0, buyers: 0, new_customers: 0, returning_customers: 0 }, {});
  check('a day with no orders raises nothing', quiet.failures.length === 0, JSON.stringify(quiet.failures));

  // One person buying twice is normal and must not trip the check.
  const repeat = reviewReport({ revenue_cents: 500000, orders: 17, aov_cents: 29411, buyers: 12, new_customers: 3, returning_customers: 9 }, {});
  check('fewer buyers than orders raises nothing', repeat.failures.length === 0, JSON.stringify(repeat.failures));
}

// 8. A series that stops dead is a dead feed until proven otherwise.
{
  const dead = reviewTrend([
    { new_customers: 31 }, { new_customers: 16 }, { new_customers: 4 }, { new_customers: 8 },
    { new_customers: 1 }, { new_customers: 2 }, { new_customers: 0 }, { new_customers: 0 }, { new_customers: 0 },
  ], 'new_customers');
  check('trend_died fires on three terminal zeroes', dead.failures.some((f) => f.check === 'trend_died'));
  const alive = reviewTrend([
    { new_customers: 31 }, { new_customers: 16 }, { new_customers: 4 }, { new_customers: 8 },
    { new_customers: 1 }, { new_customers: 2 }, { new_customers: 3 }, { new_customers: 0 }, { new_customers: 2 },
  ], 'new_customers');
  check('trend_died does not fire on a live series', !alive.failures.some((f) => f.check === 'trend_died'));
}

// 9. The report path must actually consult the review — a check nobody calls is a comment.
{
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../functions/_lib/lbl_report_email.js', import.meta.url), 'utf8'));
  check('report imports the review', /from '\.\/lbl_report_sanity\.js'/.test(src));
  check('report refuses the send on a headline failure', /refused_by_plausibility_review/.test(src));
  check('force bypasses the calendar, never the review',
    src.indexOf('refused_by_plausibility_review') > -1 && !/force[^\n]*headline/i.test(src));
}

if (failed) {
  console.error(`PLAUSIBILITY_REVIEW_LAW FAILED — ${failed} check(s). The review is what stands between a wrong number and the team. Repair the review, never the expectation.`);
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  law: 'PLAUSIBILITY_REVIEW_LAW',
  checked: 'segment-vs-population, spend-without-attribution, cross-source drift, impossible arithmetic, orders-without-buyers, dead trend, send refusal, no-false-positives',
}));
