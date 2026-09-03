// Text a question about the business, get an answer built only from numbers that have already
// survived the plausibility review.
//
// The failure this is designed around: on 2026-08-07 a report stated "Meta brought 38 buyers and
// 0 new customers" — arithmetic that was correct and an answer that was absurd. A model answering
// questions over SMS is the same failure with a shorter fuse and no proofreader, so nothing here
// lets the model near a raw figure. The fact sheet is assembled first, run through
// reviewReport, and any figure that fails is replaced by the word "unavailable" plus its reason
// BEFORE the model sees it. The model cannot quote a number that was never handed to it.
//
// The prompt lives in the directory row LBL_ANSWER, never in this file (MODEL_CALL_LAW).

import { reviewReport } from './lbl_report_sanity.js';

const API = 'https://api.lbl.fyi';

async function getJson(url, syncKey) {
  const r = await fetch(url, { headers: { 'x-sync-key': syncKey } });
  if (!r.ok) throw new Error(url.replace(API, '') + ' -> HTTP ' + r.status);
  return await r.json();
}

const dayMs = 86400000;
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * dayMs).toISOString().slice(0, 10);
const monthStartOf = (iso) => iso.slice(0, 8) + '01';
const dowMon0 = (iso) => (new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay() + 6) % 7;

const isNum = (v) => v != null && typeof v === 'number' && isFinite(v);
const money = (c) => (isNum(c) ? '$' + Math.round(c / 100).toLocaleString('en-US') : 'unavailable');
const num = (v) => (isNum(v) ? Math.round(v).toLocaleString('en-US') : 'unavailable');
const roas = (v) => (isNum(v) ? v.toFixed(2) + 'x' : 'unavailable');

function flatten(w) {
  if (!w) return null;
  const bc = w.bigcommerce || null, m = w.meta || null, kl = w.klaviyo || null, c = w.customers || null;
  return {
    revenue_cents: bc ? bc.gross_cents : null,
    orders: bc ? bc.orders : null,
    aov_cents: bc ? bc.aov_cents : null,
    refunds_cents: bc ? bc.refunds_cents : null,
    spend_cents: m ? m.ad_spend_cents : null,
    meta_attributed_cents: m ? m.meta_attributed_cents : null,
    meta_roas: m ? m.meta_roas : null,
    meta_orders: m ? m.orders : null,
    meta_customers: m ? m.customers : null,
    channels: (m && Array.isArray(m.channels)) ? m.channels : null,
    buyers: c ? c.buyers : null,
    new_customers: c ? c.new : null,
    returning_customers: c ? c.returning : null,
    email_cents: kl ? kl.email_cents : null,
    email_orders: kl ? kl.email_orders : null,
    sms_cents: kl ? kl.sms_cents : null,
    sms_orders: kl ? kl.sms_orders : null,
  };
}

// One window rendered as lines a model can only copy from. A figure that failed the review is
// replaced here, not flagged here — the model never receives the number at all.
function windowBlock(label, from, to, cur, review) {
  const withheld = new Set(review ? review.suppress : []);
  const f = (field, rendered) => (withheld.has(field) ? 'unavailable (failed plausibility review)' : rendered);
  const L = [];
  L.push(`## ${label}  (${from}${from === to ? '' : ' to ' + to})`);
  L.push(`revenue: ${f('revenue_cents', money(cur.revenue_cents))}`);
  L.push(`orders: ${f('orders', num(cur.orders))}`);
  L.push(`average order: ${f('aov_cents', money(cur.aov_cents))}`);
  L.push(`refunds: ${money(cur.refunds_cents)}`);
  // Triple Whale's connector started part-way through July, so an earlier window records a few
  // dollars of spend rather than nothing. Handed over bare, that reads as a real figure and an
  // answer came back saying "ad spend increased to $7,190 from $16" — a 450x rise that never
  // happened. Below the floor the window is labelled as unusable for comparison, in the same
  // words the model needs to refuse it.
  const spendUsable = isNum(cur.spend_cents) && cur.spend_cents >= 10000;
  L.push(`ad spend: ${f('spend_cents', money(cur.spend_cents))}`
    + (isNum(cur.spend_cents) && !spendUsable
      ? ' — ad reporting does not cover this window; this is NOT a usable comparison base for spend, attributed revenue or ROAS, and must not be described as a rise or a fall'
      : ''));
  L.push(`meta attributed revenue: ${f('meta_attributed_cents', money(cur.meta_attributed_cents))}`);
  L.push(`meta ROAS: ${f('meta_roas', roas(cur.meta_roas))}`);
  L.push(`new customers (organization): ${f('new_customers', num(cur.new_customers))}`);
  L.push(`existing customers (organization): ${f('returning_customers', num(cur.returning_customers))}`);
  L.push(`total buyers: ${num(cur.buyers)}`);
  L.push(`meta-attributed buyers: ${f('meta_orders', num(cur.meta_customers))}`);
  L.push('new vs existing split for meta specifically: not measurable — 97.7% of first-time-buyer orders carry no attribution at all against 37.9% of repeat orders, so no channel can be credited with acquiring a new customer');
  L.push(`email revenue: ${money(cur.email_cents)} across ${num(cur.email_orders)} orders`);
  L.push(`sms revenue: ${money(cur.sms_cents)} across ${num(cur.sms_orders)} orders`);
  if (cur.channels && cur.channels.length) {
    for (const c of cur.channels) {
      L.push(`channel ${c.channel}: spend ${money(c.spend_cents)}, attributed ${money(c.attributed_revenue_cents)}, ROAS ${roas(c.roas)}`);
    }
  }
  return L.join('\n');
}

