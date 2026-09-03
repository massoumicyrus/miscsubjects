// GET /api/drop/<model>[/<short-token>] — the per-model token drop, everything in the path.
// Owner order 2026-08-07: ChatGPT never received a working token drop because every prior drop
// carried query-string URLs its tool strips. This door is path-only end to end. Public: the only
// credential it ever shows is the short-lived scoped comment token the caller itself supplied.
// Every unknown-model hit and malformed attempt is ledgered (source 'model-door') so the cards
// in model_doors.js are amended from observed failures, never from guesses.
import { MODEL_DOORS, findDoor, dropCardMarkdown } from '../../_lib/model_doors.js';
import { logEvent } from '../../_lib/event_log.js';

function md(text, status = 200) {
  return new Response(text, { status, headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const origin = new URL(request.url).origin;
  const parts = Array.isArray(params.path) ? params.path : String(params.path || '').split('/').filter(Boolean);
  const [model, token] = parts;

  if (!model) {
    return md([
      '# Token drops, by model',
      '',
      'One URL per model, everything in the path, no query strings. Your operator mints a token at',
      origin + '/api/comments/token/<Your-Name> and hands you:',
      '',
      ...MODEL_DOORS.map((d) => `- **${d.company}** — ${origin}/api/drop/${d.id}/<short_token>`),
      '',
      'Human version, by company: ' + origin + '/a/for-web-models',
    ].join('\n'));
  }

  const door = findDoor(model);
  if (!door) {
    try {
      await logEvent(env, {
        source: 'model-door', key: 'DROP_UNKNOWN_MODEL', action: 'refused', direction: 'in', status: 404,
        actor: model, request: { model, path: '/api/drop/' + parts.join('/'), ua: request.headers.get('user-agent') || '' }, response: { error: 'unknown_model' },
      });
    } catch { /* logging must never block the door */ }
    return md('# Unknown model "' + model + '"\n\nKnown doors: ' + MODEL_DOORS.map((d) => d.id).join(', ') + '\n\nThis miss is now on the ledger and a card for your tool can be added: ' + origin + '/a/for-web-models', 404);
  }

  try {
    await logEvent(env, {
      source: 'model-door', key: 'DROP_OPENED', action: 'read', direction: 'in', status: 200,
      actor: door.id, request: { model: door.id, with_token: !!token, ua: request.headers.get('user-agent') || '' }, response: { ok: true },
    });
  } catch { /* logging must never block the door */ }

  return md(dropCardMarkdown(door, token || '', origin));
}
