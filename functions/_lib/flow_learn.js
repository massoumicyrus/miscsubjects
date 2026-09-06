// LEARNED FLOWS — a successful trace becomes an executable capability.
//
// OpenClaw's self-learning turns successful work into a SKILL: instructions a future model reads
// and then reasons through again. This turns successful work into a FLOW: the ordered capability
// calls a trace actually made, with the one-run literals lifted into arguments, written as an
// ordinary Directory row of type `flow`. From then on it is a capability like any other — it
// dispatches, composes into other flows, schedules, projects into Sheets/MCP/curl and receipts —
// and no model has to rediscover the procedure to run it.
//
// What is learned is therefore EXECUTABLE, not instructions, and it is honest about what it does
// not know: a literal it cannot prove came from the input stays a constant, a step whose input
// was the previous step's output becomes $PREV, and anything sensitive or side-effecting leaves
// the proposal disabled until an owner promotes it. A trace with a dangerous side effect never
// auto-runs.

import { buildNowIso } from './build_time.js';

const MIN_STEPS = 2;
const MAX_STEPS = 20;
const PREV_MATCH_MIN = 24;       // shortest prior output that may be recognised inside a later input
const SIDE_EFFECT_KEY = /(^|_)(SEND|POST|REPLY|DELETE|CREATE|PUT|WRITE|UPDATE|REFUND|PAY|CANCEL|EMAIL|SMS|PUBLISH|EXEC|RUN|FIRE|MINT|REVOKE|TRUST|TRIGGER|DELIVER|NOTIFY|DISPATCH)(_|$)/;
const META_KEYS = /^(TRAIL_|FLOW_LEARN|FLOW_PROMOTE|FLOW_CANDIDATES|D1_QUERY$|LEDGER_QUERY$|DIRECTORY_|DIR_)/;

function err(code, message, extra = {}) { return 'ERR:' + code + ' ' + JSON.stringify({ ok: false, error: code, message: String(message || code), ...extra }); }
function ok(o) { return JSON.stringify({ ok: true, ...o }); }

export function parseLearnBody(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) return {};
  if (s.startsWith('{')) { try { return JSON.parse(s); } catch { return { _bad_json: true }; } }
  const parts = s.split('|');
  const out = { name: parts[0]?.trim(), source: parts[1]?.trim() };
  const rest = parts.slice(2).join('|').trim();
  if (rest) { try { Object.assign(out, JSON.parse(rest)); } catch { out.arg = rest; } }
  return out;
}

export function slugKey(name) {
  const k = String(name || '').trim().toUpperCase().replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
  return /^[A-Z][A-Z0-9_]*$/.test(k) ? k : null;
}

// Inside a flow body, `>` separates steps and `|` separates fan-out branches, but only at the top
// level: the flow splitter tracks brace and bracket depth, so a balanced JSON object inside a step
// body is an ordinary constant. What cannot be written is a top-level `>` or `|`, an unbalanced
// brace or bracket, or a body that BEGINS with `{` (it would read as a fan-out). Those are refused;
// the first real candidate the ledger surfaced carried a JSON body and was wrongly refused whole.
function escapeForFlow(text) {
  const t = String(text);
  if (t.trim().startsWith('{')) return null;
  let depth = 0;
  for (const c of t) {
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (depth < 0) return null; }
    else if ((c === '>' || c === '|') && depth === 0) return null;
  }
  return depth === 0 ? t : null;
}

