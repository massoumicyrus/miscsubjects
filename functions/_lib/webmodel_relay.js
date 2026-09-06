// THE RELAY LANE — a browser model that calls the rest of the build.
//
// The gateway makes a web model callable. This makes it a caller. Between them the arrow runs
// both ways: Directory → Claude Web → Directory → flow → ChatGPT Web → Directory.
//
// A web ChatGPT / Claude / Grok / Gemini / Kimi session has no MCP client, no function calling,
// no connector and no credentials of ours. It does not need any of that. It only has to emit
// the text grammar this build already speaks — [KEY]args[/KEY] — and the relay does the rest:
// capture the response, parse the tags with the SAME reader the router uses (_lib/tag_calls.js,
// never a second grammar), invoke each capability through canonical dispatch under the caller's
// own authority, paste the results back into the same browser conversation, and let the model
// continue until it stops asking for tools.
//
// Authority is the caller's, never the model's. Every capability call goes through
// dispatchNestedAuthorized, so a share token that may not touch STRIPE_WRITE does not acquire
// that right by asking a browser model nicely. Sensitive and approval-gated rows are refused
// outright, and the refusal is handed back to the model as a tool result so it can adapt.

import { collectExecutableTags, META_TAGS } from './tag_calls.js';

const DEFAULT_MAX_ITERATIONS = 4;
const MAX_ITERATIONS_CEILING = 8;
const MAX_CALLS_PER_ITERATION = 4;
const MANIFEST_TOOL_CEILING = 40;
const RESULT_CHARS = 1800;

function err(code, message, extra = {}) {
  return 'ERR:' + code + ' ' + JSON.stringify({ ok: false, error: code, message: String(message || code), ...extra });
}

// The one-line contract of a row, taken from the row's own docs. If a capability's `# WHAT:`
// is wrong, the browser model is wrong in exactly the same way every other caller is — which
// is the point: there is no second description of the build to keep in sync.
export function toolLine(key, row) {
  const content = String(row?.content || '');
  const pick = (label) => (content.match(new RegExp('^#\\s*' + label + ':\\s*(.+)$', 'm')) || [])[1] || '';
  const what = pick('WHAT') || String(row?.target || '');
  const args = pick('ARGS');
  const ex = pick('EX');
  return `[${key}] ${what.slice(0, 220)}${args ? `\n    args: ${args.slice(0, 160)}` : ''}${ex ? `\n    example: ${ex.slice(0, 160)}` : ''}`;
}

// A capability a browser model may be handed unattended. Two hard refusals — a row marked
// sensitive, and a row that requires approval — because "the model asked for it" is not consent.
export function relayAllowed(key, row, allowSet) {
  if (!row) return { ok: false, why: 'unknown capability' };
  if (row.enabled === 0) return { ok: false, why: 'capability is disabled' };
  if (Number(row.sensitive) === 1) return { ok: false, why: 'capability is marked sensitive; a browser model may not call it unattended' };
  if (allowSet && !allowSet.has(key)) return { ok: false, why: 'capability is outside the tool list this run was given' };
  return { ok: true };
}

export function buildManifest(dir, allowSet) {
  const keys = [...(allowSet || new Set(Object.keys(dir)))]
    .filter((k) => dir[k] && Number(dir[k].sensitive) !== 1 && dir[k].enabled !== 0)
    .slice(0, MANIFEST_TOOL_CEILING);
  const lines = keys.map((k) => toolLine(k, dir[k]));
  return { keys, text: lines.join('\n') };
}

export function isAcknowledgement(text) {
  const t = String(text || '').trim();
  return t.length < 80 && /^(understood|ok(ay)?|got it|sure|acknowledged|ready|noted|will do|standing by)\b/i.test(t);
}

