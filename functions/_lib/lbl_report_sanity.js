// THE COMMON-SENSE REVIEW — a report does not leave this build until its numbers survive a
// business-plausibility pass.
//
// Owner order 2026-08-07, verbatim: "WHY DONT YOU BUILD IN LOGIC TO MAKE YOU CAPTURE BASIC
// BUSINESS ERRORS ... YOU DIDNT READ YOUR OWN OUTPUT AND THINK 'DOES THIS MAKE SENSE GIVEN THIS
// BUSINESS' ... YOU SHOULD BUILD IN WHATEVER STRUCTURAL LOGIC WOULD GATE THIS SORT OF STUPIDITY".
//
// What happened: a monthly report went out saying Meta brought 38 buyers and 0 new customers,
// three months running. Triple Whale's own figures for the same month said 106 Facebook
// purchases and a New Customers CPA of $120.23 — a cost per new customer cannot exist for a
// channel that acquired none. The arithmetic was right and the answer was absurd, and nothing
// between the query and the send was capable of noticing.
//
// The rule this encodes: a number is not true because it computed. Every figure is measured
// against what is already known about this business before anyone reads it. A figure that fails
// is never silently corrected and never quietly dropped — it renders "unavailable" with the
// reason attached, and if it is a headline figure the send is refused outright. Sending nothing
// is recoverable. Sending a confident wrong number to a team that acts on it is not.
//
// Each check below states the failure that produced it. Add to this list when a new class of
// nonsense gets through; never relax a threshold to make a report pass.

// A share this far from the population is not a business fact. Zero new customers out of twenty
// in a business running 15% new is roughly a one-in-twenty-five-thousand event; the twenty-first
// time you see it, the feed is broken, not the marketing.
const SEGMENT_MIN_N = 15;
const POPULATION_NEW_SHARE_FLOOR = 0.05;

// A last-click subset of a platform-reported set will always be smaller. Below this it is a hole,
// not a model difference.
const CROSS_SOURCE_COVERAGE_FLOOR = 0.33;

// Spend that bought literally nothing is a broken join far more often than a broken campaign.
const MATERIAL_SPEND_CENTS = 50000;

const isNum = (v) => v != null && typeof v === 'number' && isFinite(v);
const pctStr = (x) => (Math.round(x * 1000) / 10) + '%';

/**
 * Run the plausibility pass over one composed report.
 * @param {object} m   flattened window metrics (revenue_cents, spend_cents, new_customers, ...)
 * @param {object} ctx { external: {…cross-source counts…}, label: 'monthly' }
 * @returns {{ failures: Array, headlineFailures: Array, suppress: Set<string> }}
 *   failures         every check that did not hold, each with a human reason
 *   headlineFailures the subset touching a number the report leads with — these refuse the send
 *   suppress         field names whose value must render "unavailable" instead of its figure
 */