// The sheet costs about twelve seconds of source pulls and is identical for every question
// asked in the same few minutes. Rebuilding it per question pushed a month-comparison question
// past the worker's resource limit and returned a bare 503. Cached briefly, a question costs
// only the answer. Five minutes is well inside the lag of every source feeding it, so nothing
// here is staler than the data itself.
const SHEET_CACHE_KEY = 'lbl:ask:factsheet';
const SHEET_CACHE_SECONDS = 300;

// Assemble every window a question is likely to be about, so one model call can answer
// "yesterday", "this week", "this month" or "versus last month" without a second round trip.
export async function buildFactSheet(env, opts) {
  const syncKey = env.LBL_SYNC_KEY || '';
  if (!syncKey) return { ok: false, error: 'LBL_SYNC_KEY missing' };

  const fresh = !!(opts && opts.fresh);
  if (!fresh && !(opts && opts.today) && env.KV) {
    try {
      const hit = await env.KV.get(SHEET_CACHE_KEY, 'json');
      if (hit && hit.ok && hit.sheet) return { ...hit, cached: true };
    } catch { /* a cache miss is never a reason to fail the answer */ }
  }
  const head = await getJson(API + '/v1/today', syncKey);
  const tz = String((head.meta && head.meta.store_timezone) || 'UTC');
  const today = (opts && opts.today) || (head.meta && head.meta.date);
  const yesterday = addDays(today, -1);
  const monStart = addDays(today, -dowMon0(today));
  const lastWeekFrom = addDays(monStart, -7), lastWeekTo = addDays(monStart, -1);
  const mStart = monthStartOf(today);
  const prevMonthEnd = addDays(mStart, -1), prevMonthStart = monthStartOf(prevMonthEnd);

  // "Are we up or down this month?" is the most natural question there is, and without a
  // like-for-like window it could not be answered: comparing seven days of August against all
  // of July is not a comparison. This is the same fair window the monthly report uses — the
  // first N days of last month, N being how far into this month we are.
  const mtdTo = yesterday >= mStart ? yesterday : mStart;
  const mtdDays = Math.round((Date.parse(mtdTo + 'T00:00:00Z') - Date.parse(mStart + 'T00:00:00Z')) / dayMs) + 1;
  const sameDaysLastMonthTo = addDays(prevMonthStart, mtdDays - 1);

  const windows = [
    ['Yesterday', yesterday, yesterday],
    ['The day before yesterday', addDays(yesterday, -1), addDays(yesterday, -1)],
    ['Last complete week (Monday to Sunday)', lastWeekFrom, lastWeekTo],
    ['The week before that', addDays(lastWeekFrom, -7), addDays(lastWeekFrom, -1)],
    ['This month so far', mStart, mtdTo],
    [`The same first ${mtdDays} days of last month (the fair comparison for "this month so far")`,
      prevMonthStart, sameDaysLastMonthTo > prevMonthEnd ? prevMonthEnd : sameDaysLastMonthTo],
    ['Last calendar month in full', prevMonthStart, prevMonthEnd],
  ];

  // All four windows at once. Fetched one after another this exceeded the request limit and a
  // month-versus-month question came back as a bare 502 — each window is its own pull across
  // BigCommerce, Triple Whale and Klaviyo, so four in series is four times the slowest source.
  // In parallel the whole sheet costs about one window.
  const settled = await Promise.all(windows.map(async ([label, from, to]) => {
    try {
      const r = await getJson(`${API}/v1/range?from=${from}&to=${to}`, syncKey);
      const cur = flatten(r.period);
      const metaChannel = (cur.channels || []).find((c) => /^meta$|^facebook/i.test(String(c.channel || ''))) || null;
      // Same review the emails run. A number that would not be allowed into a report is not
      // allowed into an answer either.
      const review = reviewReport({ ...cur, meta_new: null, meta_existing: null }, {
        external: { source_attributed_orders: metaChannel ? metaChannel.attributed_orders : null },
      });
      return { label, from, to, block: windowBlock(label, from, to, cur, review), metrics: cur, withheld: [...review.suppress] };
    } catch (e) {
      // One window failing says so in its own section rather than taking the answer down.
      return { label, from, to, block: `## ${label}  (${from} to ${to})\nunavailable — ${String((e && e.message) || e)}`, metrics: null, withheld: [] };
    }
  }));

  const blocks = settled.map((s) => s.block);
  const raw = {};
  for (const s of settled) raw[s.label] = { from: s.from, to: s.to, metrics: s.metrics, withheld: s.withheld };

  const sheet = [
    `Store: Loop Bio Labs. Today is ${today}. Days run midnight to midnight in ${tz}.`,
    'Revenue and orders come from BigCommerce. Ad spend and attribution come from Triple Whale. Email and SMS come from Klaviyo.',
    'A channel ROAS is that channel\'s own attributed revenue over its own spend. Store revenue divided by ad spend is a different measure and is not a ROAS.',
    '',
    blocks.join('\n\n'),
  ].join('\n');

  const out = { ok: true, today, timezone: tz, sheet, windows: raw };
  if (!(opts && opts.today) && env.KV) {
    try { await env.KV.put(SHEET_CACHE_KEY, JSON.stringify(out), { expirationTtl: SHEET_CACHE_SECONDS }); }
    catch { /* the answer does not depend on the write succeeding */ }
  }
  return out;
}

