// LBL commercial reports — three templates off one design and one data path.
//
//   daily    yesterday, against the day before
//   weekly   the last complete Monday–Sunday, against the seven days before it
//   monthly  month-to-date against the same day-count of the previous month; on the 1st,
//            the month that just closed against the whole month before it
//
// Owner order 2026-08-07, verbatim: "you made a wall of text ... this tells no one anything
// about spend / ROAS / New customers / Existing customers". The prior report opened with a
// paragraph and then dumped sixty day-rows. Every template here opens with eight numbers —
// revenue, orders, average order, refunds, ad spend, ROAS, new customers, returning
// customers — each carrying its own change against the comparison window. Prose is capped at
// three sentences and every sentence is a arithmetic restatement of a number already shown.
//
// Data is lbl.fyi's /v1/range, which returns a window and the window before it from the same
// pull. RULES.md #8 holds throughout: a source that did not answer renders "unavailable", and
// nothing substitutes a zero for it.
//
// Every composed report is run through functions/_lib/lbl_report_sanity.js before it can be
// sent. A figure that fails its business-plausibility check renders "unavailable — failed
// plausibility check" with the reason stated; a headline figure that fails refuses the send
// outright. See that file for why.
import { reviewReport } from './lbl_report_sanity.js';

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI','Source Sans 3',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const INK = '#000000';
const DIM = '#6b6b6b';
const RULE = '#e5e5e5';
const UP = '#10715a';
const DOWN = '#a3341f';

const API = 'https://api.lbl.fyi';

// ---- dates (all arithmetic in UTC on plain YYYY-MM-DD; the API owns store-timezone truth) ----
const dayMs = 86400000;
function addDays(iso, n) { return new Date(Date.parse(iso + 'T00:00:00Z') + n * dayMs).toISOString().slice(0, 10); }
function dowMon0(iso) { return (new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay() + 6) % 7; }
function monthStartOf(iso) { return iso.slice(0, 8) + '01'; }
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / dayMs) + 1; }
function prettyDay(iso) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(iso + 'T12:00:00Z'));
}
function shortDay(iso) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
}
function weekdayShort(iso) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
}
function monthName(iso) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
}

