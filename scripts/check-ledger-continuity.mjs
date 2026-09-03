#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const ledger = read('functions/admin/ledger/index.js');
const eventView = read('functions/_lib/ledger_event_view.js');
const agentLog = read('functions/_lib/agent_turn_log.js');
const agentApi = read('functions/api/agent_log.js');
const hook = read('hooks/codex-turn-log.js');
const hookCommon = read('hooks/_lib/agent-turn-common.js');
const hookConfig = JSON.parse(read('.codex/hooks.json'));

const checks = [
  ['CODEX_LEDGER_SOURCE_CANONICAL', agentLog.includes("if (agent === 'codex') return 'codex-cli'")],
  ['CODEX_EVENT_TIME_PRESERVED', agentLog.includes('String(rec.ts || buildNowIso())')],
  ['CODEX_CONTENT_DEDUPE', agentLog.includes('user_input_sha256 = ? AND assistant_sha256 = ?')],
  ['CODEX_EVENT_LABEL', eventView.includes("if (src === 'codex-cli' || src === 'cli-codex') return 'codex-cli'")],
  ['CODEX_EVENT_FILTER', eventView.includes("if (L === 'codex-cli')") && eventView.includes("['codex-cli', 'cli-codex']")],
  ['CODEX_CARD_FILTER', eventView.includes("svc === 'codex-cli'") && eventView.includes("actor === 'codex'")],
  ['CODEX_LEDGER_UI_MAPPING', ledger.includes("if (s === 'codex-cli' || s === 'cli-codex') return 'codex-cli'")],
  ['CODEX_LEDGER_UI_FALLBACK', ledger.includes("if (a === 'codex') return 'codex-cli'")],
  ['CODEX_LEDGER_UI_PINNED', ledger.includes("['codex-cli', 'claude-cli', 'grok-cli', 'kimi-cli', 'misc-cli', 'grok API']")],
  ['CODEX_HOOK_MODERN_TOOL_EVENTS', hook.includes("p.type === 'custom_tool_call' || p.type === 'function_call'")],
  ['CODEX_HOOK_BACKFILL', hook.includes("process.argv.includes('--backfill')")],
  ['CODEX_HOOK_RETRIES_FAILED_POST', hook.includes('if (postRecord(record))') && !hook.includes('markDone(dedup, sessionId, record.turn_key);\nsaveDedup')],
  ['AGENT_POST_FAILURE_VISIBLE', hookCommon.includes('curl --fail-with-body') && hookCommon.includes('return false')],
  ['AGENT_API_RECEIPT', agentApi.includes('deduped: !!out.deduped') && agentApi.includes('id: out.id || null')],
  ['CODEX_STOP_HOOK_INSTALLED', JSON.stringify(hookConfig).includes('/hooks/codex-turn-log.js')],
];

const failed = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(JSON.stringify({ ok: false, failed }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, codex_ingest: true, codex_dual_store: true, codex_ui_lens: true, failed_posts_retry: true, backfill: true }));
