const TZ = 'America/Los_Angeles';

function fmtMoney(cents) {
  return '$' + (Number(cents || 0) / 100).toFixed(2);
}

function pstParts(ms) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date(ms));
  const pick = (t) => (parts.find((p) => p.type === t) || {}).value || '';
  return { y: pick('year'), m: pick('month'), d: pick('day'), wd: pick('weekday') };
}

function dayKey(ms) {
  const p = pstParts(ms);
  return p.y + '-' + p.m + '-' + p.d;
}

function mondayKey(ms) {
  const p = pstParts(ms);
  const d = new Date(ms);
  const wd = d.toLocaleString('en-US', { timeZone: TZ, weekday: 'short' });
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const n = map[wd] ?? 0;
  const back = (n + 6) % 7;
  const monday = new Date(ms - back * 86400000);
  return dayKey(monday.getTime());
}

function labelDay(key) {
  const [y, m, d] = key.split('-');
  return m + '/' + d + '/' + y;
}

async function stripeGet(env, path) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('no STRIPE_SECRET_KEY');
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    headers: { Authorization: 'Basic ' + btoa(String(env.STRIPE_SECRET_KEY) + ':') },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('stripe ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
  return j;
}

async function listCharges(env, limit = 100) {
  const j = await stripeGet(env, 'charges?limit=' + limit);
  return j.data || [];
}

export async function buildStripeSalesReport(env, opts = {}) {
  const now = opts.now ? new Date(opts.now) : new Date();
  const todayKey = dayKey(now.getTime());
  const wtdStartKey = mondayKey(now.getTime());

  const charges = await listCharges(env, 100);
  const today = { gross: 0, count: 0, failed: 0 };
  const wtd = { gross: 0, count: 0, failed: 0 };

  for (const ch of charges) {
    const ts = (ch.created || 0) * 1000;
    const dk = dayKey(ts);
    if (dk < wtdStartKey) continue;
    const gross = Number(ch.amount || 0);
    const ok = ch.status === 'succeeded' && ch.paid === true;
    if (ok) {
      wtd.gross += gross;
      wtd.count++;
      if (dk === todayKey) { today.gross += gross; today.count++; }
    } else if (ch.status === 'failed') {
      wtd.failed++;
      if (dk === todayKey) today.failed++;
    }
  }

  let balance = null;
  try {
    balance = await stripeGet(env, 'balance');
  } catch {}

  const avail = ((balance && balance.available) || []).find((x) => x.currency === 'usd');
  const pend = ((balance && balance.pending) || []).find((x) => x.currency === 'usd');

  const lines = [
    '📊 Stripe Daily — ' + labelDay(todayKey) + ' (PST)',
    '',
    'TODAY',
    '• Sales: ' + fmtMoney(today.gross) + ' (' + today.count + ' orders)',
    (today.failed ? '• Declined: ' + today.failed : null),
    '',
    'WTD (Mon–today)',
    '• Sales: ' + fmtMoney(wtd.gross) + ' (' + wtd.count + ' orders)',
    (wtd.failed ? '• Declined: ' + wtd.failed : null),
  ].filter(Boolean);

  if (avail || pend) {
    lines.push('', 'Balance', '• Available: ' + fmtMoney(avail && avail.amount), '• Pending: ' + fmtMoney(pend && pend.amount));
  }

  return {
    text: lines.join('\n'),
    today, wtd, todayKey, wtdStartKey,
    balance: { available: avail && avail.amount, pending: pend && pend.amount },
  };
}