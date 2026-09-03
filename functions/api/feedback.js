import { scrubOwnerIdentity } from '../_lib/public_secret_guard.js';
// Public feedback endpoint — writes a row to the ledger events table.
// Cloaked by JCI on the way in (the cloaker tells us who sent it).
export async function onRequest({ request, env }) {
  let body = {};
  try { body = await request.json(); } catch(e) { body = {}; }
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = request.headers.get('user-agent') || '';
  const kind = (body.kind || '').toString().slice(0,4);
  const slug = (body.slug || '').toString().slice(0,120);
  const title = (body.title || '').toString().slice(0,200);
  const text = (body.text || '').toString().slice(0,4000);
  const href = (body.href || '').toString().slice(0,400);
  const preview = 'kind=' + kind + ' slug=' + slug + ' text=' + text.slice(0,200);
  try {
    if (env.LEDGER) {
      await env.LEDGER.prepare(
        "INSERT INTO events (ts, source, key, route, actor, action, status, request_preview, response_preview) VALUES (?,?,?,?,?,?,?,?,?)"
      ).bind(
        new Date().toISOString(), 'feedback', 'public_feedback', '/api/feedback',
        scrubOwnerIdentity(ip), kind, 'ok', scrubOwnerIdentity(preview), 'received'
      ).run();
    }
  } catch(e) { /* ledger write best-effort */ }
  // also persist into D1 if a feedback table exists
  try {
    if (env.DB) {
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, kind TEXT, slug TEXT, title TEXT, text TEXT, href TEXT, ip TEXT, ua TEXT)"
      ).run();
      await env.DB.prepare(
        "INSERT INTO feedback (ts, kind, slug, title, text, href, ip, ua) VALUES (?,?,?,?,?,?,?,?)"
      ).bind(new Date().toISOString(), kind, slug, title, text, href, ip, ua).run();
    }
  } catch(e) { /* best-effort */ }
  return new Response(JSON.stringify({ok:true}), {headers:{'content-type':'application/json'}});
}