// ---- formatting ------------------------------------------------------------------
const UNAVAILABLE = 'unavailable';
function isNum(v) { return v != null && typeof v === 'number' && isFinite(v); }
function money(cents) {
  if (!isNum(cents)) return UNAVAILABLE;
  return '$' + Math.round(cents / 100).toLocaleString('en-US');
}
function moneyExact(cents) {
  if (!isNum(cents)) return UNAVAILABLE;
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function compact(cents) {
  if (!isNum(cents)) return UNAVAILABLE;
  const d = cents / 100;
  if (Math.abs(d) >= 1000000) return '$' + (d / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
  if (Math.abs(d) >= 1000) return '$' + (d / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return '$' + Math.round(d);
}
function num(v) { return isNum(v) ? Math.round(v).toLocaleString('en-US') : UNAVAILABLE; }
function roasStr(v) { return isNum(v) ? v.toFixed(2) + '×' : '—'; }
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// A change reads as a percentage when the base is meaningful, as an absolute step when the base
// is zero or the metric is a small count, and as nothing at all when either side is unavailable.
// It never renders "+100%" off a zero base — that is a fabrication of scale.
function change(cur, prev, kind, fmtBase) {
  if (!isNum(cur) || !isNum(prev)) return null;
  const diff = cur - prev;
  if (kind === 'count' || kind === 'ratio') {
    if (Math.abs(diff) < (kind === 'ratio' ? 0.005 : 0.5)) return { dir: 0, label: 'flat' };
    const step = kind === 'ratio' ? diff.toFixed(2) : Math.abs(Math.round(diff)).toLocaleString('en-US');
    return { dir: diff > 0 ? 1 : -1, label: (kind === 'ratio' ? (diff > 0 ? '+' : '−') + Math.abs(diff).toFixed(2) : step) };
  }
  // A percentage off a base near zero is arithmetically true and informationally worthless:
  // August ad spend against a July week that predates the Triple Whale connector produced
  // "▲ 46955%", which reads as a broken number rather than as "there was nothing to compare
  // against". Past 1000% the comparison names its own base instead of scaling it.
  if (!prev) return diff ? { dir: diff > 0 ? 1 : -1, label: 'no comparable base' } : { dir: 0, label: 'flat' };
  const p = (diff / prev) * 100;
  if (Math.abs(p) < 0.5) return { dir: 0, label: 'flat' };
  if (Math.abs(p) >= 1000) return { dir: p > 0 ? 1 : -1, label: 'vs ' + (fmtBase ? fmtBase(prev) : String(prev)) };
  return { dir: p > 0 ? 1 : -1, label: Math.abs(p) >= 10 ? Math.round(Math.abs(p)) + '%' : Math.abs(p).toFixed(1) + '%' };
}

// Revenue over ad spend stops being a statement about advertising once spend is immaterial:
// $13 of spend on a day the store took $10,759 renders as 802×, which tells nobody anything.
// Below the floor the cell reads "—" and the spend column next to it shows why.
const RATIO_FLOOR_CENTS = 10000;
function revPerSpend(gross, spend) {
  if (!isNum(gross) || !isNum(spend) || spend < RATIO_FLOOR_CENTS) return '—';
  return (gross / spend).toFixed(1) + '×';
}
function plural(n, one, many) { return num(n) + ' ' + (Math.abs(Number(n)) === 1 ? one : many); }
function changeText(c) {
  if (!c) return '';
  if (c.dir === 0) return 'flat';
  return (c.dir > 0 ? '▲ ' : '▼ ') + c.label;
}
// Direction is coloured by whether the movement is good for the business, which is inverted for
// costs and refunds. Colour is the only editorial act in this file and it states nothing the
// arithmetic does not already say.
function changeColor(c, goodWhenDown) {
  if (!c || c.dir === 0) return DIM;
  const good = goodWhenDown ? c.dir < 0 : c.dir > 0;
  return good ? UP : DOWN;
}

// ---- data ------------------------------------------------------------------------
async function getJson(url, syncKey) {
  const r = await fetch(url, { headers: { 'x-sync-key': syncKey } });
  if (!r.ok) throw new Error(url.replace(API, '') + ' -> HTTP ' + r.status);
  return await r.json();
}

// Flatten one /v1/range window (or its .prev) into the shape every template renders from.
// A missing source stays null all the way to the page, where it prints "unavailable".
function flatten(w) {
  if (!w) return null;
  const bc = w.bigcommerce || null;
  const m = w.meta || null;
  const kl = w.klaviyo || null;
  const c = w.customers || null;
  return {
    revenue_cents: bc ? bc.gross_cents : null,
    orders: bc ? bc.orders : null,
    aov_cents: bc ? bc.aov_cents : null,
    refunds_cents: bc ? bc.refunds_cents : null,
    spend_cents: m ? m.ad_spend_cents : null,
    meta_attributed_cents: m ? m.meta_attributed_cents : null,
    meta_roas: m ? m.meta_roas : null,
    channels: (m && Array.isArray(m.channels)) ? m.channels : null,
    meta_orders: m ? m.orders : null,
    meta_customers: m ? m.customers : null,
    meta_new: m ? m.new_customers : null,
    meta_existing: m ? m.existing_customers : null,
    buyers: c ? c.buyers : null,
    new_customers: c ? c.new : null,
    returning_customers: c ? c.returning : null,
    email_cents: kl ? kl.email_cents : null,
    email_orders: kl ? kl.email_orders : null,
    sms_cents: kl ? kl.sms_cents : null,
    sms_orders: kl ? kl.sms_orders : null,
  };
}

// ---- window selection ------------------------------------------------------------
// Each kind resolves to {from,to,prevFrom,prevTo,title,periodLabel,compareLabel}. The comparison
// window is stated in words on the page so nobody has to infer what a percentage is against.
function resolveWindow(kind, today) {
  const yesterday = addDays(today, -1);
  if (kind === 'daily') {
    return {
      kind, from: yesterday, to: yesterday, prevFrom: addDays(yesterday, -1), prevTo: addDays(yesterday, -1),
      title: 'Daily', periodLabel: prettyDay(yesterday),
      compareLabel: 'the day before (' + shortDay(addDays(yesterday, -1)) + ')',
    };
  }
  if (kind === 'weekly') {
    const thisMonday = addDays(today, -dowMon0(today));
    const from = addDays(thisMonday, -7);
    const to = addDays(thisMonday, -1);
    return {
      kind, from, to, prevFrom: addDays(from, -7), prevTo: addDays(from, -1),
      title: 'Weekly recap', periodLabel: shortDay(from) + ' – ' + shortDay(to) + ', ' + to.slice(0, 4),
      compareLabel: 'the week before (' + shortDay(addDays(from, -7)) + ' – ' + shortDay(addDays(from, -1)) + ')',
    };
  }
  if (kind === 'monthly') {
    const ms = monthStartOf(today);
    if (today === ms) {
      // The 1st: the month that just closed, against the whole month before it.
      const closedEnd = addDays(ms, -1);
      const closedStart = monthStartOf(closedEnd);
      const prevEnd = addDays(closedStart, -1);
      const prevStart = monthStartOf(prevEnd);
      return {
        kind, closed: true, from: closedStart, to: closedEnd, prevFrom: prevStart, prevTo: prevEnd,
        title: 'Monthly recap — close of month', periodLabel: monthName(closedStart) + ' (closed)',
        compareLabel: 'all of ' + monthName(prevStart),
      };
    }
    // Mid-month: month-to-date through yesterday, against the same number of days of last month,
    // so a 7-day-old month is never compared against a finished 31-day one.
    const to = yesterday;
    const n = daysBetween(ms, to);
    const prevMonthEnd = addDays(ms, -1);
    const prevMonthStart = monthStartOf(prevMonthEnd);
    const prevTo = addDays(prevMonthStart, n - 1);
    return {
      kind, closed: false, from: ms, to, prevFrom: prevMonthStart, prevTo: prevTo > prevMonthEnd ? prevMonthEnd : prevTo,
      title: 'Monthly recap — month to date', periodLabel: monthName(ms) + ' through ' + shortDay(to),
      compareLabel: 'the first ' + n + ' day' + (n === 1 ? '' : 's') + ' of ' + monthName(prevMonthStart),
    };
  }
  throw new Error('unknown report kind: ' + kind);
}

// ---- html primitives -------------------------------------------------------------
function kpi(label, value, ch, goodWhenDown) {
  const chHtml = ch
    ? `<div style="font-family:${FONT};font-size:12px;font-weight:600;color:${changeColor(ch, goodWhenDown)};margin-top:3px">${esc(changeText(ch))}</div>`
    : `<div style="font-family:${FONT};font-size:12px;color:${DIM};margin-top:3px">no comparison</div>`;
  return `<td width="50%" style="padding:14px 16px;border:1px solid ${RULE};vertical-align:top">
<div style="font-family:${FONT};font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:${DIM};font-weight:700">${esc(label)}</div>
<div style="font-family:${MONO};font-size:23px;line-height:1.15;font-weight:700;color:${INK};margin-top:5px;white-space:nowrap">${esc(value)}</div>
${chHtml}</td>`;
}

function kpiGrid(tiles) {
  const rows = [];
  for (let i = 0; i < tiles.length; i += 2) {
    rows.push('<tr>' + tiles[i] + (tiles[i + 1] || '<td width="50%" style="border:1px solid ' + RULE + '"></td>') + '</tr>');
  }
  return `<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;table-layout:fixed;margin:16px 0 0">${rows.join('')}</table>`;
}

function table(headers, rows, opts) {
  const align = (i) => (i === 0 ? 'left' : 'right');
  const th = headers.map((h, i) =>
    `<th style="text-align:${align(i)};font-family:${FONT};font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:${DIM};font-weight:700;padding:0 ${i === headers.length - 1 ? '0' : '10px'} 7px ${i === 0 ? '0' : '10px'};border-bottom:2px solid ${INK}">${esc(h)}</th>`).join('');
  const trs = rows.map((r, ri) => {
    const strong = opts && opts.strongRows && opts.strongRows.includes(ri);
    return '<tr>' + r.map((c, i) =>
      `<td style="text-align:${align(i)};font-family:${i === 0 ? FONT : MONO};font-size:${i === 0 ? '13px' : '13px'};font-weight:${strong ? '700' : '400'};color:${INK};padding:8px ${i === r.length - 1 ? '0' : '10px'} 8px ${i === 0 ? '0' : '10px'};border-bottom:1px solid ${RULE};white-space:nowrap">${esc(c)}</td>`).join('') + '</tr>';
  }).join('');
  return `<table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:10px 0 0">${'<tr>' + th + '</tr>'}${trs}</table>`;
}

function heading(title, sub) {
  return `<div style="margin:30px 0 0">
<div style="font-family:${FONT};font-size:15px;font-weight:700;color:${INK};letter-spacing:-0.005em">${esc(title)}</div>
${sub ? `<div style="font-family:${FONT};font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:${DIM};margin-top:2px">${esc(sub)}</div>` : ''}</div>`;
}

function note(text) {
  return `<div style="font-family:${FONT};font-size:12px;line-height:1.5;color:${DIM};margin-top:8px">${esc(text)}</div>`;
}

function unavailable(what) {
  return `<div style="border:1px dashed #b0b0b0;color:${DIM};padding:11px 13px;font-family:${FONT};font-size:13px;margin-top:10px">${esc(what)} — unavailable. Nothing is substituted for it.</div>`;
}

// ---- the three-sentence read -----------------------------------------------------
// Every sentence restates arithmetic already on the page. No sentence proposes a cause: the
// causes are not in this data, and inventing one is the failure mode this build refuses.
function buildRead(cur, prev, win) {
  const out = [];
  const rev = change(cur.revenue_cents, prev && prev.revenue_cents, 'pct');
  const ord = change(cur.orders, prev && prev.orders, 'pct');
  if (isNum(cur.revenue_cents)) {
    let s = money(cur.revenue_cents) + ' on ' + plural(cur.orders, 'order', 'orders');
    if (isNum(cur.aov_cents)) s += ' at ' + moneyExact(cur.aov_cents) + ' average';
    if (rev && ord && rev.dir !== 0) {
      s += ' — revenue ' + (rev.dir > 0 ? 'up ' : 'down ') + rev.label +
        ' on ' + (ord.dir === 0 ? 'flat orders' : 'orders ' + (ord.dir > 0 ? 'up ' : 'down ') + ord.label) +
        ' against ' + win.compareLabel;
    }
    out.push(s + '.');
  } else out.push('Store revenue is unavailable for this window; nothing is substituted for it.');

  if (isNum(cur.spend_cents) && cur.spend_cents > 0) {
    const roas = isNum(cur.meta_roas) ? roasStr(cur.meta_roas) : null;
    const rc = change(cur.meta_roas, prev && prev.meta_roas, 'ratio');
    let s = money(cur.spend_cents) + ' of ad spend returned ' + money(cur.meta_attributed_cents) + ' attributed';
    if (roas) s += ' — ' + roas + ' ROAS' + (rc && rc.dir !== 0 ? ' (' + rc.label + ')' : '');
    if (isNum(cur.revenue_cents) && cur.revenue_cents > 0) {
      s += ', against store revenue that is ' + (cur.revenue_cents / cur.spend_cents).toFixed(1) + '× the spend';
    }
    out.push(s + '.');
  } else if (isNum(cur.spend_cents)) out.push('No channel recorded ad spend in this window.');
  else out.push('Ad spend and attribution are unavailable for this window, not zero.');

  if (isNum(cur.new_customers)) {
    const nc = change(cur.new_customers, prev && prev.new_customers, 'count');
    const share = isNum(cur.buyers) && cur.buyers ? Math.round((cur.new_customers / cur.buyers) * 100) : null;
    let s = num(cur.new_customers) + ' new customer' + (cur.new_customers === 1 ? '' : 's') +
      ' and ' + num(cur.returning_customers) + ' returning';
    if (share != null) s += ' — ' + share + '% of buyers were new';
    if (nc && nc.dir !== 0) s += ', ' + (nc.dir > 0 ? 'up ' : 'down ') + nc.label + ' on the comparison window';
    out.push(s + '.');
  } else out.push('The new-versus-returning split is unavailable for this window.');
  return out;
}

// ---- shape section (weekly = 7 days, monthly = weeks) ------------------------------
function buildShape(kind, win, series) {
  if (!series || !series.byDay) return null;
  const rowsFor = (a, b) => {
    let orders = 0, gross = 0, spend = 0, any = false, anySpend = false;
    for (let d = a; d <= b; d = addDays(d, 1)) {
      const r = series.byDay[d];
      if (r) { any = true; orders += r.orders || 0; gross += r.gross_cents || 0; }
      const s = series.spendByDay[d];
      if (s != null) { anySpend = true; spend += s; }
    }
    return { orders, gross, spend, any, anySpend };
  };
  if (kind === 'weekly') {
    const rows = [];
    for (let d = win.from; d <= win.to; d = addDays(d, 1)) {
      const r = rowsFor(d, d);
      rows.push([
        weekdayShort(d) + ' ' + shortDay(d),
        r.any ? num(r.orders) : UNAVAILABLE,
        r.any ? money(r.gross) : UNAVAILABLE,
        r.anySpend ? money(r.spend) : UNAVAILABLE,
        r.anySpend && r.any ? revPerSpend(r.gross, r.spend) : '—',
      ]);
    }
    const t = rowsFor(win.from, win.to);
    rows.push(['Week', num(t.orders), money(t.gross), money(t.spend), revPerSpend(t.gross, t.spend)]);
    return { html: table(['Day', 'Orders', 'Revenue', 'Ad spend', 'Rev / spend'], rows, { strongRows: [rows.length - 1] }), rows };
  }
  // monthly: calendar weeks (Mon-start) clipped to the window
  const rows = [];
  let cursor = win.from;
  while (cursor <= win.to) {
    const weekEndRaw = addDays(cursor, 6 - dowMon0(cursor));
    const end = weekEndRaw > win.to ? win.to : weekEndRaw;
    const r = rowsFor(cursor, end);
    rows.push([
      shortDay(cursor) + ' – ' + shortDay(end),
      r.any ? num(r.orders) : UNAVAILABLE,
      r.any ? money(r.gross) : UNAVAILABLE,
      r.anySpend ? money(r.spend) : UNAVAILABLE,
      r.anySpend && r.any ? revPerSpend(r.gross, r.spend) : '—',
    ]);
    cursor = addDays(end, 1);
  }
  const t = rowsFor(win.from, win.to);
  rows.push(['Window', num(t.orders), money(t.gross), money(t.spend), revPerSpend(t.gross, t.spend)]);
  return { html: table(['Week', 'Orders', 'Revenue', 'Ad spend', 'Rev / spend'], rows, { strongRows: [rows.length - 1] }), rows };
}

// ---- compose ---------------------------------------------------------------------
export async function composeLblReport(env, kindArg, opts) {
  const kind = String(kindArg || 'daily').trim().toLowerCase();
  if (!['daily', 'weekly', 'monthly'].includes(kind)) return { ok: false, error: 'kind must be daily, weekly or monthly' };
  const syncKey = env.LBL_SYNC_KEY || '';
  if (!syncKey) return { ok: false, error: 'LBL_SYNC_KEY missing — wrangler pages secret put LBL_SYNC_KEY --project-name loop-safe-miscsubjects' };

  // "Today" is the store's own day, taken from the platform rather than from this worker's clock.
  let head;
  try { head = await getJson(API + '/v1/today', syncKey); } catch (e) { return { ok: false, error: 'lbl /v1/today: ' + ((e && e.message) || e) }; }
  const tz = String((head.meta && head.meta.store_timezone) || 'UTC');
  const today = (opts && opts.today) || (head.meta && head.meta.date);
  if (!today) return { ok: false, error: 'lbl /v1/today returned no meta.date' };

  const win = resolveWindow(kind, today);

  let range;
  try { range = await getJson(API + '/v1/range?from=' + win.from + '&to=' + win.to, syncKey); } catch (e) {
    return { ok: false, error: 'lbl /v1/range: ' + ((e && e.message) || e) };
  }
  const cur = flatten(range.period);

  // Daily and weekly compare against the window /v1/range already returns (the equal-length
  // window immediately before). Monthly needs a named calendar window instead, so it is pulled
  // explicitly rather than inferred.
  let prev, comparedFrom = win.prevFrom, comparedTo = win.prevTo;
  if (kind === 'monthly') {
    try {
      const pr = await getJson(API + '/v1/range?from=' + win.prevFrom + '&to=' + win.prevTo, syncKey);
      prev = flatten(pr.period);
    } catch { prev = null; }
  } else {
    prev = flatten(range.period && range.period.prev);
    comparedFrom = (range.period && range.period.prev_from) || win.prevFrom;
    comparedTo = (range.period && range.period.prev_to) || win.prevTo;
  }

  // Day series for the shape section, from the same /v1/today pull (60 days back).
  const series = { byDay: {}, spendByDay: {} };
  for (const r of ((head.bigcommerce && head.bigcommerce.per_day) || [])) series.byDay[r.date] = r;
  for (const r of ((head.triplewhale && head.triplewhale.per_day) || [])) series.spendByDay[r.date] = r.spend_cents;

  const read = buildRead(cur, prev, win);
  const shape = kind === 'daily' ? null : buildShape(kind, win, series);

  // THE COMMON-SENSE REVIEW. Nothing below renders until the figures have been measured against
  // what is already known about this business.
  // Triple Whale publishes its own count of Meta-attributed orders in the same payload, so the
  // report's derived count is measured against it rather than trusted. July 2026 read 61 from
  // the last-click join against 106 from the source — a 42% hole that nothing was checking.
  const metaChannel = (cur.channels || []).find((c) => /^meta$|^facebook/i.test(String(c.channel || ''))) || null;
  // The review sees exactly what the report will print. Per-channel new-versus-existing is no
  // longer printed at all — Triple Whale cannot attribute first purchases, so the quantity does
  // not exist — and a check that fires on a field nobody renders is noise, which is how a gate
  // stops being read.
  const reviewable = { ...cur, meta_new: null, meta_existing: null };
  const review = reviewReport(reviewable, {
    label: kind,
    external: { source_attributed_orders: metaChannel ? metaChannel.attributed_orders : null },
  });
  const allFailures = review.failures;
  const suppress = review.suppress;

  // ---- KPI tiles: the eight numbers the owner named, in the order he named them ----
  const ch = {
    revenue: change(cur.revenue_cents, prev && prev.revenue_cents, 'pct', money),
    spend: change(cur.spend_cents, prev && prev.spend_cents, 'pct', money),
    roas: change(cur.meta_roas, prev && prev.meta_roas, 'ratio'),
    attributed: change(cur.meta_attributed_cents, prev && prev.meta_attributed_cents, 'pct', money),
    newc: change(cur.new_customers, prev && prev.new_customers, 'count'),
    existing: change(cur.returning_customers, prev && prev.returning_customers, 'count'),
    orders: change(cur.orders, prev && prev.orders, 'pct', num),
    aov: change(cur.aov_cents, prev && prev.aov_cents, 'pct', moneyExact),
  };
  const tiles = [
    kpi('Revenue', money(cur.revenue_cents), ch.revenue, false),
    kpi('Ad spend', money(cur.spend_cents), ch.spend, true),
    kpi('ROAS (Meta)', roasStr(cur.meta_roas), ch.roas, false),
    kpi('Attributed revenue', money(cur.meta_attributed_cents), ch.attributed, false),
    kpi('New customers', num(cur.new_customers), ch.newc, false),
    kpi('Existing customers', num(cur.returning_customers), ch.existing, false),
    kpi('Orders', num(cur.orders), ch.orders, false),
    kpi('Average order', moneyExact(cur.aov_cents), ch.aov, false),
  ];

  // ---- advertising ----
  let adHtml;
  if (isNum(cur.spend_cents)) {
    const chans = (cur.channels && cur.channels.length)
      ? cur.channels
      : (isNum(cur.meta_attributed_cents)
        ? [{ channel: 'Meta', spend_cents: cur.spend_cents, attributed_revenue_cents: cur.meta_attributed_cents, attributed_orders: cur.meta_orders, roas: cur.meta_roas }]
        : []);
    const rows = chans.map((c) => [
      c.channel,
      money(c.spend_cents),
      money(c.attributed_revenue_cents),
      isNum(c.attributed_orders) ? num(c.attributed_orders) : '—',
      roasStr(c.roas),
    ]);
    if (!rows.length) rows.push(['No channel recorded spend', money(0), money(0), '—', '—']);
    adHtml = table(['Channel', 'Spend', 'Attributed', 'Orders', 'ROAS'], rows);
    const blended = isNum(cur.revenue_cents) && cur.spend_cents > 0 ? (cur.revenue_cents / cur.spend_cents).toFixed(2) + '×' : null;
    adHtml += note(
      'A channel’s ROAS is its own attributed revenue over its own spend. ' +
      (blended ? 'Store revenue over total ad spend is ' + blended + ' — a different measure, and not a channel’s ROAS. ' : '') +
      'Attribution is Triple Whale’s model, not BigCommerce’s ledger.');
    // WHAT THE SPEND FIGURE CAN AND CANNOT SEE.
    //
    // Reported by the media buyer through the owner on 2026-08-09: not all Meta spend is syncing.
    // Spend here is the single blended figure Triple Whale returns; Triple Whale has no per-account
    // API, so an ad account that is not connected to it contributes nothing to this number and
    // leaves no gap anyone can see. A reader who does not know that will read a ROAS that is too
    // high and a spend that is too low, and neither will look wrong. The report says so on its face
    // until the connected-account list is reconciled against the accounts actually running.
    adHtml += note(
      'Spend is Triple Whale’s blended Meta figure. Triple Whale exposes no per-account breakdown, so any ' +
      'Meta ad account not connected to it is absent from this number rather than shown as missing — which ' +
      'makes spend read low and ROAS read high. Treat ROAS as an upper bound until the connected accounts ' +
      'are reconciled against the accounts actually running.');
  } else adHtml = unavailable('Ad spend and attribution');

  // ---- customers ----
  let custHtml;
  if (isNum(cur.new_customers)) {
    const total = (cur.new_customers || 0) + (cur.returning_customers || 0);
    const rows = [[
      'Organization',
      num(cur.new_customers),
      num(cur.returning_customers),
      num(total),
      total ? Math.round((cur.new_customers / total) * 100) + '%' : '—',
    ]];
    // NO PER-CHANNEL NEW-VERSUS-EXISTING. Measured 2026-08-07 over every July order Triple
    // Whale returned (712): 97.7% of first-time-buyer orders carry no attribution at all
    // (126 of 129 read "Non-attributed" or "Excluded") against 37.9% of repeat-buyer orders.
    // Triple Whale is structurally blind to first purchases — a new customer arrives with no
    // session history to attribute — so no channel can be credited with acquiring them, and a
    // per-channel new/existing split is not a computable quantity here for Meta or anything
    // else. It reported zero because the data cannot see them, which is why this row states
    // the limit rather than printing a number and letting the reader draw the wrong conclusion.
    rows.push([
      'Meta-attributed',
      'not measurable',
      'not measurable',
      isNum(cur.meta_customers) ? num(cur.meta_customers) : UNAVAILABLE,
      '—',
    ]);
    if (prev) {
      rows.push(['Organization — comparison window', num(prev.new_customers), num(prev.returning_customers),
        num((prev.new_customers || 0) + (prev.returning_customers || 0)), '']);
    }
    custHtml = table(['', 'New', 'Existing', 'Total buyers', 'New share'], rows);
    // The two Meta figures on this page come from two different Triple Whale models and must
    // not be read as one population: attributed revenue and ROAS are Triple Whale's own
    // attribution, while this split is strict last-platform-click, which is a much smaller set
    // of orders. Printing them adjacent without saying so invites exactly the wrong inference.
    custHtml += `<div style="border:1px dashed #b0b0b0;padding:11px 13px;font-family:${FONT};font-size:12.5px;line-height:1.55;color:${DIM};margin-top:10px"><strong style="color:${INK}">Why the Meta row says “not measurable”.</strong> Across every July order Triple Whale returned, 97.7% of first-time-buyer orders carried no attribution at all — 126 of 129 read “Non-attributed” — against 37.9% of repeat-buyer orders. A first purchase arrives with no session history to attribute, so Triple Whale cannot see who acquired it. That makes a per-channel new-versus-existing split uncomputable for every channel, not just Meta. It is not zero, and it is not a Meta result.</div>`;
    custHtml += note('New means a first-ever order to the organization, not a first order inside this window. ' +
      'The organization row is counted from the store’s own order history and does not depend on ad attribution. ' +
      'The Meta buyer count is orders whose last platform click was Meta — a stricter set than the attributed revenue above, ' +
      'which uses Triple Whale’s own model. Neither changes ROAS.');
  } else custHtml = unavailable('The new-versus-existing split');

  // ---- owned channels ----
  let ownedHtml;
  if (isNum(cur.email_cents)) {
    ownedHtml = table(['Channel', 'Revenue', 'Orders', 'Comparison window'], [
      ['Email', money(cur.email_cents), num(cur.email_orders), prev ? money(prev.email_cents) : UNAVAILABLE],
      ['SMS', money(cur.sms_cents), num(cur.sms_orders), prev ? money(prev.sms_cents) : UNAVAILABLE],
    ]);
    ownedHtml += note('Klaviyo and an ad channel can each claim the same order; these totals overlap with attribution by design.');
  } else ownedHtml = unavailable('Klaviyo owned-channel revenue');

  // ---- html ----
  const windowLine = win.from === win.to
    ? win.from + ' · midnight to midnight, ' + tz
    : win.from + ' → ' + win.to + ' · ' + daysBetween(win.from, win.to) + ' days, ' + tz;

  // NO SIGNATURE ON THIS REPORT. Owner order 2026-08-09: "on the daily email I don't want there to
  // be any signature (no via loop build, no any of that)". It used to close "Yours in Civilization,
  // / The Loop build". This is an internal operating report to the team, not a letter from anyone —
  // the closing law that governs outbound letters does not reach it, and a valediction on a table of
  // numbers reads as a machine pretending to be a correspondent. The footer states the day boundary
  // and the live view, nothing else.
  //
  // This note lives out here, not inside the template. The first version of it was an HTML comment
  // in the markup, which put the words "Yours in Civilization, / The Loop build" back into every
  // recipient's HTML source — invisible on screen, present in the file, and enough to fail a search
  // for the thing that was supposed to be gone. An internal note does not travel with the artifact.
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="max-width:660px;margin:0 auto;padding:26px 18px 34px;background:#ffffff">

<div style="border-bottom:3px solid ${INK};padding-bottom:11px">
  <div style="font-family:${FONT};font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:${DIM};font-weight:700">Loop Bio Labs</div>
  <div style="font-family:${FONT};font-size:21px;font-weight:700;letter-spacing:-0.015em;color:${INK};margin-top:3px">${esc(win.title)} — ${esc(win.periodLabel)}</div>
  <div style="font-family:${FONT};font-size:12px;color:${DIM};margin-top:4px">${esc(windowLine)}</div>
  <div style="font-family:${FONT};font-size:12px;color:${DIM};margin-top:2px">Every change below is measured against ${esc(win.compareLabel)}.</div>
</div>

${kpiGrid(tiles)}

<div style="font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};margin:22px 0 0">${read.map((s) => esc(s)).join(' ')}</div>

${heading('Advertising', 'Triple Whale — spend and attribution')}
${adHtml}

${heading('Customers', 'new versus existing — organization and Meta')}
${custHtml}

${heading('Email and SMS', 'Klaviyo — owned channels')}
${ownedHtml}

${shape ? heading(kind === 'weekly' ? 'The week, day by day' : 'The window, week by week', 'BigCommerce revenue · Triple Whale spend') + shape.html : ''}

<div style="font-family:${FONT};font-size:11px;line-height:1.55;color:#9a9a9a;border-top:1px solid ${RULE};margin-top:30px;padding-top:14px">
Days run midnight to midnight in ${esc(tz)}, the same boundary the BigCommerce admin and Triple Whale use. A source that fails to answer reads &ldquo;unavailable&rdquo; and is never rendered as a zero.
Live view: <a href="https://lbl.fyi/app" style="color:${INK}">lbl.fyi/app</a>
</div>
</div></body></html>`;

  // ---- plain text ----
  const L = [];
  const pad = (s, n) => String(s).padEnd(n);
  L.push('LOOP BIO LABS — ' + win.title.toUpperCase());
  L.push(win.periodLabel);
  L.push(windowLine);
  L.push('Changes are against ' + win.compareLabel + '.');
  L.push('');
  const kvLine = (label, value, c) => ('  ' + pad(label, 22) + pad(value, 12) + (c ? changeText(c) : 'no comparison')).trimEnd();
  L.push(kvLine('Revenue', money(cur.revenue_cents), ch.revenue));
  L.push(kvLine('Ad spend', money(cur.spend_cents), ch.spend));
  L.push(kvLine('ROAS (Meta)', roasStr(cur.meta_roas), ch.roas));
  L.push(kvLine('Attributed revenue', money(cur.meta_attributed_cents), ch.attributed));
  L.push(kvLine('New customers', num(cur.new_customers), ch.newc));
  L.push(kvLine('Existing customers', num(cur.returning_customers), ch.existing));
  L.push(kvLine('Orders', num(cur.orders), ch.orders));
  L.push(kvLine('Average order', moneyExact(cur.aov_cents), ch.aov));
  L.push('');
  L.push(read.join(' '));
  L.push('');
  L.push('ADVERTISING — spend, attribution, ROAS');
  if (isNum(cur.spend_cents)) {
    const chans = (cur.channels && cur.channels.length) ? cur.channels
      : [{ channel: 'Meta', spend_cents: cur.spend_cents, attributed_revenue_cents: cur.meta_attributed_cents, attributed_orders: cur.meta_orders, roas: cur.meta_roas }];
    for (const c of chans) L.push('  ' + pad(c.channel, 12) + 'spend ' + pad(money(c.spend_cents), 12) + 'attributed ' + pad(money(c.attributed_revenue_cents), 12) + 'ROAS ' + roasStr(c.roas));
    L.push('    Spend is Triple Whale\'s blended Meta figure. Triple Whale has no per-account breakdown, so a Meta');
    L.push('    account not connected to it is absent rather than shown as missing — spend reads low, ROAS reads');
    L.push('    high. Treat ROAS as an upper bound until the connected accounts are reconciled.');
  } else L.push('  unavailable — nothing substituted');
  L.push('');
  L.push('CUSTOMERS — new versus existing');
  L.push('  ' + pad('Organization', 20) + num(cur.new_customers) + ' new · ' + num(cur.returning_customers) + ' existing');
  L.push('  ' + pad('Meta-attributed', 20) + (isNum(cur.meta_customers) ? num(cur.meta_customers) + ' buyers · new/existing not measurable' : 'unavailable'));
  L.push('    97.7% of first-time-buyer orders carry no attribution at all (126 of 129 in July) against 37.9% of');
  L.push('    repeat orders, so no channel can be credited with acquiring a new customer. Not zero — unmeasurable.')
  L.push('');
  L.push('EMAIL AND SMS — Klaviyo');
  if (isNum(cur.email_cents)) {
    L.push('  ' + pad('Email', 12) + money(cur.email_cents) + ' · ' + plural(cur.email_orders, 'order', 'orders'));
    L.push('  ' + pad('SMS', 12) + money(cur.sms_cents) + ' · ' + plural(cur.sms_orders, 'order', 'orders'));
  } else L.push('  unavailable');
  if (shape) {
    L.push('');
    L.push((kind === 'weekly' ? 'THE WEEK, DAY BY DAY' : 'THE WINDOW, WEEK BY WEEK') + ' — orders · revenue · ad spend');
    for (const r of shape.rows) L.push('  ' + pad(r[0], 18) + pad(r[1], 8) + pad(r[2], 12) + pad(r[3], 12) + r[4]);
  }
  L.push('');
  L.push('Days run midnight to midnight in ' + tz + '. A failed source reads "unavailable", never zero.');
  L.push('Live view: https://lbl.fyi/app');
  // No signature — see the note in the HTML template above.
  const text = L.join('\n');

  const tag = kind === 'daily' ? 'daily' : kind === 'weekly' ? 'weekly' : (win.closed ? 'monthly (closed)' : 'monthly to date');
  const subject = 'LBL ' + tag + ' · ' + win.periodLabel + ' · ' +
    compact(cur.revenue_cents) + ' rev · ' + compact(cur.spend_cents) + ' spend · ' +
    roasStr(cur.meta_roas) + ' ROAS · ' +
    // "unavailable new / unavailable existing" is true but reads like a stutter in an inbox list.
    // When the split is missing the subject says so once, in words.
    ((isNum(cur.new_customers) || isNum(cur.returning_customers))
      ? num(cur.new_customers) + ' new / ' + num(cur.returning_customers) + ' existing'
      : 'customer split unavailable');

  return {
    ok: true, kind, subject, text, html,
    window: { from: win.from, to: win.to, compared_from: comparedFrom, compared_to: comparedTo, label: win.periodLabel, timezone: tz },
    metrics: cur,
    // The review travels with the report. A caller that sends without reading headline_failures
    // is doing the exact thing this exists to prevent, so sendLblReport refuses on it.
    review: { failures: allFailures, headline_failures: review.headlineFailures, withheld: [...suppress] },
  };
}

// ---- recipients + send -----------------------------------------------------------
async function recipients(env) {
  let raw = '';
  try {
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key='lbl_daily_recipients'").first();
    raw = (row && row.value) || '';
  } catch { /* fall through to the owner-only default */ }
  const list = String(raw || '[OWNER_EMAIL]').split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : ['[OWNER_EMAIL]'];
}

export async function sendLblReport(env, kindArg, modeArg, opts) {
  const mode = String(modeArg || '').trim().toLowerCase();
  const kind = String(kindArg || 'daily').trim().toLowerCase();

  // Weekly and monthly are wired to a daily tick, so the calendar gate lives here where it is
  // testable, not in a cron expression nobody can run. 'force' overrides it for a manual send.
  if (mode !== 'force' && mode !== 'dry' && !(opts && opts.ignoreCalendar)) {
    let today = (opts && opts.today) || null;
    if (!today) {
      try {
        const r = await fetch(API + '/v1/today', { headers: { 'x-sync-key': env.LBL_SYNC_KEY || '' } });
        const j = await r.json();
        today = j && j.meta && j.meta.date;
      } catch { today = null; }
    }
    if (today) {
      if (kind === 'weekly' && dowMon0(today) !== 0) return { ok: true, skipped: 'weekly recap sends on Mondays; today is not one', today };
      if (kind === 'monthly' && today !== monthStartOf(today)) return { ok: true, skipped: 'close-of-month recap sends on the 1st; today is not one', today };
    }
  }

  const composed = await composeLblReport(env, kind, opts);
  if (!composed.ok) return composed;

  // A headline figure that failed its plausibility check stops the send. Nothing about this is
  // overridable by mode=force: force exists to bypass the calendar, never the review. A report
  // nobody receives costs one morning; a confident wrong number costs whatever the team does
  // with it before somebody notices.
  const headline = (composed.review && composed.review.headline_failures) || [];
  if (headline.length) {
    return {
      ok: false,
      error: 'refused_by_plausibility_review',
      kind,
      window: composed.window,
      failures: headline,
      what_this_means: 'One or more headline figures did not survive the business-plausibility pass, so nothing was sent. Fix the data path; do not relax the check.',
    };
  }

  const toList = await recipients(env);
  if (mode === 'dry') return { ...composed, to: toList, html_bytes: composed.html.length, sent: false };

  // ONE MESSAGE ADDRESSED TO THE WHOLE LIST, not one message per person.
  //
  // This used to loop and send N separate emails. That was harmless while the list was one person
  // and became a defect the moment it was not: the owner-BCC law rides every send, so a six-person
  // team list would have put six copies of the same report in the owner's inbox every night. The
  // Cloudflare Email binding takes up to fifty combined to/cc/bcc recipients, which is far above
  // any team this reports to.
  //
  // The team is on `to` rather than `bcc` deliberately — everyone reading it can see who else got
  // it, which is what an internal operating report should show. This is not outreach; there is no
  // list to protect.
  let status = 0, resp = '';
  try {
    const r = await fetch('https://miscsubjects.com/api/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY },
      body: JSON.stringify({
        to: toList, subject: composed.subject, text: composed.text, html: composed.html,
        from: 'build@miscsubjects.com', from_name: 'Loop Bio Labs — ' + kind + ' report',
        reply_to: 'build@miscsubjects.com',
      }),
    });
    status = r.status; resp = (await r.text()).slice(0, 200);
  } catch (e) { resp = 'fetch: ' + ((e && e.message) || e); }
  const sent = [{ to: toList, status, resp }];
  return { ok: status === 200, kind, subject: composed.subject, window: composed.window, sent };
}
