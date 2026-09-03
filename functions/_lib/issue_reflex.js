// Issue reflex — detect build/code problems, spawn scoped CLI agents, return real diagnoses.
import { spawnCliAgent } from './cli_agent_spawn.js';

const BRIDGE = 'https://agent.<bridge-domain>/exec';
const REFLEX_SCRIPT = '/Users/owner/miscsubjects-pages/hooks/issue-reflex.sh';
const DEFAULT_CWD = '/Users/owner/miscsubjects-pages';
const OWNER = '[OWNER_PHONE]';
const DEDUP_TTL = 86400;
const SYNC_TIMEOUT_BLOOIO = 120000;
const SYNC_TIMEOUT_SELFTEST = 90000;
const ASYNC_SPAWN_BRIDGE_MS = 15000;

function normPhone(p) { return String(p || '').replace(/\D/g, ''); }
export function isOwnerPhone(p) { return normPhone(p) === normPhone(OWNER); }

export function fingerprintText(s, max = 160) {
  const t = String(s || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, max);
  let h = 0;
  for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0;
  return 'fp_' + Math.abs(h).toString(36);
}

export function shouldEscalateToCodingAgents(text, opts = {}) {
  if (opts.isSelftest) return false;
  if (opts.isOwner === false) return false;
  const t = String(text || '').trim();
  if (t.length < 12) return false;
  if (/^(yes|no|ok|thanks|thx|cool|got it)$/i.test(t)) return false;
  if (/^reaction:\s*(approve|emoji)\b/i.test(t)) return false;

  const BUILD = /(selftest|self-test|blooio|dispatch\.js|functions\/|router|middleware|agent_turn|cli.?spawn|cli.?group|deploy|wrangler|ledger|webhook|the build|build is|build('|')?s|coding agent|ask (kimi|claude|codex|gemini|grok)|audit .+\.js|fix the|broken|failing|not working|silent fail|floating promise|death.?spiral|hook|\/admin\/|miscsubjects-pages|god mode|reflex)/i;
  const COMPLEX = /(audit|architecture|end-to-end|refactor|debug|root cause|race condition|why (is|does|isn'?t)|how do (we|i) fix|shitting the bed|dumb)/i;
  const DELEGATE = /(ask claude|ask kimi|open a ticket|coding agent|cli_spawn|cli_group)/i;
  const REACTION_BAD = /^reaction:\s*(reject|disappointed|urgent|amused)\b/i;

  if (REACTION_BAD.test(t)) return true;
  if (DELEGATE.test(t)) return true;
  if (BUILD.test(t)) return true;
  if (COMPLEX.test(t) && t.length >= 45) return true;
  return false;
}

export function wordBriefForCodingAgents(text, ctx = {}) {
  const trace = ctx.trace_id ? `Trace: ${ctx.trace_id}\n` : '';
  const src = ctx.source || 'blooio';
  return `${trace}Source: ${src} — coding agent diagnosis (readonly).

Read only the minimal files needed. No repo-wide audit.

User message:
${String(text).slice(0, 1400)}

Reply format (plain text, no markdown):
1. Root cause — 2-3 sentences
2. Top 3 fixes — file path + exact change each
3. Verify — one selftest question or curl command`;
}

export function buildSelftestReflexBrief(fail, runId) {
  const q = String(fail.q || fail.args || '').slice(0, 500);
  const actual = String(fail.actual || fail.last_actual || '').slice(0, 450);
  const reason = String(fail.reason || 'fail').slice(0, 80);
  const tier = fail.tier != null ? `Tier ${fail.tier}. ` : '';
  const files = inferFilesFromQuestion(q);
  return `Selftest FAIL — coding agent diagnosis (readonly, scoped)

Run: ${runId}
Test #${fail.id}: ${q}
${tier}Fail reason: ${reason}
Router output (excerpt): ${actual}
Expect: ${fail.expect || fail.expect_value || 'reply_ok'}

Read only: ${files.join(', ') || 'files implied by the question'}.

Reply format:
1. Root cause
2. Top 3 fixes (file + change)
3. Should ROUTER delegate via CLI_SPAWN/CLI_REFLEX? If yes, exact dispatch tag.`;
}

function inferFilesFromQuestion(q) {
  const s = String(q || '').toLowerCase();
  const out = [];
  if (/blooio/.test(s)) out.push('functions/blooio.js');
  if (/dispatch/.test(s)) out.push('functions/api/dispatch.js');
  if (/selftest|self-test/.test(s)) out.push('functions/api/selftest.js');
  if (/router/.test(s)) out.push('directory ROUTER row', 'functions/api/dispatch.js');
  if (/ledger/.test(s)) out.push('functions/api/ledger', 'functions/_lib/event_log.js');
  if (/middleware|cloaker/.test(s)) out.push('functions/_middleware.js', 'functions/_lib/cloak.js');
  if (/agent_turn/.test(s)) out.push('functions/_lib/agent_turn_log.js', 'hooks/*-turn-log.js');
  if (/hook/.test(s)) out.push('functions/blooio.js', 'functions/_lib/webhook_intake.js');
  return [...new Set(out)];
}

/** Strip spawn metadata; return the agent's actual answer text. */
export function extractAgentDiagnosis(stdout) {
  let t = String(stdout || '');
  t = t.replace(/^AGENT_SPAWN_JSON:[^\n]*\n?/gm, '');
  t = t.replace(/To resume this session:[^\n]*\n?/gi, '');
  t = t.replace(/^Launched [^\n]*\n?/gm, '');
  const parts = t.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+[\).\]:]/m.test(parts[i]) || (parts[i].length > 60 && !/^•/.test(parts[i]))) {
      return parts[i].slice(0, 3200);
    }
  }
  const stripped = t.replace(/^•[^\n]*\n+/gm, '').trim();
  return stripped.slice(0, 3200) || t.trim().slice(0, 3200);
}

