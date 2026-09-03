const OWNER = '[OWNER_PHONE]';

function authed(request, env) {
  const a = request.headers.get('x-loop-auth') || '';
  return a === String(env.BLOOIO_API_KEY || ' ') || (env.DELIVER_TOKEN && a === String(env.DELIVER_TOKEN));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authed(request, env)) return new Response('forbidden', { status: 403 });
  if (env.KV) {
    try {
      if ((await env.KV.get('imessage_autorun')) !== '1' || (await env.KV.get('proactive_msgs')) !== '1') {
        return new Response(JSON.stringify({ skipped: true, reason: 'imessage_autorun or proactive_msgs off' }), { headers: { 'content-type': 'application/json' } });
      }
    } catch {}
  }
  const job = {
    from: OWNER, chat: OWNER, protocol: 'imessage', isGroup: 0, channel: 'blooio',
    messageBody: '[PROACTIVE check-in] Timer wake-up, not the owner. Review the conversation and the creative-deck mission. Decide: send him progress / start the next batch / ask one sharp question — or stay silent if he replied recently and nothing new is ready.',
    mediaUrls: [],
  };
  const r = await fetch('https://miscsubjects.com/api/turn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-loop-auth': env.BLOOIO_API_KEY || '' },
    body: JSON.stringify(job),
  }).catch(() => null);
  return new Response(JSON.stringify({ ok: !!r, status: r ? r.status : 'fetch_failed' }), { headers: { 'content-type': 'application/json' } });
}
