// Backfill LEDGER turn_in/turn_out events for CLI agent_turns rows that never got ledger events.
// POST {agent?: 'grok'|'claude'|'kimi'|'kimi-desktop'|'codex'|'gemini', limit?: number}
import { syncCliTurnsToLedger } from '../_lib/agent_turn_log.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  let r = {};
  try { r = await request.json(); } catch {}
  try {
    const agents = r.agent ? [String(r.agent)] : ['grok', 'claude', 'kimi', 'kimi-desktop', 'codex', 'gemini'];
    const limit = r.limit;
    const out = [];
    for (const agent of agents) {
      out.push(await syncCliTurnsToLedger(env, { agent, limit }));
    }
    return j({ ok: true, results: out });
  } catch (e) { return j({ error: String(e && e.message || e) }, 500); }
}

function j(o, status) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json' } });
}