export async function reflexDeduped(env, fingerprint) {
  if (!env?.KV || !fingerprint) return false;
  const k = 'reflex:dedup:' + fingerprint;
  try {
    if (await env.KV.get(k)) return true;
    await env.KV.put(k, String(Date.now()), { expirationTtl: DEDUP_TTL });
  } catch {}
  return false;
}

export async function cacheReflexAnswer(env, fingerprint, diagnosis) {
  if (!env?.KV || !fingerprint || !diagnosis) return;
  try {
    await env.KV.put('reflex:answer:' + fingerprint, String(diagnosis).slice(0, 8000), { expirationTtl: DEDUP_TTL });
  } catch {}
}

async function getCachedReflexAnswer(env, fingerprint) {
  if (!env?.KV || !fingerprint) return null;
  try { return await env.KV.get('reflex:answer:' + fingerprint); } catch { return null; }
}

/** Synchronous headless spawn — wait for real agent output. */
export async function runSyncReflexDiagnosis(env, opts = {}) {
  const { brief, agent = 'kimi', trace_id, timeout_ms = SYNC_TIMEOUT_BLOOIO, cwd } = opts;
  const spawned = await spawnCliAgent(env, {
    agent,
    prompt: brief,
    cwd: cwd || DEFAULT_CWD,
    mode: 'readonly',
    delivery: 'headless',
    trace_id,
    timeout_ms,
  });
  const diagnosis = extractAgentDiagnosis(spawned.stdout);
  return { ...spawned, diagnosis, sync_agent: agent };
}

