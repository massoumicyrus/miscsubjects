// Public browser page: the session behind a work object, rendered as state-card widgets.
import { loadTurns, verifyTurnsChain, renderTurnsPage } from '../_lib/work_turns.js';

export async function onRequestGet(context) {
  const raw = context.params?.path;
  const p = (Array.isArray(raw) ? raw.map(String) : String(raw || '').split('/')).filter(Boolean);
  const taskId = String(p[0] || '').toUpperCase();
  if (!/^WT-\d{4}$/.test(taskId)) return Response.redirect('https://miscsubjects.com/a/the-run-that-found-you', 302);
  const [turns, chain] = await Promise.all([loadTurns(context.env, taskId), verifyTurnsChain(context.env, taskId)]);
  return new Response(renderTurnsPage(taskId, turns, chain), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=30' } });
}