export async function answerLblQuestion(env, question, opts) {
  const q = String(question || '').trim();
  if (!q) return { ok: false, error: 'empty question' };
  if (q.length > 500) return { ok: false, error: 'question too long' };

  const facts = await buildFactSheet(env, opts);
  if (!facts.ok) return facts;

  // The answering model reasons before it writes, and that reasoning is billed against the same
  // budget as the reply. At 400 the budget ran out mid-thought on "are we up or down this
  // month?": the call succeeded, finish_reason came back "length", and the visible text was
  // empty — which reached the asker as the two-word fragment "This month". The reply itself is
  // capped by the prompt, not by this number, so the headroom costs nothing on a normal answer.
  const r = await fetch('https://miscsubjects.com/api/invoke', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.TERMINAL_KEY}` },
    body: JSON.stringify({
      key: 'LBL_ANSWER',
      input: `FACT SHEET\n${facts.sheet}\n\nQUESTION\n${q}`,
      max_tokens: 1500,
    }),
  });
  const status = r.status;
  let text = '';
  let finish = '';
  try {
    const j = await r.json();
    const res = j?.results?.[0];
    text = String(res?.text ?? j?.text ?? j?.output ?? '').trim();
    finish = String(res?.finish_reason ?? res?.stop_reason ?? '');
  } catch { text = ''; }

  // A half-sentence is worse than no answer: it reads like a statement about the business.
  // Nothing incomplete goes out — the caller says it could not answer and why.
  if (!text) {
    return { ok: false, error: finish === 'length' ? 'the answer did not fit in the model budget' : 'model returned nothing', status };
  }
  if (finish === 'length') {
    return { ok: false, error: 'the answer was cut off mid-sentence and was not sent', status, partial: text.slice(0, 200) };
  }

  return { ok: true, question: q, answer: text, today: facts.today, windows: facts.windows };
}
