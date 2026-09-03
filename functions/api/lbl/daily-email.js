// POST /api/lbl/daily-email — the LBL daily report.
// Body: { "mode": "" | "dry" }  ('dry' returns the composed email without sending).
// Gated by x-terminal-key. The automation row LBL_DAILY_EMAIL fires this nightly.
//
// Kept as its own address because the nightly automation and the directory row point here.
// The composition it used to own moved to functions/_lib/lbl_report_email.js on 2026-08-07,
// where daily, weekly and monthly are one template family — the owner's order was that a
// report lead with spend, ROAS and new-versus-existing customers instead of a wall of prose.
import { sendLblReport } from '../../_lib/lbl_report_email.js';

export async function onRequestPost({ request, env }) {
  const key = request.headers.get('x-terminal-key') || '';
  if (!env.TERMINAL_KEY || key !== env.TERMINAL_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  let mode = '';
  try { mode = String((await request.json()).mode || ''); } catch { /* empty body = send */ }
  const out = await sendLblReport(env, 'daily', mode);
  return new Response(JSON.stringify(out, null, 2), { status: out.ok ? 200 : 502, headers: { 'content-type': 'application/json' } });
}