// THE COMPILER. Steps in, flow DSL out, with a record of every decision so the proposal explains
// itself. `arg` is the value that should become $1 (default: the first step's input).
export function compileSteps(steps, { arg = null, dir = {} } = {}) {
  const notes = [];
  const list = (steps || []).filter((s) => s && s.key && !META_KEYS.test(s.key));
  if (list.length < MIN_STEPS) return { ok: false, error: 'TOO_FEW_STEPS', message: `a learned flow needs at least ${MIN_STEPS} capability calls after meta rows are removed; found ${list.length}` };
  if (list.length > MAX_STEPS) return { ok: false, error: 'TOO_MANY_STEPS', message: `${list.length} steps; the ceiling is ${MAX_STEPS}` };
  const a1 = String(arg == null || arg === '' ? list[0].input || '' : arg).trim();
  const lines = [];
  let risk = 'low';
  const classes = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const row = dir[s.key];
    if (!row) return { ok: false, error: 'UNKNOWN_CAPABILITY', message: `${s.key} is not in the directory any more; the procedure cannot be compiled` };
    if (row.enabled === 0) return { ok: false, error: 'CAPABILITY_DISABLED', message: `${s.key} is disabled` };
    const sensitive = Number(row.sensitive) === 1;
    const side = SIDE_EFFECT_KEY.test(s.key);
    if (sensitive) risk = 'high';
    classes.push({ step: i + 1, key: s.key, sensitive, side_effecting: side });
    let input = String(s.input == null ? '' : s.input);
    let how = 'constant';
    const prevOut = i > 0 ? String(list[i - 1].output == null ? '' : list[i - 1].output) : '';
    if (a1 && input === a1) { input = '$1+'; how = 'argument'; }
    else if (i > 0 && prevOut && input === prevOut) { input = '$PREV'; how = 'previous_output'; }
    else {
      if (a1 && a1.length >= 3 && input.includes(a1)) { input = input.split(a1).join('$1+'); how = 'argument_embedded'; }
      if (i > 0 && prevOut.length >= PREV_MATCH_MIN && input.includes(prevOut)) { input = input.split(prevOut).join('$PREV'); how = how === 'constant' ? 'previous_output_embedded' : how + '+previous_output'; }
    }
    if (how === 'constant' && !input) how = 'empty';
    if (how === 'constant' || how.endsWith('_embedded') || how.includes('+')) {
      const safe = escapeForFlow(input);
      if (safe == null) return { ok: false, error: 'UNSAFE_LITERAL', message: `step ${i + 1} (${s.key}) carries a literal with a flow delimiter (| > { }) that cannot be written into the DSL; supply it as the argument instead`, step: i + 1 };
    }
    notes.push({ step: i + 1, key: s.key, binding: how, from_invocation: s.inv || null });
    lines.push(`${s.key}: ${input}`);
  }
  const dsl = lines.join('\n> ');
  const sideEffecting = classes.filter((c) => c.side_effecting).map((c) => c.key);
  return { ok: true, dsl, arg: a1, notes, risk, classes, side_effecting: sideEffecting, auto_enable: risk === 'low' && sideEffecting.length === 0 };
}

function docBlock({ key, name, dsl, arg, source, steps, risk, side_effecting, notes }) {
  const chain = steps.map((s) => s.key).join(' → ');
  const enabledNote = risk === 'low' && !side_effecting.length ? 'Enabled on creation: every step is low-risk and none names a side effect.' : `Created DISABLED: ${risk === 'high' ? 'a step is marked sensitive' : 'a step names a side effect (' + side_effecting.join(', ') + ')'}. An owner promotes it with FLOW_PROMOTE ${key} after reading the steps.`;
  return [
    `# WHAT: Learned flow — the procedure ${chain}, compiled from a successful trace (${source}) into an executable capability. Runs the same steps in the same order with $1 in place of the run's input.`,
    `# WHEN_TO_USE: the same job comes up again. Call this instead of rediscovering the sequence; it composes into other flows, schedules and every projection like any row.`,
    `# ARGS: $1 = the input the first step took. In the source run it was: ${String(arg || '').slice(0, 160) || '(empty)'}`,
    `# EX: [${key}]${String(arg || '').slice(0, 120)}[/${key}]`,
    `# TESTS: Produces a receipt per step under one trace; the final output is the last step's. ${enabledNote}`,
    `# LEARNED_FROM: ${source} · bindings: ${notes.map((n) => n.step + ':' + n.binding).join(', ')} · risk ${risk}`,
    dsl,
  ].join('\n');
}

