// POST /api/lbl/ask — ask a question about Loop Bio Labs commercial performance.
// Body: { "question": "how did we do yesterday?", "facts_only": false }
// Gated by x-terminal-key.
//
// facts_only returns the assembled fact sheet with no model call, which is how you check what
// the model was allowed to see when an answer looks wrong.
import { answerLblQuestion, buildFactSheet } from '../../_lib/lbl_ask.js';

export async function onRequestPost({ request, env }) {
  const key = request.headers.get('x-terminal-key') || '';
  if (!env.TERMINAL_KEY || key !== env.TERMINAL_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  let body = {};
  try { body = await request.json(); } catch { /* empty */ }
  const out = body.facts_only
    ? await buildFactSheet(env)
    : await answerLblQuestion(env, body.question);
  return new Response(JSON.stringify(out, null, 2), {
    status: out.ok ? 200 : 502,
    headers: { 'content-type': 'application/json' },
  });
}