/** Background full team (fire-and-forget ack). */
export async function triggerIssueReflex(env, opts = {}) {
  const {
    brief, fingerprint, agents = 'kimi,codex', mode = 'readonly', delivery = 'headless',
    trace_id, source = 'reflex', cwd,
  } = opts;
  if (!brief || !String(brief).trim()) throw new Error('brief required');
  if (fingerprint && await reflexDeduped(env, fingerprint)) {
    return { ok: true, skipped: true, reason: 'dedup', fingerprint, source };
  }
  const headers = { 'content-type': 'application/json' };
  if (env?.TERMINAL_KEY) headers['x-terminal-key'] = env.TERMINAL_KEY;
  if (trace_id) headers['x-trace-id'] = String(trace_id);
  const body = {
    cmd: 'bash',
    args: [REFLEX_SCRIPT, source, agents, cwd || DEFAULT_CWD, mode, delivery],
    cwd: cwd || DEFAULT_CWD,
    stdin: String(brief),
    timeout: 60000,
    trace_id: trace_id || undefined,
  };
  const resp = await fetch(BRIDGE, { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await resp.json().catch(() => ({}));
  const text = String(j.stdout || '') + '\n' + String(j.stderr || '');
  let meta = null;
  const line = text.split('\n').reverse().find((l) => l.includes('REFLEX_JSON:'));
  if (line) { try { meta = JSON.parse(line.replace(/^.*REFLEX_JSON:/, '')); } catch {} }
  return {
    ok: !!j.ok || !!meta?.ok,
    skipped: false,
    source,
    fingerprint: fingerprint || null,
    reflex: meta,
    stdout: String(j.stdout || '').slice(0, 8000),
    duration_ms: j.duration_ms,
  };
}

export function formatReflexReplyForBlooio(reflex) {
  if (!reflex) return '';
  if (reflex.diagnosis) {
    const agent = reflex.sync_agent || 'kimi';
    let msg = `${agent} (readonly):\n\n${reflex.diagnosis}`;
    if (reflex.cached) msg = `(cached diagnosis)\n\n${msg}`;
    else if (reflex.async_team) msg += '\n\n— kimi+codex team also running in background for second opinions.';
    return msg.slice(0, 3200);
  }
  if (reflex.skipped) return 'Already ran coding agents on this exact issue in the last 24h — no new spawn.';
  return 'Coding agent timed out before finishing. Retry or check ~/.miscsubjects/reflex/ on the Mac.';
}

/** Selftest failures — sync diagnosis on worst fail, async team for depth. */
export async function reflexSelftestFailures(env, runId, opts = {}) {
  const max = Math.min(parseInt(opts.max || '2', 10) || 2, 3);
  let rows = [];
  try {
    const r = await env.DB.prepare(
      "SELECT id, tier, args, expect_value, last_actual, note FROM directory_tests WHERE kind='e2e' AND last_run_id=? AND last_passed=0 ORDER BY tier DESC, id LIMIT ?"
    ).bind(runId, max).all();
    rows = r.results || [];
  } catch { return { ok: false, error: 'db' }; }
  if (!rows.length) return { ok: true, spawned: 0 };

  const out = [];
  let primaryDiagnosis = null;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const reason = inferReasonFromActual(row.last_actual);
    const fp = `selftest:${runId}:t${row.id}:${reason}`;
    const agents = (row.tier >= 7) ? 'kimi,codex,gemini' : 'kimi,codex';
    const brief = buildSelftestReflexBrief({ ...row, q: row.args, expect: row.expect_value, actual: row.last_actual, reason }, runId);

    if (i === 0) {
      const sync = await runSyncReflexDiagnosis(env, { brief, trace_id: runId, timeout_ms: SYNC_TIMEOUT_SELFTEST });
      primaryDiagnosis = sync.diagnosis || null;
      if (primaryDiagnosis) await cacheReflexAnswer(env, fp, primaryDiagnosis);
      out.push({ test_id: row.id, tier: row.tier, sync: true, diagnosis: primaryDiagnosis, agent: sync.sync_agent, session: sync.session });
      triggerIssueReflex(env, { brief, fingerprint: null, agents, trace_id: runId, source: 'selftest-async' }).catch(() => {});
    } else {
      const r = await triggerIssueReflex(env, { brief, fingerprint: fp, agents, trace_id: runId, source: 'selftest' });
      out.push({ test_id: row.id, tier: row.tier, sync: false, ...r });
    }
  }

  if (primaryDiagnosis && env?.KV) {
    try {
      await env.KV.put('reflex:selftest:' + runId, primaryDiagnosis.slice(0, 8000), { expirationTtl: 604800 });
    } catch {}
  }

  return { ok: true, spawned: out.length, diagnosis: primaryDiagnosis, results: out, run_id: runId };
}

function inferReasonFromActual(actual) {
  const a = String(actual || '');
  if (/DELIVERY FAILED/i.test(a)) return 'delivery';
  if (/ERR[:_]/i.test(a)) return 'error';
  if (/generic-grok|i am grok|don't have access/i.test(a)) return 'generic';
  if (a.length < 20) return 'empty';
  return 'fail';
}

/** Fast path: should we reflex, cache hit, brief — no spawn wait. */
export async function prepareBlooioReflex(env, { from, text, trace_id }) {
  if (!isOwnerPhone(from)) return null;
  if (/^TEST\s+\d+\//i.test(String(text || ''))) return null;
  if (!shouldEscalateToCodingAgents(text, { isOwner: true })) return null;

  const fp = 'blooio:' + fingerprintText(text);
  if (await reflexDeduped(env, fp)) {
    const cached = await getCachedReflexAnswer(env, fp);
    return { ok: true, skipped: true, cached: true, diagnosis: cached, fingerprint: fp, sync_agent: 'kimi' };
  }

  const brief = wordBriefForCodingAgents(text, { source: 'blooio', trace_id });
  return { ok: true, brief, fingerprint: fp, trace_id, sync_agent: 'kimi' };
}

/** Fire async headless Kimi — bridge returns in <15s; deliver poller reads log_file. */
export async function startAsyncReflexDiagnosis(env, prep) {
  const spawned = await spawnCliAgent(env, {
    agent: prep.sync_agent || 'kimi',
    prompt: prep.brief,
    cwd: DEFAULT_CWD,
    mode: 'readonly',
    delivery: 'async',
    trace_id: prep.trace_id,
    timeout_ms: ASYNC_SPAWN_BRIDGE_MS,
  });
  const logFile = spawned.spawn?.log_file || null;
  triggerIssueReflex(env, {
    brief: prep.brief, fingerprint: null, agents: 'kimi,codex', trace_id: prep.trace_id, source: 'blooio-async',
  }).catch(() => {});
  return {
    ok: !!spawned.ok,
    log_file: logFile,
    run_id: spawned.spawn?.run_id || null,
    sync_agent: prep.sync_agent || 'kimi',
    fingerprint: prep.fingerprint,
    status: spawned.status || 'running',
  };
}

/** Blooio owner build message → sync diagnosis (selftest/admin only; blooio uses async). */
export async function maybeEscalateBlooioMessage(env, { from, text, trace_id }) {
  const prep = await prepareBlooioReflex(env, { from, text, trace_id });
  if (!prep) return null;
  if (prep.diagnosis) return prep;
  const sync = await runSyncReflexDiagnosis(env, { brief: prep.brief, trace_id, timeout_ms: SYNC_TIMEOUT_BLOOIO });
  if (sync.diagnosis) await cacheReflexAnswer(env, prep.fingerprint, sync.diagnosis);
  triggerIssueReflex(env, {
    brief: prep.brief, fingerprint: null, agents: 'kimi,codex', trace_id, source: 'blooio-async',
  }).catch(() => {});
  return {
    ok: !!sync.ok,
    diagnosis: sync.diagnosis || null,
    sync_agent: sync.sync_agent,
    session: sync.session,
    async_team: true,
    fingerprint: prep.fingerprint,
  };
}