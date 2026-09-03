// Receipts. Every turn and every tool call is posted to the build's ledger, and mirrored
// to ~/.misc/receipts.jsonl so a receipt survives even when the network does not.
import fs from 'node:fs';
import path from 'node:path';
import { HOME } from './config.js';

const FILE = path.join(HOME, 'receipts.jsonl');

// The ingest route authenticates with the terminal key, not the gateway token — posting
// with the wrong header silently 401'd, which is why nothing from misc appeared on the
// ledger. Read the key the same way the capability tool does.
function terminalKey() {
  if (process.env.MISC_DISPATCH_KEY) return process.env.MISC_DISPATCH_KEY;
  try {
    const env = fs.readFileSync(path.join(process.env.HOME, '.config', 'grok-bridge.env'), 'utf8');
    const m = env.match(/^TERMINAL_KEY=(.+)$/m);
    return m ? m[1].trim() : '';
  } catch { return ''; }
}

// A turn is not just an event. The turn cards ("I said · you said · you used") are built
// from the agent_turns table, which only /api/agent_log writes — so misc appeared nowhere
// in TURNS while its tool calls filled the chronology. Every turn is now posted there too,
// as its own agent, with the operator's words and the agent's answer.
export function agentTurn(cfg, row) {
  if (!cfg.ledger) return;
  const key = terminalKey();
  if (!key) return;
  const url = cfg.gateway.replace(/\/api\/aig$/, '') + '/api/agent_log';
  const post = fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-terminal-key': key },
    body: JSON.stringify({
      agent: 'misc',
      source: 'misc-cli',
      ts: new Date().toISOString(),
      session: row.session || '',
      trace_id: row.trace_id || ('misc_' + (row.session || '') + '_' + Date.now()),
      cwd: row.cwd || '',
      input_kind: 'prompt',
      user_input: row.said_user || '',
      assistant_text: row.said_agent || '',
      tools: String(row.tools_used || '').split(',').map((t) => t.trim()).filter(Boolean),
      model: cfg.model,
    }),
  }).catch(() => {});
  PENDING.add(post);
  post.finally(() => PENDING.delete(post));
}

export function receipt(cfg, row) {
  const line = { ts: new Date().toISOString(), model: cfg.model, surface: 'misc-cli', ...row };
  try {
    fs.mkdirSync(HOME, { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(line) + '\n');
  } catch {}
  if (!cfg.ledger) return;
  const key = terminalKey();
  if (!key) return;
  const url = cfg.gateway.replace(/\/api\/aig$/, '') + '/api/event_log_ingest';
  // The POST is tracked so it can be awaited. It used to be fire-and-forget, and a
  // headless or piped run called process.exit the moment the turn ended — killing the
  // in-flight request. Tool receipts landed (they happen mid-turn) but the TURN receipt,
  // the one carrying said_user and said_agent, did not, so misc vanished from the turn
  // cards while its tool calls kept appearing (2026-07-27).
  const post = fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-terminal-key': key },
    // surface names the service so the chronology and turn ledger show MISC-CLI rather
    // than folding every agent into "bridge"; said_user / said_agent fill the
    // "you said" and "agent said" columns of the turn ledger.
    body: JSON.stringify({
      kind: 'misc_' + (row.action || 'turn'),
      agent: 'misc',
      surface: 'misc-cli',
      said_user: row.said_user || row.user || '',
      said_agent: row.said_agent || row.answer || '',
      ...line,
    }),
  }).catch(() => {});
  PENDING.add(post);
  post.finally(() => PENDING.delete(post));
}

// Everything posted but not yet acknowledged. Awaited before the process exits so no
// receipt is lost to a fast exit.
const PENDING = new Set();

export async function flushReceipts(timeoutMs = 8000) {
  if (!PENDING.size) return 0;
  const n = PENDING.size;
  await Promise.race([
    Promise.allSettled([...PENDING]),
    new Promise((r) => setTimeout(r, timeoutMs)),
  ]);
  return n;
}
