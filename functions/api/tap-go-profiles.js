import { isBuildAuthed } from '../_lib/admin_session.js';
import { normalizeTapGoModel } from '../_lib/unified_handoff.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function onRequestGet(context) {
  const rows = (await context.env.DB.prepare('SELECT model,content,updated_at FROM tap_go_model_profiles ORDER BY model').all()).results || [];
  return json({ schema: 'tap-go-model-profiles/1.0', models: rows, mint_shape: 'GET /api/dispatch?tap_go=1&scope=read|act|row&key=KEY&model=chatgpt|claude|grok|gemini|kimi' });
}

export async function onRequestPut(context) {
  if (!(await isBuildAuthed(context.request, context.env))) return json({ error: 'owner authentication required' }, 401);
  const body = await context.request.json().catch(() => ({}));
  const model = normalizeTapGoModel(body.model);
  if (!model) return json({ error: 'model must be chatgpt|claude|grok|gemini|kimi' }, 400);
  const content = String(body.content || '').trim().slice(0, 20000);
  await context.env.DB.prepare("INSERT INTO tap_go_model_profiles(model,content,updated_at) VALUES (?,?,datetime('now')) ON CONFLICT(model) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at").bind(model, content).run();
  return json({ ok: true, model, content, mint_url: new URL(context.request.url).origin + '/api/dispatch?tap_go=1&scope=read&model=' + model });
}
