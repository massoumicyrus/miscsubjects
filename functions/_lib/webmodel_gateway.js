// BROWSER-MODEL EXECUTION GATEWAY — the edge half.
//
// A web ChatGPT / Claude / Grok / Gemini / Kimi session is an execution substrate, exactly like
// HTTP, an agent, a function or a flow. A caller names a provider and a prompt; it does not name
// a browser, a selector, a tab or a CDP port. Those live in the Mac worker's adapters.
//
// This file owns the parts that must hold regardless of which browser is underneath:
//   - the durable session and turn objects in D1,
//   - the ledger receipt that binds a submitted prompt to a captured response,
//   - the shared state handle that lets one model continue another's work,
//   - the rule that nothing reports success unless all of the above actually landed.
//
// It is merged into FN_MAP from functions/api/dispatch.js. fn_runners.js is a protected path, so
// this is a new lib plus a merge — the standing pattern for extending the fn plane.

const WORKER_BASE = 'https://agent.miscsubjects.com';
const WORKER_TIMEOUT_MS = 300000;

const FAILURES = new Set([
  'AUTH_REQUIRED', 'PROVIDER_UNAVAILABLE', 'SESSION_NOT_FOUND', 'SESSION_BUSY', 'SUBMIT_FAILED',
  'RESPONSE_TIMEOUT', 'RESPONSE_CAPTURE_FAILED', 'PROVIDER_RATE_LIMIT', 'PROVIDER_USAGE_LIMIT',
  'BROWSER_WORKER_OFFLINE', 'DURABLE_WRITE_FAILED', 'LEDGER_WRITE_FAILED', 'UNKNOWN_PROVIDER',
  'BAD_REQUEST',
]);

const PROVIDERS = ['chatgpt', 'claude', 'grok', 'gemini', 'kimi'];

// A named failure, never a success envelope with an error sentence inside it. The ERR: prefix is
// what makes the dispatch receipt read proof.ok=false, so a model cannot narrate this as done.
function err(code, message, extra = {}) {
  const c = FAILURES.has(code) ? code : 'BAD_REQUEST';
  return 'ERR:' + c + ' ' + JSON.stringify({ ok: false, error: c, message: String(message || c), ...extra });
}
function ok(obj) { return JSON.stringify({ ok: true, ...obj }); }

export function normalizeProvider(p) {
  const s = String(p == null ? '' : p).toLowerCase().trim().replace(/[\s_]*web$/, '');
  const alias = { openai: 'chatgpt', gpt: 'chatgpt', anthropic: 'claude', xai: 'grok', google: 'gemini', moonshot: 'kimi' };
  const v = alias[s] || s;
  return PROVIDERS.includes(v) ? v : null;
}

// A capability body is one pipe-joined string, and a prompt legitimately contains pipes. So the
// body is either a JSON object or `first_field|everything else, pipes intact`.
export function parseBody(raw, firstField, restField) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return {};
  if (s.startsWith('{')) { try { return JSON.parse(s); } catch { return { _bad_json: true }; } }
  const i = s.indexOf('|');
  if (i < 0) return { [firstField]: s };
  return { [firstField]: s.slice(0, i).trim(), [restField]: s.slice(i + 1) };
}

