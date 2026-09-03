import { buildReadAuthed } from '../_lib/admin_session.js';

export async function onRequestGet({ request, env }) {
  // Carry a share/terminal token forward so /admin?share=… doesn't strand a model on the
  // first hop — the entry URL must reach /admin/directory still authenticated.
  let q = '';
  try {
    const p = new URL(request.url).searchParams;
    const tok = p.get('share') || p.get('terminal_key') || p.get('tk');
    if (tok) {
      const name = p.get('share') ? 'share' : (p.get('terminal_key') ? 'terminal_key' : 'tk');
      q = '?' + name + '=' + encodeURIComponent(tok);
    }
  } catch {}
  const destination = '/admin/directory' + q;
  if (!(await buildReadAuthed(request, env))) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/admin/login?next=' + encodeURIComponent(destination) },
    });
  }
  return new Response(null, { status: 302, headers: { Location: destination } });
}
