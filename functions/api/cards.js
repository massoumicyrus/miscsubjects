// MEMORY / STATE-CARDS API — one card per trace and per turn, each linked.
//   GET /api/cards              -> latest state cards (in/out, tools, reply) + link to detail
//   filters pass through: ?limit ?category ?actor ?q ?card_id
// Wraps the internal /admin/ledger?cards=1 builder and adds a stable link per card.
const BASE = 'https://miscsubjects.com';
function json(o, s = 200) { return new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } }); }

export async function onRequestGet(context) {
  const { request } = context;
  const u = new URL(request.url);
  const target = new URL(request.url);
  target.pathname = '/admin/ledger';
  target.searchParams.set('cards', '1');
  // carry through filters
  for (const k of ['limit', 'category', 'actor', 'q', 'card_id', 'source']) {
    const v = u.searchParams.get(k); if (v) target.searchParams.set(k, v);
  }
  let j;
  try {
    const resp = await fetch(target.toString(), { headers: { 'x-terminal-key': request.headers.get('x-terminal-key') || '' } });
    j = await resp.json();
  } catch (e) { return json({ error: String(e && e.message || e), count: 0, cards: [] }, 500); }
  const cards = (j.cards || []).map(c => ({
    ...c,
    link: `${BASE}/api/cards?card_id=${encodeURIComponent(c.card_id || '')}`,
    trace_link: c.card_id ? `${BASE}/api/events?trace_id=${encodeURIComponent(c.card_id)}` : null
  }));
  return json({ count: cards.length, cards, error: j.error });
}