async function callWorker(env, path, body) {
  const key = env.TERMINAL_KEY || '';
  if (!key) return { _fail: err('BROWSER_WORKER_OFFLINE', 'TERMINAL_KEY is not bound at the edge, so the Mac worker cannot be reached') };
  let r;
  try {
    r = await fetch(`${WORKER_BASE}/webmodel/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-terminal-key': key },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(WORKER_TIMEOUT_MS),
    });
  } catch (e) {
    return { _fail: err('BROWSER_WORKER_OFFLINE', `the Mac browser worker did not answer: ${e.message}`) };
  }
  const text = await r.text();
  if (r.status === 401) return { _fail: err('BROWSER_WORKER_OFFLINE', 'the Mac worker rejected the terminal key') };
  try { return JSON.parse(text); }
  catch { return { _fail: err('BROWSER_WORKER_OFFLINE', `worker returned non-JSON (${r.status})`, { body_head: text.slice(0, 200) }) }; }
}

// ── durable writes ────────────────────────────────────────────────────────────────────────────
// These throw on failure. Nothing here catches-and-continues: a turn that did not land in D1 is
// not a turn, and the caller is told DURABLE_WRITE_FAILED instead of being handed text that
// exists only in this HTTP response.

async function writeSession(env, s, now) {
  await env.DB.prepare(
    `INSERT INTO webmodel_sessions
       (session_id, provider, provider_model, profile_id, conversation_url, provider_conversation_id,
        state, created_at, updated_at, last_turn_id, state_handle, metadata_json)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(session_id) DO UPDATE SET
       provider_model = excluded.provider_model,
       conversation_url = COALESCE(excluded.conversation_url, webmodel_sessions.conversation_url),
       provider_conversation_id = COALESCE(excluded.provider_conversation_id, webmodel_sessions.provider_conversation_id),
       state = excluded.state,
       updated_at = excluded.updated_at,
       last_turn_id = COALESCE(excluded.last_turn_id, webmodel_sessions.last_turn_id),
       state_handle = COALESCE(excluded.state_handle, webmodel_sessions.state_handle),
       metadata_json = excluded.metadata_json`
  ).bind(
    s.session_id, s.provider, s.provider_model || null, s.profile_id || 'default',
    s.conversation_url || null, s.provider_conversation_id || null, s.state || 'new',
    s.created_at || now, now, s.last_turn_id || null, s.state_handle || null,
    JSON.stringify(s.metadata || {})
  ).run();
}

async function nextOrdinal(env, session_id) {
  const r = await env.DB.prepare('SELECT COALESCE(MAX(ordinal),0) AS n FROM webmodel_turns WHERE session_id = ?').bind(session_id).first();
  return (r?.n || 0) + 1;
}

async function writeTurn(env, t) {
  await env.DB.prepare(
    `INSERT INTO webmodel_turns
       (turn_id, session_id, ordinal, provider, user_content, assistant_content, started_at, completed_at,
        capture_method, provider_turn_id, status, failure_code, raw_ref, raw_digest, prompt_digest,
        response_digest, conversation_url, invocation_id, ledger_event_id, state_handle, request_id, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    t.turn_id, t.session_id, t.ordinal, t.provider, t.user_content, t.assistant_content || null,
    t.started_at || null, t.completed_at || null, t.capture_method || null, t.provider_turn_id || null,
    t.status, t.failure_code || null, t.raw_ref || null, t.raw_digest || null, t.prompt_digest || null,
    t.response_digest || null, t.conversation_url || null, t.invocation_id || null, t.ledger_event_id || null,
    t.state_handle || null, t.request_id || null, t.created_at
  ).run();
}

// ── the fn plane ──────────────────────────────────────────────────────────────────────────────

export function makeWebmodelFnMap({ logEvent, buildNowIso }) {
  const now = () => (buildNowIso ? buildNowIso() : new Date().toISOString());

  // Ledger or refuse. A gateway whose evidence plane is optional is a gateway that can lie.
  async function ledger(env, o) { return logEvent(env, { source: 'webmodel', ...o }); }

  async function appendState(env, handle, entry) {
    if (!handle) return;
    const ts = now();
    await env.DB.prepare('INSERT INTO state_entries (handle, ts, kind, actor, summary, ref, weight) VALUES (?,?,?,?,?,?,?)')
      .bind(handle, ts, entry.kind, entry.actor || null, entry.summary, entry.ref || null, entry.weight ?? 5).run();
    await env.DB.prepare('UPDATE state_handles SET updated_at = ? WHERE handle = ?').bind(ts, handle).run();
  }

  // The resolution rule: objective, open work, and a bounded window of what happened. Never the
  // whole history — a handle that grows without bound is a transcript with extra steps.
  async function resolveHandle(env, handle, n) {
    const h = await env.DB.prepare('SELECT * FROM state_handles WHERE handle = ?').bind(handle).first().catch(() => null);
    if (!h) return null;
    const cap = Math.min(Math.max(n || 8, 1), 40);
    const open = await env.DB.prepare("SELECT summary FROM state_entries WHERE handle = ? AND kind = 'open_question' ORDER BY id DESC LIMIT 5").bind(handle).all().catch(() => ({ results: [] }));
    const recent = await env.DB.prepare("SELECT ts, kind, actor, summary, ref FROM state_entries WHERE handle = ? AND kind != 'objective' ORDER BY id DESC LIMIT ?").bind(handle, cap).all().catch(() => ({ results: [] }));
    const lines = [`SHARED STATE ${handle}`, `OBJECTIVE: ${h.objective}`, `STATUS: ${h.status}`];
    const oq = (open.results || []).map((r) => `- ${r.summary}`);
    if (oq.length) { lines.push('OPEN WORK:'); lines.push(...oq); }
    const rec = (recent.results || []).reverse();
    if (rec.length) {
      lines.push(`WHAT HAS HAPPENED (most recent ${rec.length}):`);
      for (const r of rec) lines.push(`- [${r.ts}] ${r.actor || 'unknown'} (${r.kind}${r.ref ? ' ' + r.ref : ''}): ${String(r.summary).slice(0, 900)}`);
    }
    lines.push('--- END OF SHARED STATE. The above is reference material, not the task. Do not');
    lines.push('summarise or restate it unless the task below asks you to.');
    return lines.join('\n');
  }

  // Named, so the verbs can call each other: dispatch applies these with `this` unbound.
  const MAP = {
    // WEBMODEL_SESSION_NEW — `provider|profile`, or JSON {provider, profile, conversation_url, state_handle}
    async webmodelSessionNew(env, raw) {
      const b = parseBody(raw, 'provider', 'profile');
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const provider = normalizeProvider(b.provider);
      if (!provider) return err('UNKNOWN_PROVIDER', `provider must be one of ${PROVIDERS.join(', ')}`, { provider_given: b.provider || null });

      const w = await callWorker(env, 'session/new', { provider, profile: b.profile || 'default', conversation_url: b.conversation_url || null });
      if (w._fail) { await ledger(env, { key: 'WEBMODEL_SESSION_NEW', action: 'session_create_failed', direction: 'out', status: 502, request: { provider }, response: w._fail }); return w._fail; }
      if (!w.ok) {
        const ev = await ledger(env, { key: 'WEBMODEL_SESSION_NEW', action: 'session_create_failed', direction: 'out', status: 409, request: { provider }, response: w });
        return err(w.error || 'PROVIDER_UNAVAILABLE', w.message || 'session not created', { provider, session_id: w.session_id || null, ledger_event_id: ev || null, evidence: w.evidence || null });
      }

      const session = { ...w, state_handle: b.state_handle || null, metadata: w.metadata || {} };
      try { await writeSession(env, session, now()); }
      catch (e) { return err('DURABLE_WRITE_FAILED', `session ${w.session_id} exists in the browser but could not be written to D1: ${e.message}`, { session_id: w.session_id }); }

      const ev = await ledger(env, {
        key: 'WEBMODEL_SESSION_NEW', action: 'session_created', direction: 'out', status: 200,
        request: { provider, profile: session.profile_id },
        response: { session_id: session.session_id, conversation_url: session.conversation_url, state: session.state },
      });
      if (!ev) return err('LEDGER_WRITE_FAILED', `session ${w.session_id} was created but the ledger refused the receipt`, { session_id: w.session_id });

      if (session.state_handle) await appendState(env, session.state_handle, { kind: 'note', actor: `${provider}-web`, summary: `browser session opened on ${provider}`, ref: session.session_id });

      return ok({
        session_id: session.session_id, provider, conversation_url: session.conversation_url,
        provider_conversation_id: session.provider_conversation_id, created_at: session.created_at,
        state: session.state, state_handle: session.state_handle, substrate: 'browser_web', ledger_event_id: ev,
      });
    },

    // WEBMODEL_SEND — `session_id_or_provider|prompt` (pipes in the prompt survive), or JSON
    //                 {session_id | provider, prompt, request_id, state_handle, timeout_ms}
    async webmodelSend(env, raw) {
      const b = parseBody(raw, 'session_id', 'prompt');
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      let session_id = b.session_id && String(b.session_id).trim();
      const prompt = b.prompt == null ? '' : String(b.prompt);
      if (!prompt.trim()) return err('BAD_REQUEST', 'prompt required — body is `session_id_or_provider|prompt` or a JSON object');

      // A caller may name a provider instead of a session; the gateway opens one. That is what
      // makes CHATGPT_WEB / CLAUDE_WEB usable as one-shot capabilities inside a flow.
      let opened = false;
      if (!session_id || !session_id.startsWith('wms_')) {
        const asProvider = normalizeProvider(session_id || b.provider);
        if (!asProvider) return err('BAD_REQUEST', 'first field must be a session_id (wms_…) or a provider name');
        const made = await MAP.webmodelSessionNew(env, JSON.stringify({ provider: asProvider, profile: b.profile, state_handle: b.state_handle }));
        if (String(made).startsWith('ERR:')) return made;
        session_id = JSON.parse(made).session_id;
        opened = true;
      }

      const row = await env.DB.prepare('SELECT * FROM webmodel_sessions WHERE session_id = ?').bind(session_id).first();
      if (!row) return err('SESSION_NOT_FOUND', `no durable session ${session_id}`);
      if (row.state === 'closed') return err('SESSION_NOT_FOUND', `session ${session_id} is closed`);
      const state_handle = b.state_handle || row.state_handle || null;

      const withState = b.with_state === true || b.with_state === 'true' || b.with_state === 1 || b.with_state === '1';
      let sent = prompt;
      if (state_handle && withState) {
        const brief = await resolveHandle(env, state_handle, 8);
        if (brief) sent = `${brief}\n\nTASK: ${prompt}\nAnswer the task. Use the shared state above only as the source of facts.`;
      }

      const request_id = b.request_id || null;
      await ledger(env, { key: 'WEBMODEL_SEND', action: 'prompt_submitted', direction: 'out', status: 202, request: { session_id, provider: row.provider, prompt_chars: sent.length, request_id, state_handle }, response: null });

      const w = await callWorker(env, 'send', { session_id, prompt: sent, request_id, timeout_ms: b.timeout_ms });
      if (w._fail) { await ledger(env, { key: 'WEBMODEL_SEND', action: 'turn_failed', direction: 'in', status: 502, request: { session_id }, response: w._fail }); return w._fail; }

      const created_at = now();
      if (!w.ok) {
        const ordinal = await nextOrdinal(env, session_id).catch(() => 0);
        const failTurn = {
          turn_id: w.turn_id || `wmt_failed_${Date.now().toString(36)}`, session_id, ordinal, provider: row.provider,
          user_content: sent, assistant_content: null, started_at: created_at, completed_at: created_at,
          status: 'failed', failure_code: w.error || 'RESPONSE_CAPTURE_FAILED', state_handle, request_id, created_at,
        };
        try { await writeTurn(env, failTurn); } catch { /* the failure receipt below is still authoritative */ }
        try { await env.DB.prepare('UPDATE webmodel_sessions SET state = ?, updated_at = ? WHERE session_id = ?').bind(w.error === 'AUTH_REQUIRED' ? 'auth_required' : 'failed', created_at, session_id).run(); } catch {}
        const ev = await ledger(env, { key: 'WEBMODEL_SEND', action: 'turn_failed', direction: 'in', status: 409, request: { session_id, provider: row.provider }, response: w });
        return err(w.error || 'RESPONSE_CAPTURE_FAILED', w.message || 'no completed response', {
          session_id, provider: row.provider, turn_id: failTurn.turn_id, ledger_event_id: ev || null,
          provider_message: w.provider_message || null, substrate: 'browser_web',
        });
      }

      // The prompt WAS submitted and a response WAS captured. Now it has to land, or it is not a turn.
      let ordinal;
      try { ordinal = await nextOrdinal(env, session_id); }
      catch (e) { return err('DURABLE_WRITE_FAILED', `could not read the turn sequence for ${session_id}: ${e.message}`, { turn_id: w.turn_id }); }

      const turn = {
        turn_id: w.turn_id, session_id, ordinal, provider: w.provider, user_content: sent,
        assistant_content: w.response, started_at: w.started_at, completed_at: w.completed_at,
        capture_method: w.capture_method, provider_turn_id: w.provider_turn_id, status: 'complete',
        raw_ref: w.raw_ref, raw_digest: w.raw_digest, prompt_digest: w.prompt_digest,
        response_digest: w.response_digest, conversation_url: w.conversation_url,
        state_handle, request_id, created_at,
      };
      try { await writeTurn(env, turn); }
      catch (e) {
        await ledger(env, { key: 'WEBMODEL_SEND', action: 'durable_write_failed', direction: 'in', status: 500, request: { session_id, turn_id: w.turn_id }, response: { message: e.message } });
        return err('DURABLE_WRITE_FAILED', `${w.provider} answered but the turn could not be written to D1: ${e.message}`, { session_id, turn_id: w.turn_id, capture_method: w.capture_method });
      }
      try {
        await writeSession(env, {
          session_id, provider: w.provider, profile_id: row.profile_id, conversation_url: w.conversation_url,
          provider_conversation_id: w.provider_conversation_id, state: 'complete', created_at: row.created_at,
          last_turn_id: w.turn_id, state_handle, metadata: JSON.parse(row.metadata_json || '{}'),
        }, created_at);
      } catch (e) { return err('DURABLE_WRITE_FAILED', `turn ${w.turn_id} landed but the session could not be updated: ${e.message}`, { session_id, turn_id: w.turn_id }); }

      // THE BINDING RECEIPT: this exact prompt produced this exact response, on this substrate.
      // `action: turn_completed` is also the normalized event other automations can trigger on.
      const ev = await ledger(env, {
        key: 'WEBMODEL_SEND', action: 'turn_completed', direction: 'in', status: 200,
        request: { session_id, provider: w.provider, prompt: sent, prompt_digest: w.prompt_digest, request_id, state_handle },
        response: {
          event: 'browser_model.turn.completed', turn_id: w.turn_id, response: w.response,
          response_digest: w.response_digest, capture_method: w.capture_method, substrate: 'browser_web',
          conversation_url: w.conversation_url, provider_turn_id: w.provider_turn_id,
          raw_digest: w.raw_digest, transport_status: w.transport_status,
          started_at: w.started_at, completed_at: w.completed_at,
        },
      });
      if (!ev) return err('LEDGER_WRITE_FAILED', `turn ${w.turn_id} landed in D1 but the ledger refused the receipt`, { session_id, turn_id: w.turn_id });
      try { await env.DB.prepare('UPDATE webmodel_turns SET ledger_event_id = ? WHERE turn_id = ?').bind(ev, w.turn_id).run(); } catch {}

      if (state_handle) {
        await appendState(env, state_handle, {
          kind: 'turn', actor: `${w.provider}-web`, ref: w.turn_id, weight: 8,
          summary: `${w.provider} (browser) was asked "${prompt.slice(0, 160)}" and replied, verbatim: ${w.response.slice(0, 1200)}`,
        });
      }

      return ok({
        session_id, provider: w.provider, prompt: sent, response: w.response,
        conversation_url: w.conversation_url, provider_conversation_id: w.provider_conversation_id,
        provider_turn_id: w.provider_turn_id, turn_id: w.turn_id, ordinal,
        started_at: w.started_at, completed_at: w.completed_at, capture_method: w.capture_method,
        substrate: 'browser_web', raw_ref: w.raw_ref, raw_digest: w.raw_digest,
        prompt_digest: w.prompt_digest, response_digest: w.response_digest,
        state_handle, ledger_event_id: ev, session_opened: opened,
        event: 'browser_model.turn.completed',
      });
    },

    // WEBMODEL_READ — `session_id|n` : re-read captured turns from D1 (the record), not the DOM.
    async webmodelRead(env, raw) {
      const b = parseBody(raw, 'session_id', 'n');
      const session_id = b.session_id && String(b.session_id).trim();
      if (!session_id) return err('BAD_REQUEST', 'session_id required');
      const n = Math.min(Math.max(parseInt(b.n || 5, 10) || 5, 1), 50);
      const s = await env.DB.prepare('SELECT * FROM webmodel_sessions WHERE session_id = ?').bind(session_id).first();
      if (!s) return err('SESSION_NOT_FOUND', `no durable session ${session_id}`);
      const t = await env.DB.prepare('SELECT turn_id, ordinal, provider, user_content, assistant_content, started_at, completed_at, capture_method, status, failure_code, ledger_event_id FROM webmodel_turns WHERE session_id = ? ORDER BY ordinal DESC LIMIT ?').bind(session_id, n).all();
      return ok({ session_id, provider: s.provider, state: s.state, conversation_url: s.conversation_url, state_handle: s.state_handle, turns: (t.results || []).reverse(), substrate: 'browser_web' });
    },

    // WEBMODEL_STATUS — worker, Chrome, adapter health, live sessions, last turn per provider.
    async webmodelStatus(env) {
      const w = await callWorker(env, 'status', {});
      const durable = await env.DB.prepare(
        `SELECT provider, COUNT(*) AS turns,
                MAX(CASE WHEN status='complete' THEN completed_at END) AS last_ok,
                MAX(CASE WHEN status='failed'   THEN completed_at END) AS last_failure
           FROM webmodel_turns GROUP BY provider`
      ).all().catch(() => ({ results: [] }));
      const sessions = await env.DB.prepare("SELECT session_id, provider, state, conversation_url, updated_at FROM webmodel_sessions WHERE state != 'closed' ORDER BY updated_at DESC LIMIT 25").all().catch(() => ({ results: [] }));
      if (w._fail) {
        return err('BROWSER_WORKER_OFFLINE', 'the Mac browser worker is not answering; durable history is still readable', {
          durable_by_provider: durable.results || [], durable_sessions: sessions.results || [],
        });
      }
      return ok({ worker: w.worker, chrome: w.chrome, providers: w.providers, live_sessions: w.sessions, running_jobs: w.running_jobs, recovered_on_boot: w.recovered_on_boot, durable_by_provider: durable.results || [], durable_sessions: sessions.results || [] });
    },

    // WEBMODEL_CLOSE — release the browser tab and mark the durable session closed.
    async webmodelClose(env, raw) {
      const b = parseBody(raw, 'session_id', '_');
      const session_id = b.session_id && String(b.session_id).trim();
      if (!session_id) return err('BAD_REQUEST', 'session_id required');
      const w = await callWorker(env, 'close', { session_id });
      const ts = now();
      try { await env.DB.prepare('UPDATE webmodel_sessions SET state = ?, updated_at = ? WHERE session_id = ?').bind('closed', ts, session_id).run(); }
      catch (e) { return err('DURABLE_WRITE_FAILED', `could not mark ${session_id} closed: ${e.message}`); }
      const ev = await ledger(env, { key: 'WEBMODEL_CLOSE', action: 'session_closed', direction: 'out', status: 200, request: { session_id }, response: { worker_ok: !!w.ok } });
      if (!ev) return err('LEDGER_WRITE_FAILED', `session ${session_id} was closed but the ledger refused the receipt`);
      return ok({ session_id, state: 'closed', worker_released: !!w.ok, ledger_event_id: ev });
    },

    async stateNew(env, raw) {
      const objective = String(raw || '').trim();
      if (!objective) return err('BAD_REQUEST', 'objective required');
      const handle = 'state://' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
      const ts = now();
      try {
        await env.DB.prepare('INSERT INTO state_handles (handle, objective, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?)').bind(handle, objective, 'open', 'gateway', ts, ts).run();
        await env.DB.prepare('INSERT INTO state_entries (handle, ts, kind, actor, summary, ref, weight) VALUES (?,?,?,?,?,?,?)').bind(handle, ts, 'objective', 'gateway', objective, null, 9).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', `state handle not written: ${e.message}`); }
      const ev = await ledger(env, { key: 'STATE_NEW', action: 'state_handle_created', direction: 'out', status: 200, request: { objective }, response: { handle } });
      if (!ev) return err('LEDGER_WRITE_FAILED', `handle ${handle} was written but the ledger refused the receipt`, { handle });
      return ok({ handle, objective, status: 'open', created_at: ts, ledger_event_id: ev });
    },

    // STATE_APPEND — `handle|summary`, or JSON {handle, kind, actor, summary, ref, weight}
    async stateAppend(env, raw) {
      const b = parseBody(raw, 'handle', 'summary');
      const handle = b.handle && String(b.handle).trim();
      if (!handle) return err('BAD_REQUEST', 'handle required');
      const h = await env.DB.prepare('SELECT * FROM state_handles WHERE handle = ?').bind(handle).first();
      if (!h) return err('SESSION_NOT_FOUND', `no state handle ${handle}`);
      const summary = String(b.summary || '').trim();
      if (!summary) return err('BAD_REQUEST', 'summary required');
      try { await appendState(env, handle, { kind: b.kind || 'note', actor: b.actor || 'caller', summary, ref: b.ref || null, weight: b.weight }); }
      catch (e) { return err('DURABLE_WRITE_FAILED', `entry not written: ${e.message}`); }
      const ev = await ledger(env, { key: 'STATE_APPEND', action: 'state_entry_appended', direction: 'out', status: 200, request: { handle, kind: b.kind || 'note' }, response: { summary_chars: summary.length } });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'entry landed but the ledger refused the receipt', { handle });
      return ok({ handle, appended: true, ledger_event_id: ev });
    },

    // STATE_RESOLVE — `handle|n` : the bounded briefing a model is handed instead of a transcript.
    async stateResolve(env, raw) {
      const b = parseBody(raw, 'handle', 'n');
      const handle = b.handle && String(b.handle).trim();
      if (!handle) return err('BAD_REQUEST', 'handle required');
      const n = Math.min(Math.max(parseInt(b.n || 8, 10) || 8, 1), 40);
      const text = await resolveHandle(env, handle, n);
      if (!text) return err('SESSION_NOT_FOUND', `no state handle ${handle}`);
      const h = await env.DB.prepare('SELECT * FROM state_handles WHERE handle = ?').bind(handle).first();
      const entries = await env.DB.prepare('SELECT ts, kind, actor, summary, ref FROM state_entries WHERE handle = ? ORDER BY id DESC LIMIT ?').bind(handle, n).all();
      return ok({ handle, objective: h.objective, status: h.status, briefing: text, entries: (entries.results || []).reverse() });
    },
  };

  return MAP;
}
