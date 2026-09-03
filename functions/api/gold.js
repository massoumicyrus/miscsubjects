// GOLD API — one public, keyless snapshot of gold across every venue the build reads.
//   GET /api/gold                  -> live cross-venue snapshot + spread/premium math
//   GET /api/gold?series=1y        -> COMEX GC=F daily closes (1mo|3mo|1y|2y|5y|10y)
//   GET /api/gold?series=1y&sym=GLD-> any gold-linked ticker instead of the future
//
// Why this route exists: the GOLD_* directory rows are credentialed, so a public page
// cannot call them. This is the same fan-out with no key, cached at the edge so the
// upstream venues see one request per TTL rather than one per reader.
const EDGE_TTL_SEC = 60;
const UA = { 'user-agent': 'miscsubjects.com gold desk (contact: https://miscsubjects.com)', accept: 'application/json' };

function json(o, s = 200, ttl = EDGE_TTL_SEC) {
  return new Response(JSON.stringify(o, null, 2), {
    status: s,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'cache-control': `public, max-age=${ttl}`,
    },
  });
}

// A venue that is down must not take the page down with it, so every fetch is
// individually guarded and reports its own failure in place of a price.
async function grab(name, url, pick, opts = {}) {
  try {
    const r = await fetch(url, { headers: UA, ...opts });
    if (!r.ok) return { venue: name, ok: false, error: `HTTP ${r.status}` };
    const j = await r.json();
    const v = pick(j);
    if (!v || !isFinite(v.bid) || !isFinite(v.ask)) return { venue: name, ok: false, error: 'unparseable' };
    return { venue: name, ok: true, ...v };
  } catch (e) {
    return { venue: name, ok: false, error: String((e && e.message) || e) };
  }
}

const num = (x) => (x == null ? NaN : Number(x));

async function snapshot() {
  const [spot, kraken, okx, bitstamp, bitfinex, broker] = await Promise.all([
    grab('goldprice.dev spot', 'https://goldprice.dev/api/spot?symbol=XAU-USD-SPOT',
      (j) => (j && j.price ? { bid: num(j.price), ask: num(j.price), kind: 'reference', stale: !!j.is_stale } : null)),
    grab('Kraken PAXG/USD', 'https://api.kraken.com/0/public/Ticker?pair=PAXGUSD',
      (j) => { const k = j && j.result && j.result.PAXGUSD; return k ? { bid: num(k.b[0]), ask: num(k.a[0]), kind: 'token' } : null; }),
    grab('OKX PAXG/USDT', 'https://www.okx.com/api/v5/market/ticker?instId=PAXG-USDT',
      (j) => { const d = j && j.data && j.data[0]; return d ? { bid: num(d.bidPx), ask: num(d.askPx), kind: 'token' } : null; }),
    grab('Bitstamp PAXG/USD', 'https://www.bitstamp.net/api/v2/ticker/paxgusd/',
      (j) => (j && j.bid ? { bid: num(j.bid), ask: num(j.ask), kind: 'token' } : null)),
    grab('Bitfinex XAUT/USD', 'https://api-pub.bitfinex.com/v2/ticker/tXAUT:USD',
      (j) => (Array.isArray(j) && j.length > 6 ? { bid: num(j[0]), ask: num(j[2]), kind: 'token' } : null)),
    grab('FundedNext XAUUSD', 'https://fundednext.com/api/calculator/current-price?symbol=XAUUSD',
      (j) => { const d = j && j.data; return d ? { bid: num(d.bid), ask: num(d.ask), kind: 'cfd' } : null; }, { method: 'POST' }),
  ]);

  const venues = [spot, kraken, okx, bitstamp, bitfinex, broker];
  const ref = spot.ok ? spot.bid : null;

  for (const v of venues) {
    if (!v.ok) continue;
    v.mid = (v.bid + v.ask) / 2;
    v.spread_bps = v.ask ? Math.round(((v.ask - v.bid) / v.ask) * 10000 * 100) / 100 : null;
    v.premium_pct = ref ? Math.round((v.mid / ref - 1) * 10000) / 100 : null;
  }

  const live = venues.filter((v) => v.ok && v.kind !== 'reference');
  const mids = live.map((v) => v.mid).filter(isFinite);
  const dispersion_bps = mids.length > 1
    ? Math.round(((Math.max(...mids) - Math.min(...mids)) / Math.min(...mids)) * 10000 * 100) / 100
    : null;

  return {
    as_of: new Date().toISOString(),
    spot_usd_per_oz: ref,
    venues,
    venues_live: live.length,
    venues_down: venues.filter((v) => !v.ok).length,
    // The widest gap between any two tradeable venues. If this is smaller than the
    // tightest spread, there is no arbitrage to reach for.
    dispersion_bps,
    tightest_spread_bps: live.length ? Math.min(...live.map((v) => v.spread_bps).filter(isFinite)) : null,
    note: 'Reference price is a spot index, not a dealable quote. Token venues carry issuer credit risk; the CFD quote is a broker price, not an exchange price.',
  };
}

const RANGES = { '1mo': '1mo', '3mo': '3mo', '1y': '1y', '2y': '2y', '5y': '5y', '10y': '10y' };

async function series(range, symbol) {
  const sym = /^[A-Za-z0-9=.\-^]{1,12}$/.test(symbol) ? symbol : 'GC=F';
  const r = RANGES[range] || '1y';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=${r}`;
  const resp = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!resp.ok) return { error: `upstream HTTP ${resp.status}`, symbol: sym, range: r, points: [] };
  const j = await resp.json();
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  if (!res) return { error: 'no data', symbol: sym, range: r, points: [] };
  const ts = res.timestamp || [];
  const cl = (res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close) || [];
  const points = [];
  for (let i = 0; i < ts.length; i++) {
    if (cl[i] == null) continue;
    points.push([ts[i] * 1000, Math.round(cl[i] * 100) / 100]);
  }
  const closes = points.map((p) => p[1]);
  return {
    symbol: sym,
    exchange: (res.meta && res.meta.fullExchangeName) || null,
    currency: (res.meta && res.meta.currency) || 'USD',
    range: r,
    count: points.length,
    first: closes[0] ?? null,
    last: closes[closes.length - 1] ?? null,
    change_pct: closes.length > 1 ? Math.round((closes[closes.length - 1] / closes[0] - 1) * 10000) / 100 : null,
    points,
  };
}

export async function onRequestGet(context) {
  const { request } = context;
  const u = new URL(request.url);
  const cache = caches.default;
  const key = new Request(u.origin + u.pathname + u.search, { method: 'GET' });
  const hit = await cache.match(key);
  if (hit) { const h = new Response(hit.body, hit); h.headers.set('x-ms-cache', 'hit'); return h; }

  let out;
  if (u.searchParams.get('series')) {
    out = await series(u.searchParams.get('series'), u.searchParams.get('sym') || 'GC=F');
    out = { kind: 'series', ...out };
  } else {
    out = { kind: 'snapshot', ...(await snapshot()) };
  }
  const resp = json(out, 200, u.searchParams.get('series') ? 900 : EDGE_TTL_SEC);
  context.waitUntil(cache.put(key, resp.clone()));
  return resp;
}