export function makeFlowLearnFnMap({ loadDirectory, logEvent, readEventFull, getInvocation, invalidateDirSnapshot, dispatchNestedAuthorized }) {
  const now = () => buildNowIso();

  async function stepsFromTrace(env, trace) {
    const r = await env.LEDGER.prepare('SELECT id, ts, object_id, actor, material, event_id, invocation_json FROM invocations WHERE trace_id = ? ORDER BY ts ASC LIMIT 60').bind(trace).all();
    const fromInvocations = await hydrate(env, r.results || []);
    if (fromInvocations.length >= MIN_STEPS) return fromInvocations;
    // A top-level dispatch is ONE invocation, but every step it took — each flow member, each tool an
    // agent called — is a ledger row under the same trace (dispatch.js logStep). Those rows are where
    // a procedure lives, so a trace that is one invocation with six steps compiles from the steps.
    const ev = await env.LEDGER.prepare(
      "SELECT id, ts, key, action, step, request_json, response_json FROM events WHERE trace_id = ? AND source = 'dispatch' ORDER BY ts ASC, step ASC LIMIT 200",
    ).bind(trace).all();
    return stepsFromEvents(ev.results || []);
  }

  // The ledger writes two rows per http step (the outbound request, then the row with the body the
  // caller gave) and two per fn step; collapse consecutive rows of the same key into one step whose
  // input is the caller's body, not the outbound URL. The outermost flow row, when the trace IS a
  // flow, is dropped: it is already a capability.
  function stepsFromEvents(rows) {
    const list = [];
    for (const r of rows) {
      const key = String(r.key || '');
      if (!key || META_KEYS.test(key)) continue;
      const input = String(r.request_json == null ? '' : r.request_json);
      const isOutbound = /^\s*\{\s*"url"/.test(input);
      const last = list[list.length - 1];
      if (last && last.key === key) {
        if (!isOutbound) last.input = input;
        if (r.response_json != null) last.output = String(r.response_json);
        continue;
      }
      list.push({ inv: r.id, key, action: String(r.action || ''), input: isOutbound ? '' : input, output: String(r.response_json == null ? '' : r.response_json), ts: r.ts });
    }
    if (list.length && list[list.length - 1].action === 'flow') list.pop();
    return list;
  }
  async function stepsFromIds(env, ids) {
    const rows = [];
    for (const id of ids) { const rec = await getInvocation(env, id); if (!rec) return { error: `unknown invocation ${id}` }; rows.push(rec); }
    return hydrate(env, rows);
  }
  async function hydrate(env, rows) {
    const steps = [];
    for (const rec of rows) {
      let inv = {}; try { inv = JSON.parse(rec.invocation_json || '{}'); } catch {}
      let input = null;
      if (rec.event_id) { try { const ev = await readEventFull(env, rec.event_id); if (ev && ev.request_json != null) input = String(ev.request_json); } catch {} }
      if (input == null) input = String(inv.input_preview ?? '');
      let output = String(inv.output_preview ?? '');
      if (rec.event_id) { try { const ev = await readEventFull(env, rec.event_id); if (ev && ev.response_json != null) output = String(ev.response_json); } catch {} }
      steps.push({ inv: rec.id, key: rec.object_id, input, output, material: Number(rec.material) === 1, actor: rec.actor, ts: rec.ts });
    }
    return steps;
  }

  return {
    // FLOW_LEARN — `NAME|trace_id or inv_a,inv_b,…|{"arg":"…","replay":true}`
    async flowLearn(env, raw) {
      const b = parseLearnBody(raw);
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const key = slugKey(b.name || b.key);
      if (!key) return err('BAD_REQUEST', 'first field is the new capability name: letters, digits, underscore, starting with a letter');
      const source = String(b.source || b.trace_id || b.invocations || '').trim();
      if (!source) return err('BAD_REQUEST', 'second field is the source: a trace id (t_…) or a comma list of invocation ids (inv_…)');
      const dir = await loadDirectory(env);
      if (dir[key]) return err('BAD_REQUEST', `${key} already exists in the directory; choose another name`, { existing_type: dir[key].type });
      let steps;
      try { steps = source.startsWith('inv_') ? await stepsFromIds(env, source.split(',').map((s) => s.trim()).filter(Boolean)) : await stepsFromTrace(env, source); }
      catch (e) { return err('CONTEXT_STORE_UNAVAILABLE', 'could not read the trace: ' + e.message); }
      if (steps?.error) return err('SESSION_NOT_FOUND', steps.error);
      if (!steps.length) return err('SESSION_NOT_FOUND', `no invocations recorded under ${source}`);
      const failed = steps.filter((s) => String(s.output || '').startsWith('ERR'));
      if (failed.length) return err('BAD_REQUEST', `the trace is not a successful procedure: ${failed.map((f) => f.key).join(', ')} returned ERR. Only successful traces are learned.`, { failed_steps: failed.map((f) => ({ key: f.key, inv: f.inv })) });
      const compiled = compileSteps(steps, { arg: b.arg ?? null, dir });
      if (!compiled.ok) return err(compiled.error, compiled.message, { step: compiled.step || null, steps: steps.map((s) => ({ key: s.key, inv: s.inv })) });
      const enable = compiled.auto_enable && b.enable !== false && b.enable !== 'false';
      const used = steps.filter((s) => !META_KEYS.test(s.key));
      const content = docBlock({ key, name: b.name, dsl: compiled.dsl, arg: compiled.arg, source, steps: used, risk: compiled.risk, side_effecting: compiled.side_effecting, notes: compiled.notes });
      const schema = JSON.stringify({ type: 'object', properties: { input: { type: 'string', description: 'the input the first step takes (pipe position 1)' } }, required: ['input'], 'x-arg-order': ['input'], description: 'Arguments are joined with | in the order given by x-arg-order.' });
      const ts = new Date().toISOString();
      try {
        await env.DB.prepare(
          'INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, input_schema, examples, sensitive, runner, object_kind, descriptor_rev, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)',
        ).bind(key, 'flow', '', '', content, 'learned', enable ? 1 : 0, 1, 90, schema, JSON.stringify([compiled.arg].filter(Boolean)), compiled.risk === 'high' ? 1 : 0, 'edge', 'capability', ts, ts).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', `the flow compiled but the directory refused the row: ${e.message}`); }
      try { await invalidateDirSnapshot(env); } catch {}

      // Replay against the source input under the CALLER's authority, and compare with the trace.
      let replay = null;
      if (b.replay === true || b.replay === 'true' || b.replay === 1) {
        if (!enable) replay = { ran: false, why: 'proposal is disabled; promote it first' };
        else {
          const r = await dispatchNestedAuthorized(env, key, compiled.arg, env?.TRACE_CTX?.authContext || null);
          if (r?.denied) replay = { ran: false, why: r.reason };
          else {
            const out = typeof r?.result === 'string' ? r.result : JSON.stringify(r?.result ?? '');
            const last = String(used[used.length - 1].output || '');
            const prefix = last.slice(0, 80);
            replay = { ran: true, ok: !out.startsWith('ERR'), trace: r?.trace || null, output_head: out.slice(0, 300), matches_trace_prefix: !!prefix && out.startsWith(prefix), note: 'a live re-run can legitimately differ where a step reads live data; the prefix match is evidence, not proof' };
          }
        }
      }
      const ev = await logEvent(env, {
        source: 'flow_learn', key: 'FLOW_LEARN', action: 'flow_learned', direction: 'in', status: 200,
        request: { key, source, arg: compiled.arg, steps: used.map((s) => ({ key: s.key, inv: s.inv })) },
        response: { dsl: compiled.dsl, risk: compiled.risk, side_effecting: compiled.side_effecting, enabled: enable, bindings: compiled.notes, replay },
      });
      if (!ev) return err('LEDGER_WRITE_FAILED', `${key} was written but the ledger refused the receipt`, { key });
      return ok({
        key, type: 'flow', enabled: enable, risk: compiled.risk, side_effecting: compiled.side_effecting,
        dsl: compiled.dsl, argument: compiled.arg, bindings: compiled.notes, steps: used.map((s) => ({ key: s.key, invocation: s.inv })),
        replay, ledger_event_id: ev,
        run: `[${key}]${compiled.arg}[/${key}]`, row: `https://miscsubjects.com/admin/directory/${key}`,
        promote: enable ? null : `FLOW_PROMOTE ${key}`,
        what_this_is: 'an executable capability compiled from the trace — not instructions for a model to repeat it',
      });
    },

    // FLOW_PROMOTE — `KEY` : an owner enables a disabled learned flow after reading its steps.
    async flowPromote(env, raw) {
      const key = slugKey(String(raw || '').split('|')[0]);
      if (!key) return err('BAD_REQUEST', 'key required');
      if (!env?.TRACE_CTX?.authContext?.ownerAuthed) return err('OWNER_REQUIRED', 'promoting a learned flow with a sensitive or side-effecting step is an owner action');
      const row = await env.DB.prepare("SELECT key, type, enabled, category FROM directory WHERE key = ?").bind(key).first();
      if (!row) return err('SESSION_NOT_FOUND', `no row ${key}`);
      if (row.type !== 'flow' || row.category !== 'learned') return err('BAD_REQUEST', `${key} is not a learned flow`);
      try { await env.DB.prepare('UPDATE directory SET enabled = 1, updated_at = ? WHERE key = ?').bind(new Date().toISOString(), key).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      try { await invalidateDirSnapshot(env); } catch {}
      const ev = await logEvent(env, { source: 'flow_learn', key: 'FLOW_PROMOTE', action: 'flow_promoted', direction: 'in', status: 200, actor: 'owner', request: { key }, response: { enabled: true } });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'promoted but the ledger refused the receipt');
      return ok({ key, enabled: true, ledger_event_id: ev });
    },

    // FLOW_CANDIDATES — `days|min_repeats` : procedures the ledger has seen succeed repeatedly.
    // The signature of a trace is its ordered capability sequence; a signature that recurs is a
    // procedure somebody keeps rediscovering.
    async flowCandidates(env, raw) {
      const parts = String(raw || '').split('|');
      const days = Math.min(Math.max(parseInt(parts[0], 10) || 14, 1), 90);
      const minRepeats = Math.min(Math.max(parseInt(parts[1], 10) || 2, 1), 50);
      const since = new Date(Date.now() - days * 86400000).toISOString();
      let rows;
      try {
        rows = (await env.LEDGER.prepare(
          "SELECT id, ts, key, action, step, trace_id, substr(request_json,1,200) AS request_json, substr(response_json,1,40) AS response_json FROM events WHERE ts >= ? AND source = 'dispatch' AND trace_id IS NOT NULL AND trace_id != '' AND action IN ('fn','http','flow','agent') ORDER BY ts ASC LIMIT 20000",
        ).bind(since).all()).results || [];
      } catch (e) { return err('CONTEXT_STORE_UNAVAILABLE', e.message); }
      const byTrace = new Map();
      for (const r of rows) { const a = byTrace.get(r.trace_id) || []; a.push(r); byTrace.set(r.trace_id, a); }
      const sigs = new Map();
      let compiledAlready = 0;
      for (const [trace, evs] of byTrace) {
        const outer = evs[evs.length - 1];
        if (outer && String(outer.action) === 'flow') { compiledAlready++; continue; }     // already a capability
        const steps = stepsFromEvents(evs);
        if (steps.length < MIN_STEPS || steps.length > MAX_STEPS) continue;
        if (steps.some((st) => String(st.output || '').startsWith('ERR'))) continue;
        const sig = steps.map((st) => st.key).join(' → ');
        const rec = sigs.get(sig) || { signature: sig, steps: steps.length, count: 0, traces: [], last: evs[0].ts };
        rec.count++; if (rec.traces.length < 5) rec.traces.push(trace); if (evs[0].ts > rec.last) rec.last = evs[0].ts;
        sigs.set(sig, rec);
      }
      const candidates = [...sigs.values()].filter((c) => c.count >= minRepeats).sort((a, b) => b.count - a.count || b.steps - a.steps).slice(0, 25)
        .map((c) => ({ ...c, learn: `FLOW_LEARN <NAME>|${c.traces[0]}`, side_effecting: c.signature.split(' → ').filter((k) => SIDE_EFFECT_KEY.test(k)) }));
      return ok({ window_days: days, min_repeats: minRepeats, ledger_rows_examined: rows.length, traces_examined: byTrace.size, traces_already_flows: compiledAlready, candidates });
    },
  };
}
