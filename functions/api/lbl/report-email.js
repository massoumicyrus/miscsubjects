// POST /api/lbl/report-email — compose and send an LBL commercial report.
// Body: { "kind": "daily"|"weekly"|"monthly", "mode": ""|"dry"|"force", "today": "YYYY-MM-DD" }
//   mode ""      send, but only if the calendar gate for that kind passes (weekly = Monday,
//                monthly = the 1st). Daily always passes.
//   mode "dry"   compose and return, never send.
//   mode "force" send regardless of the calendar gate.
//   today        override the store day, for verifying a template out of season.
// Gated by x-terminal-key. Composition lives in functions/_lib/lbl_report_email.js.
import { sendLblReport } from '../../_lib/lbl_report_email.js';

export async function onRequestPost({ request, env }) {
  const key = request.headers.get('x-terminal-key') || '';
  if (!env.TERMINAL_KEY || key !== env.TERMINAL_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  let body = {};
  try { body = await request.json(); } catch { /* empty body = daily send */ }
  const kind = String(body.kind || 'daily');
  const mode = String(body.mode || '');
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(body.today || '')) ? String(body.today) : null;
  const out = await sendLblReport(env, kind, mode, today ? { today } : undefined);
  const status = out.ok ? 200 : 502;
  return new Response(JSON.stringify(out, null, 2), { status, headers: { 'content-type': 'application/json' } });
}