export function reviewReport(m, ctx) {
  const failures = [];
  const suppress = new Set();
  const external = (ctx && ctx.external) || {};

  const fail = (check, field, reason, headline) => {
    failures.push({ check, field, reason, headline: !!headline });
    if (field) suppress.add(field);
  };

  // 1. A segment cannot be perfectly disjoint from the business it sits inside.
  //    This is the check that would have stopped the Meta "0 new" report.
  const orgTotal = (isNum(m.new_customers) ? m.new_customers : 0) + (isNum(m.returning_customers) ? m.returning_customers : 0);
  const orgNewShare = orgTotal ? m.new_customers / orgTotal : null;
  if (isNum(m.meta_customers) && m.meta_customers >= SEGMENT_MIN_N && isNum(m.meta_new) && m.meta_new === 0
      && orgNewShare != null && orgNewShare >= POPULATION_NEW_SHARE_FLOOR) {
    fail('segment_zero_against_population', 'meta_new',
      `Meta shows 0 new customers out of ${m.meta_customers} while the organization ran ${pctStr(orgNewShare)} new over the same window. `
      + 'A subset of the same buyers cannot be perfectly free of first-time customers; this is a gap in the attribution feed, not a marketing result.');
  }

  // 2. Material spend that bought nothing at all.
  if (isNum(m.spend_cents) && m.spend_cents >= MATERIAL_SPEND_CENTS) {
    if (isNum(m.meta_attributed_cents) && m.meta_attributed_cents === 0) {
      fail('spend_without_attribution', 'meta_attributed_cents',
        `$${Math.round(m.spend_cents / 100)} of spend is recorded against exactly $0 attributed. A dead join looks like this; a dead campaign almost never does.`, true);
    }
    if (isNum(m.meta_orders) && m.meta_orders === 0) {
      fail('spend_without_orders', 'meta_orders',
        `$${Math.round(m.spend_cents / 100)} of spend is recorded against 0 attributed orders.`);
    }
  }

  // 3. Coverage of the source, not agreement with it.
  //
  // The first version of this check demanded our count sit within a third of Triple Whale's
  // facebookPurchases. That was comparing two different things: ours is strict last-platform-
  // click from the order-level feed, theirs is the platform-reported purchase count including
  // view-through and cross-device. They are not supposed to match, so the check fired on every
  // healthy window — a false positive, which is how a gate becomes noise and then gets ignored.
  //
  // What is worth checking is that our derived set has not collapsed. Last-click will always be
  // a subset; a subset that falls below a third of the platform figure is a broken feed.
  if (isNum(external.source_attributed_orders) && isNum(m.meta_orders) && external.source_attributed_orders > 0) {
    const coverage = m.meta_orders / external.source_attributed_orders;
    if (coverage < CROSS_SOURCE_COVERAGE_FLOOR) {
      fail('derived_set_collapsed', 'meta_orders',
        `This report derives ${m.meta_orders} Meta orders from the order-level feed where the platform reports `
        + `${external.source_attributed_orders} purchases (${pctStr(coverage)} coverage). Last-click is always a subset, `
        + 'but not this small — the feed has holes.');
    }
    if (m.meta_orders > external.source_attributed_orders * 1.5) {
      fail('derived_set_exceeds_source', 'meta_orders',
        `This report derives ${m.meta_orders} Meta orders against ${external.source_attributed_orders} platform purchases. `
        + 'A last-click subset cannot exceed the set it is drawn from.');
    }
  }

  // 4. Arithmetic that cannot be true of any store.
  if (isNum(m.meta_roas) && (m.meta_roas < 0 || m.meta_roas > 100)) {
    fail('roas_out_of_range', 'meta_roas', `ROAS of ${m.meta_roas} is outside anything a real channel produces; check the denominator.`, true);
  }
  if (isNum(m.aov_cents) && isNum(m.orders) && m.orders > 0 && (m.aov_cents < 100 || m.aov_cents > 10000000)) {
    fail('aov_out_of_range', 'aov_cents', `Average order of $${Math.round(m.aov_cents / 100)} is not a plausible order for this store.`, true);
  }
  if (isNum(m.revenue_cents) && m.revenue_cents < 0) {
    fail('negative_revenue', 'revenue_cents', 'Revenue is negative.', true);
  }
  if (isNum(m.new_customers) && isNum(m.returning_customers) && isNum(m.buyers)
      && m.new_customers + m.returning_customers !== m.buyers) {
    fail('customer_split_does_not_total', 'new_customers',
      `New (${m.new_customers}) plus existing (${m.returning_customers}) is ${m.new_customers + m.returning_customers}, but the window had ${m.buyers} buyers.`, true);
  }

  // 5. Revenue with no orders, or orders with no revenue.
  if (isNum(m.revenue_cents) && isNum(m.orders)) {
    if (m.orders > 0 && m.revenue_cents === 0) fail('orders_without_revenue', 'revenue_cents', `${m.orders} orders totalling exactly $0.`, true);
    if (m.orders === 0 && m.revenue_cents > 0) fail('revenue_without_orders', 'orders', `$${Math.round(m.revenue_cents / 100)} of revenue across 0 orders.`, true);
  }

  // 6. A store that sold something had customers.
  //
  // The 8 August 2026 daily report went out reading $7,205 of revenue on 17 orders with
  // "0 new customers and 0 existing" side by side. The cause was upstream — the order history
  // in D1 had not loaded that day while revenue came from a live BigCommerce call — and it is
  // fixed there, at api.lbl.fyi, which now returns null instead of zero for any window whose
  // orders are not fully loaded. This check exists because that was the second time a dead feed
  // arrived dressed as a zero, and the send must refuse it whatever produces it next time.
  // Orders and buyers are not the same count — one person can order twice — but a day with
  // orders cannot have no buyers at all.
  if (isNum(m.orders) && m.orders > 0) {
    if (isNum(m.buyers) && m.buyers === 0) {
      fail('orders_without_buyers', 'buyers',
        `${m.orders} orders were placed and the customer count reads 0 buyers. Somebody placed those orders. `
        + 'This is an order history that has not loaded, not a day without customers.', true);
    }
    if (isNum(m.new_customers) && isNum(m.returning_customers) && m.new_customers === 0 && m.returning_customers === 0) {
      fail('customer_split_all_zero', 'new_customers',
        `${m.orders} orders were placed and both halves of the customer split read 0 — 0 new and 0 existing. `
        + 'Every order has a buyer, and every buyer is either new or returning.', true);
    }
  }

  return { failures, headlineFailures: failures.filter((f) => f.headline), suppress };
}

/**
 * A trend series is reviewed as a series, because the tell is in the shape: a column that was
 * materially non-zero and is now exactly zero for several consecutive periods is a feed that
 * died on a date, not a business that changed on one.
 */
const DEAD_RUN_PERIODS = 3;
export function reviewTrend(rows, field) {
  if (!Array.isArray(rows) || rows.length < DEAD_RUN_PERIODS + 1) return { failures: [] };
  const vals = rows.map((r) => (isNum(r[field]) ? r[field] : null));
  let run = 0;
  for (let i = vals.length - 1; i >= 0 && vals[i] === 0; i--) run++;
  const before = vals.slice(0, vals.length - run).filter(isNum);
  const priorMax = before.length ? Math.max(...before) : 0;
  if (run >= DEAD_RUN_PERIODS && priorMax > 0) {
    return {
      failures: [{
        check: 'trend_died', field,
        reason: `"${field}" reached ${priorMax} earlier in this series and has been exactly 0 for the last ${run} periods. `
          + 'A metric that stops dead rather than declining is a collection failure until proven otherwise.',
        headline: false,
      }],
    };
  }
  return { failures: [] };
}

// Rendered wherever a suppressed figure would have gone. The reason travels with the hole, so
// nobody has to guess whether a blank means zero, missing, or refused.
export function suppressedLabel(failures, field) {
  const f = failures.find((x) => x.field === field);
  return f ? 'unavailable — failed plausibility check' : 'unavailable';
}