export function relayPreamble(manifestText) {
  return [
    'You are connected to a live capability system. You have no browser and no plugins here;',
    'you have text, and text is enough. To run one of the capabilities below, write it as a tag',
    'on its own line and then STOP and wait — the system executes it and sends you the result in',
    'the next message.',
    '',
    'FORMAT (exact):  [CAPABILITY_KEY]arguments[/CAPABILITY_KEY]',
    'Arguments are one line, fields separated by | in the order the capability lists them.',
    'Use at most ' + MAX_CALLS_PER_ITERATION + ' tags per message. Do not invent a key that is not listed.',
    'When you have what you need, answer normally with no tags at all — that ends the run.',
    'Begin immediately with the task below: your first reply must contain either a capability tag',
    'or the final answer. Do not acknowledge these instructions.',
    '',
    'CAPABILITIES:',
    manifestText,
  ].join('\n');
}

export function makeWebmodelRelayFnMap({ webmodelSend, dispatchNestedAuthorized, loadDirectory, logEvent, buildNowIso, parseBody }) {
  const now = () => (buildNowIso ? buildNowIso() : new Date().toISOString());

  return {
    // WEBMODEL_AGENT — `provider_or_session|task`, or JSON
    //   {provider | session_id, task, tools, max_iterations, state_handle, request_id}
    // Returns the model's final answer plus the full record of what it made the build do.
    async webmodelAgent(env, raw) {
      const b = parseBody(raw, 'session_or_provider', 'task');
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const target = String(b.session_or_provider || b.session_id || b.provider || '').trim();
      const task = String(b.task || b.prompt || '').trim();
      if (!target) return err('BAD_REQUEST', 'first field must be a session_id (wms_…) or a provider name');
      if (!task) return err('BAD_REQUEST', 'a task is required — body is `provider_or_session|task`');

      const dir = await loadDirectory(env);
      let allowSet = null;
      const toolsArg = String(b.tools || '').trim();
      if (toolsArg && toolsArg !== '*') {
        allowSet = new Set(toolsArg.split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean));
        const unknown = [...allowSet].filter((k) => !dir[k]);
        if (unknown.length) return err('BAD_REQUEST', `these capabilities are not in the directory: ${unknown.join(', ')}`);
      }
      const manifest = buildManifest(dir, allowSet);
      if (!manifest.keys.length) return err('BAD_REQUEST', 'no capability is available to this run — name them with tools=KEY1,KEY2');

      const maxIter = Math.min(Math.max(parseInt(b.max_iterations || DEFAULT_MAX_ITERATIONS, 10) || DEFAULT_MAX_ITERATIONS, 1), MAX_ITERATIONS_CEILING);
      const state_handle = b.state_handle || null;
      const started_at = now();
      const transcript = [];
      const toolCalls = [];
      let session_id = target;
      let message = `${relayPreamble(manifest.text)}\n\n---\nTASK: ${task}`;
      let finalAnswer = null;
      let stopped = 'max_iterations';
      let nudged = false;

      for (let i = 1; i <= maxIter; i++) {
        const sendBody = {
          [session_id.startsWith('wms_') ? 'session_id' : 'provider']: session_id,
          prompt: message,
          state_handle: i === 1 ? state_handle : null,
          request_id: b.request_id ? `${b.request_id}#${i}` : null,
          timeout_ms: b.timeout_ms,
        };
        const out = await webmodelSend(env, JSON.stringify(sendBody));
        if (String(out).startsWith('ERR:')) {
          await logEvent(env, { source: 'webmodel', key: 'WEBMODEL_AGENT', action: 'relay_failed', direction: 'in', status: 409, request: { iteration: i, session_id }, response: String(out).slice(0, 1000) });
          return out;
        }
        const turn = JSON.parse(out);
        session_id = turn.session_id;                 // the first iteration may have opened it
        transcript.push({ iteration: i, turn_id: turn.turn_id, provider: turn.provider, response: turn.response, capture_method: turn.capture_method, ledger_event_id: turn.ledger_event_id });

        // The SAME reader the router uses. A second grammar here would mean the record of what
        // the model asked for could disagree with what actually ran.
        const tags = collectExecutableTags(turn.response, dir).filter((t) => !META_TAGS.has(t.key));
        if (!tags.length) {
          // A bare acknowledgement on the first turn is not an answer. One bounded nudge, then the
          // model's next tagless reply is taken as final whatever it says.
          if (i === 1 && !nudged && isAcknowledgement(turn.response)) {
            nudged = true;
            message = 'That was an acknowledgement, not the task. Do the task now: reply with a capability tag, or with the final answer.';
            continue;
          }
          finalAnswer = turn.response; stopped = 'model_answered'; break;
        }

        const results = [];
        for (const tag of tags.slice(0, MAX_CALLS_PER_ITERATION)) {
          const row = dir[tag.key];
          const gate = relayAllowed(tag.key, row, allowSet);
          if (!gate.ok) {
            results.push({ key: tag.key, ok: false, refused: gate.why, result: null });
            toolCalls.push({ iteration: i, key: tag.key, ok: false, refused: gate.why });
            continue;
          }
          const callerAuth = env?.TRACE_CTX?.authContext || null;
          const presentingAuth = callerAuth ? { ...callerAuth, presenter: { ...(callerAuth.presenter || {}), webmodel_session_id: session_id, state_handle: state_handle || callerAuth.presenter?.state_handle || null } } : null;
          const r = await dispatchNestedAuthorized(env, tag.key, String(tag.body || '').trim(), presentingAuth);
          if (r?.denied) {
            results.push({ key: tag.key, ok: false, refused: `authority refused: ${r.reason}`, result: null });
            toolCalls.push({ iteration: i, key: tag.key, ok: false, refused: r.reason });
            continue;
          }
          const text = typeof r?.result === 'string' ? r.result : JSON.stringify(r?.result ?? r);
          const failed = typeof text === 'string' && text.startsWith('ERR');
          results.push({ key: tag.key, ok: !failed, result: text });
          toolCalls.push({ iteration: i, key: tag.key, ok: !failed, args: String(tag.body || '').slice(0, 200), invocation_id: r?.invocation?.id || null, receipt: r?.proof?.public_receipt || null, result_chars: String(text || '').length });
        }
        if (tags.length > MAX_CALLS_PER_ITERATION) {
          results.push({ key: '_note', ok: false, refused: `you asked for ${tags.length} capabilities in one message; only the first ${MAX_CALLS_PER_ITERATION} ran. Ask for the rest next message.`, result: null });
        }

        // Paste the results back into the SAME browser conversation and let the model continue.
        message = ['TOOL RESULTS:', ...results.map((r) => r.refused
          ? `[${r.key}] REFUSED: ${r.refused}`
          : `[${r.key}] ${r.ok ? 'OK' : 'ERROR'}:\n${String(r.result || '').slice(0, RESULT_CHARS)}`),
        '', 'Continue. Ask for more capabilities if you need them, or answer now with no tags.'].join('\n');

        if (i === maxIter) stopped = 'max_iterations';
      }

      const completed_at = now();
      const ev = await logEvent(env, {
        source: 'webmodel', key: 'WEBMODEL_AGENT', action: 'relay_completed', direction: 'in', status: 200,
        request: { task, tools: manifest.keys, max_iterations: maxIter, state_handle },
        response: { session_id, stopped, iterations: transcript.length, tool_calls: toolCalls, final: finalAnswer, event: 'browser_model.relay.completed' },
      });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'the relay ran but the ledger refused the receipt', { session_id });

      return JSON.stringify({
        ok: true, session_id, task, stopped,
        final_answer: finalAnswer,
        iterations: transcript.length, transcript, tool_calls: toolCalls,
        tools_offered: manifest.keys, substrate: 'browser_web', started_at, completed_at,
        ledger_event_id: ev, state_handle,
        event: 'browser_model.relay.completed',
      });
    },
  };
}
