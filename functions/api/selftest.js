// Self-test API. The build tests itself the way the owner messages it: each question is run through
// the ROUTER and scored (real solution vs leaked tag / error / empty). CRUD on questions, batched
// runs (a full 25-question run exceeds one window), and a per-version scoreboard.
import { dispatch } from './dispatch.js';
import { reflexSelftestFailures } from '../_lib/issue_reflex.js';
import { blooioTextField } from '../_lib/reply_chunks.js';
import { runGraphPopulate } from '../_lib/graph_selftest.js';
import { isBuildAuthed } from '../_lib/admin_session.js';

const OWNER = '[OWNER_PHONE]'; // mirror of webhook_intake.js isOwner — the build's only whitelisted sender
const GROUP = 'grp_d21e1ea99f8a4ea0'; // audit group: ButterCup ([PHONE]) asks, Pepper ([BUILD_PHONE]) answers
const BUTTERCUP_NUM = '[PHONE]';
const PEPPER_NUM = '[BUILD_PHONE]';
const BUTTERCUP_KEY = 'BLOOIO_API_KEY_BUTTERCUP'; // questions ONLY — never fall back to main Pepper key
const PEPPER_KEY = 'BLOOIO_API_KEY_PEPPERUP'; // answers ONLY — never use ButterCup key for answers

// Post into the group as a specific Blooio identity with explicit from_number so the group chat
// never shows Pepper ([BUILD_PHONE]) asking TEST questions (identity law).
async function sendAs(env, keyName, text, fromNumber) {
  const key = env[keyName];
  if (!key) return { status: 0, error: 'missing_' + keyName };
  try {
    const body = { text: blooioTextField(String(text || ''), { split: false }) };
    if (fromNumber) body.from_number = fromNumber;
    const r = await fetch('https://backend.blooio.com/v2/api/chats/' + encodeURIComponent(GROUP) + '/messages',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: JSON.stringify(body) });
    return { status: r.status, key: keyName, from: fromNumber || null };
  } catch (e) {
    return { status: 0, error: String(e?.message || e), key: keyName, from: fromNumber || null };
  }
}
async function sendQuestion(env, text) {
  if (!env[BUTTERCUP_KEY]) return { status: 0, error: 'missing_' + BUTTERCUP_KEY };
  return sendAs(env, BUTTERCUP_KEY, text, BUTTERCUP_NUM);
}
async function sendAnswer(env, text) {
  if (/^TEST\s+\d+\s*\/\s*\d+\s*—/i.test(String(text || ''))) {
    return { status: 0, error: 'identity_block:answers_must_not_echo_test_questions' };
  }
  const keyName = env[PEPPER_KEY] ? PEPPER_KEY : (env.BLOOIO_API_KEY ? 'BLOOIO_API_KEY' : null);
  if (!keyName) return { status: 0, error: 'missing_' + PEPPER_KEY };
  return sendAs(env, keyName, text, PEPPER_NUM);
}
function preflightIdentity(env) {
  const missing = [];
  if (!env[BUTTERCUP_KEY]) missing.push(BUTTERCUP_KEY);
  if (!env[PEPPER_KEY] && !env.BLOOIO_API_KEY) missing.push(PEPPER_KEY);
  return missing;
}

const J = (o, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' } });
// Terminal key OR admin session cookie (so /admin/selftest toggles work signed-in).
async function authed(req, env) { return isBuildAuthed(req, env); }
function dispatchHeaders(env) { return { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' }; }

// Vault-level master: default OFF when missing. Nothing selftests while master is off —
// not autorun, not "manual" sibling triggers, not graph_run. Re-enable only via
// action set_master + confirm phrase ENABLE SELFTEST (admin tab or owner POST).
export const SELFTEST_MASTER_KEY = 'selftest_master';
export const SELFTEST_MASTER_ENABLE_PHRASE = 'ENABLE SELFTEST';
export const SELFTEST_AUTORUN_ENABLE_PHRASE = 'ENABLE SELFTEST AUTORUN';

async function selftestMasterOn(env) {
  if (!env.KV) return false;
  try { return (await env.KV.get(SELFTEST_MASTER_KEY)) === '1'; } catch { return false; }
}
async function selftestAutorunOn(env) {
  if (!env.KV) return false;
  try {
    if ((await env.KV.get(SELFTEST_MASTER_KEY)) !== '1') return false;
    return (await env.KV.get('selftest_autorun')) === '1';
  } catch { return false; }
}
function confirmPhrase(b, phrase) {
  const c = String(b?.confirm || b?.owner_confirm || b?.phrase || '').trim();
  return c === phrase;
}

function visibleReply(s) {
  s = String(s || '');
  const ms = [...s.matchAll(/\[REPLY\]([\s\S]*?)\[\/REPLY\]/g)];
  let r = ms.length ? ms[ms.length - 1][1] : s;
  return r.replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/g, ' ');
}
// A pass = a real solution. Fail = an error, or a reply that is nothing but tool tags (a leaked
// call like "[DIR_LIST]"), or — when a relevance pattern is set — an off-topic answer.
function score(out, relevance, kind) {
  const raw = String(out || '');
  const errorExplanationOk = kind === 'reply_error_ok';
  if (/^\s*ERR[:_]/.test(raw)) return { pass: false, reason: 'error' };
  if (!errorExplanationOk && /ERR[:_]/.test(raw)) return { pass: false, reason: 'error' };
  if (kind === 'route_ok') {
    const agent = String(relevance || '').toUpperCase();
    try {
      if (agent && new RegExp('\\[' + agent + '\\][\\s\\S]*?\\[\\/' + agent + '\\]', 'i').test(raw)) return { pass: true, reason: 'ok' };
    } catch {}
    return { pass: false, reason: 'no-route-tag' };
  }
  const r = visibleReply(raw);
  const bare = r.replace(/\[\/?[A-Z][A-Z0-9_]+\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (bare.length < 3) return { pass: false, reason: 'bare-tag-or-empty' };
  if (/\[LOOP\]/i.test(r) && !/\[REPLY\]/i.test(raw)) return { pass: false, reason: 'loop-leak' };
  if (/^(checking now|on it|let me check|calling that now|one moment)\.?$/i.test(bare)) return { pass: false, reason: 'bare-ack' };
  // The build must answer AS THE BUILD, using its real tools in real time — not punt to generic
  // Grok chatbot knowledge. These tells mean it described instead of did, or forgot what it is.
  const GENERIC = /(i am grok|i can only run as grok|built by xai|grok\.x\.ai|as an ai\b|i'?m not connected|i'?m not tracking|i do ?n'?t have (access|visibility|any (information|context)|real-?time)|don'?t have access to (your|the|any)|i can'?t access|i need more details|the question is too vague|too vague to|i'?m happy to help|assuming you'?re? (talking|mean)|also called a (folder|directory)|i'?m not sure what (context|you)|there (is|are) no (ledger|event|context))/i;
  if (GENERIC.test(r)) return { pass: false, reason: 'generic-grok-not-the-build' };
  if (relevance) { try { if (!new RegExp(relevance, 'i').test(r)) return { pass: false, reason: 'off-topic' }; } catch {} }
  return { pass: true, reason: 'ok' };
}
async function buildVersion(env) {
  try { const row = await env.DB.prepare("SELECT value FROM settings WHERE key='build_version'").first(); return row?.value || 'v1'; } catch { return 'v1'; }
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('runs') === '1') {
    const runs = (await env.DB.prepare('SELECT run_id,build_version,ts,total,passed,score,note FROM selftest_runs ORDER BY ts DESC LIMIT 50').all()).results || [];
    return J({ runs, complete_runs: runs.filter(r => r.note === 'complete'), partial_runs: runs.filter(r => r.note !== 'complete') });
  }
  if (url.searchParams.get('graph') === '1') {
    const graphQs = (await env.DB.prepare("SELECT id,args AS step_id,expected_text AS label,last_actual,last_passed,last_run_id FROM directory_tests WHERE kind='graph' ORDER BY tier, id").all()).results || [];
    const lastGraph = (await env.DB.prepare("SELECT run_id,ts,total,passed,score,note FROM selftest_runs WHERE note='graph_populate' ORDER BY ts DESC LIMIT 1").first()) || null;
    return J({ suite: 'graph_populate', last_run: lastGraph, steps: graphQs });
  }
  if (url.searchParams.get('whitelist') === '1') {
    return J({ whitelist: [OWNER], note: 'Owner-only. Enforced by isOwner() in functions/_lib/webhook_intake.js; non-owner senders are routed to the CUSTOMER agent.' });
  }
  if (url.searchParams.get('status') === '1') {
    const master = await selftestMasterOn(env);
    const on = await selftestAutorunOn(env);
    let lock = null;
    if (env.KV) { try { lock = JSON.parse((await env.KV.get('selftest:lock')) || 'null'); } catch {} }
    let todoOn = null;
    if (env.KV) { try { todoOn = await env.KV.get('todo_autorun'); } catch {} }
    return J({
      selftest_master: master ? '1' : '0',
      selftest_autorun: on ? '1' : '0',
      todo_autorun: todoOn || '0',
      lock,
      group: GROUP,
      off: !master,
      autorun_off: !on,
      enable_phrase: SELFTEST_MASTER_ENABLE_PHRASE,
      autorun_enable_phrase: SELFTEST_AUTORUN_ENABLE_PHRASE,
      law: 'MASTER default OFF. Agents cannot re-enable. UI confirm phrase required. Sibling /wf/selftest/trigger blocked while master off.',
    });
  }
  const questions = (await env.DB.prepare("SELECT id,tier,args AS q,expected_text AS expected,expect_value AS match,last_actual,last_passed,last_run_id FROM directory_tests WHERE kind='e2e' ORDER BY tier, id").all()).results || [];
  const lastComplete = await env.DB.prepare("SELECT run_id,build_version,ts,total,passed,score,note FROM selftest_runs WHERE note='complete' ORDER BY ts DESC LIMIT 1").first();
  const latestPartialRun = await env.DB.prepare("SELECT run_id,build_version,ts,total,passed,score,note FROM selftest_runs WHERE note='batched' ORDER BY ts DESC LIMIT 1").first();
  const latestAny = await env.DB.prepare('SELECT run_id,build_version,ts,total,passed,score,note FROM selftest_runs ORDER BY ts DESC LIMIT 1').first();
  return J({ version: await buildVersion(env), count: questions.length, last_run: lastComplete || null, latest_partial_run: latestPartialRun || null, current_run: latestPartialRun || null, latest_any_run: latestAny || null, whitelist: [OWNER], questions });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await authed(request, env))) return J({ error: 'unauthorized' }, 401);
  let b; try { b = await request.json(); } catch { return J({ error: 'bad json' }, 400); }
  const action = b.action || 'run';
  const manual = b.manual === true || b.force === true || b.owner_triggered === true;

  if (action === 'kill') {
    const loopOff = ['imessage_autorun', 'selftest_autorun', 'todo_autorun', 'proactive_msgs', 'protocol_autorun', 'writer_queue_autorun', 'article_qa_autorun', 'oip_review_autorun', 'editorial_board_autorun', 'graph_grow_autorun', 'github_loop_autorun'];
    if (env.KV) {
      for (const k of loopOff) { try { await env.KV.put(k, '0'); } catch {} }
      try { await env.KV.put(SELFTEST_MASTER_KEY, '0'); } catch {}
      try { await env.KV.delete('selftest:lock'); } catch {}
    }
    let sibling = null;
    try {
      const r = await fetch('https://loop-safe-sibling.owner-account.workers.dev/wf/selftest/kill', { method: 'POST', headers: dispatchHeaders(env) });
      sibling = await r.json().catch(() => ({ http: r.status }));
    } catch (e) { sibling = { error: String(e?.message || e) }; }
    return J({ killed: true, selftest_master: '0', imessage_autorun: '0', selftest_autorun: '0', todo_autorun: '0', loops_off: loopOff, lock_cleared: true, sibling });
  }

  // Vault-level master toggle. OFF is free. ON requires exact phrase ENABLE SELFTEST.
  if (action === 'set_master') {
    const wantOn = /^(1|true|on|yes)$/i.test(String(b.value ?? b.master ?? b.on ?? '').trim());
    if (wantOn) {
      if (!confirmPhrase(b, SELFTEST_MASTER_ENABLE_PHRASE)) {
        return J({
          error: 'confirm_required',
          reason: 'selftest_master ON requires confirm phrase',
          phrase: SELFTEST_MASTER_ENABLE_PHRASE,
          law: 'Owner must confirm in /admin/selftest. Agents cannot enable.',
        }, 423);
      }
      if (env.KV) await env.KV.put(SELFTEST_MASTER_KEY, '1');
      return J({ ok: true, selftest_master: '1', note: 'master ON — autorun still separate (set_autorun + phrase)' });
    }
    if (env.KV) {
      await env.KV.put(SELFTEST_MASTER_KEY, '0');
      await env.KV.put('selftest_autorun', '0');
      try { await env.KV.delete('selftest:lock'); } catch {}
    }
    return J({ ok: true, selftest_master: '0', selftest_autorun: '0', note: 'master OFF — all selftest paths blocked until re-confirmed' });
  }

  // Recurring autorun. Requires master ON + confirm phrase ENABLE SELFTEST AUTORUN.
  if (action === 'set_autorun') {
    const wantOn = /^(1|true|on|yes)$/i.test(String(b.value ?? b.autorun ?? b.on ?? '').trim());
    if (wantOn) {
      if (!(await selftestMasterOn(env))) {
        return J({ error: 'master_off', reason: 'selftest_master is OFF — enable master first with confirm ENABLE SELFTEST' }, 423);
      }
      if (!confirmPhrase(b, SELFTEST_AUTORUN_ENABLE_PHRASE)) {
        return J({
          error: 'confirm_required',
          reason: 'selftest_autorun ON requires confirm phrase',
          phrase: SELFTEST_AUTORUN_ENABLE_PHRASE,
        }, 423);
      }
      if (env.KV) await env.KV.put('selftest_autorun', '1');
      return J({ ok: true, selftest_master: '1', selftest_autorun: '1' });
    }
    if (env.KV) {
      await env.KV.put('selftest_autorun', '0');
      try { await env.KV.delete('selftest:lock'); } catch {}
    }
    return J({ ok: true, selftest_autorun: '0' });
  }

  if (action === 'preflight') {
    const missing = preflightIdentity(env);
    return J({
      ok: !missing.length,
      group: GROUP,
      buttercup: BUTTERCUP_NUM,
      pepper: PEPPER_NUM,
      missing_secrets: missing,
      law: 'ButterCup asks TEST questions; Pepper sends answers only; ROUTER never posts to group.',
    });
  }

  if (action === 'add') {
    await env.DB.prepare("INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,expected_text,note) VALUES ('ROUTER','e2e',?,'reply_ok',?,?,?)")
      .bind(String(b.q || ''), String(b.match || ''), String(b.expected || ''), String(b.note || '')).run();
    return J({ ok: true, added: b.q });
  }
  if (action === 'edit') {
    await env.DB.prepare("UPDATE directory_tests SET args=COALESCE(?,args), expected_text=COALESCE(?,expected_text), expect_value=COALESCE(?,expect_value) WHERE id=? AND kind='e2e'")
      .bind(b.q ?? null, b.expected ?? null, b.match ?? null, b.id).run();
    return J({ ok: true, edited: b.id });
  }
  if (action === 'delete') {
    await env.DB.prepare("DELETE FROM directory_tests WHERE id=? AND kind='e2e'").bind(b.id).run();
    return J({ ok: true, deleted: b.id });
  }
  if (action === 'set_version') {
    await env.DB.prepare("INSERT INTO settings (key,value,description,updated_at) VALUES ('build_version',?, 'Self-test build version label', datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at")
      .bind(String(b.version || 'v1')).run();
    return J({ ok: true, version: b.version });
  }

  // Graph populate script — ask → ingest → ask → no-ingest control; populates question graph + ledger.
  if (action === 'graph_run') {
    if (!(await selftestMasterOn(env))) {
      if (env.KV) { try { await env.KV.delete('selftest:lock'); } catch {} }
      return J({ skipped: true, done: true, reason: 'selftest_master OFF — enable from /admin/selftest with confirm ENABLE SELFTEST' });
    }
    if (!manual && !(await selftestAutorunOn(env))) {
      if (env.KV) { try { await env.KV.delete('selftest:lock'); } catch {} }
      return J({ skipped: true, done: true, reason: 'selftest_autorun off (master on; set_autorun + ENABLE SELFTEST AUTORUN)' });
    }
    const ver = await buildVersion(env);
    const notify = b.notify !== false;
    const out = await runGraphPopulate(env, {
      run_id: b.run_id || ('gr_' + Date.now().toString(36)),
      notify,
      sendQuestion: notify ? (t) => sendQuestion(env, t) : null,
      sendAnswer: notify ? (t) => sendAnswer(env, t) : null,
    }, dispatch);
    const commit = (await env.DB.prepare("SELECT value FROM settings WHERE key='build_commit'").first())?.value || '';
    await env.DB.prepare('INSERT INTO selftest_runs (run_id,build_version,commit_sha,total,passed,score,cost,note) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(run_id) DO UPDATE SET total=excluded.total,passed=excluded.passed,score=excluded.score,build_version=excluded.build_version,commit_sha=excluded.commit_sha,cost=excluded.cost,note=excluded.note')
      .bind(out.run_id, ver, commit, out.total, out.passed, out.score, 0, 'graph_populate').run();
    return J(out);
  }

  // action 'run' — batched (a full 25-question run exceeds one invocation window). The tab calls
  // this repeatedly with next_offset under one run_id until done:true.
  // Master OFF blocks everything including manual:true agent/sibling spam.
  if (!(await selftestMasterOn(env))) {
    if (env.KV) { try { await env.KV.delete('selftest:lock'); } catch {} }
    return J({ skipped: true, done: true, reason: 'selftest_master OFF — enable from /admin/selftest with confirm ENABLE SELFTEST' });
  }
  if (!manual && !(await selftestAutorunOn(env))) {
    if (env.KV) { try { await env.KV.delete('selftest:lock'); } catch {} }
    return J({ skipped: true, done: true, reason: 'selftest_autorun off (master on; set_autorun + ENABLE SELFTEST AUTORUN)' });
  }
  const limit = Math.max(1, Math.min(parseInt(b.limit || '1', 10) || 1, 5));
  const offset = Math.max(0, parseInt(b.offset || '0', 10) || 0);
  const ver = await buildVersion(env);
  const commitRow = await env.DB.prepare("SELECT value FROM settings WHERE key='build_commit'").first();
  const runId = b.run_id || ('st_' + (commitRow?.value || 'clean') + '_' + Date.now().toString(36));
  const idMissing = preflightIdentity(env);
  if (idMissing.length) return J({ error: 'selftest identity misconfigured', missing_secrets: idMissing, law: 'Set BLOOIO_API_KEY_BUTTERCUP for questions and BLOOIO_API_KEY_PEPPERUP for answers.' }, 503);
  if (offset === 0 && b.fresh_run) {
    await env.DB.prepare("UPDATE directory_tests SET last_actual=NULL, last_passed=NULL, last_run_id=NULL, last_cost=NULL WHERE kind='e2e'").run();
  }
  // SINGLE SOURCE: only one self-test may send into the group at a time. Concurrent runs (e.g. a
  // stale workflow that is still alive) are rejected here so the group never gets duplicate streams.
  if (env.KV) {
    let lock = null; try { lock = JSON.parse((await env.KV.get('selftest:lock')) || 'null'); } catch {}
    const now = Date.now();
    if (lock && lock.run_id !== runId && (now - (lock.ts || 0)) < 1500000) {
      return J({ error: 'self-test already running', active: lock.run_id, skipped: true });
    }
    try { await env.KV.put('selftest:lock', JSON.stringify({ run_id: runId, ts: now }), { expirationTtl: 1800 }); } catch {}
  }
  const total = (await env.DB.prepare("SELECT COUNT(*) c FROM directory_tests WHERE kind='e2e'").first()).c;
  const rows = (await env.DB.prepare("SELECT id,args,expect_kind,expect_value FROM directory_tests WHERE kind='e2e' ORDER BY tier, id LIMIT ? OFFSET ?").bind(limit, offset).all()).results || [];
  const results = [];
  let idx = offset;
  for (const t of rows) {
    idx++;
    // 1) Question from ButterCup only ([PHONE]). Pepper must never send TEST prompts.
    const qSend = await sendQuestion(env, 'TEST ' + idx + '/' + total + ' — ' + t.args);
    if (qSend.error) {
      results.push({ id: t.id, q: t.args, pass: false, reason: qSend.error, delivered: false, cost: 0, actual: qSend.error });
      continue;
    }
    const qStatus = qSend.status;
    const qMeta = qSend.from ? (' q_from=' + qSend.from) : '';
    // 2) ROUTER answers in-process (no outbound Blooio). actor=selftest tags ledger rows.
    let out = '', qcost = 0;
    // This endpoint is terminal-key authenticated. Preserve that verified authority inside
    // ROUTER tool loops so receipt/trail/replay helpers re-gate under the caller instead of
    // seeing an authority-less internal call.
    const dispatchOpts = {
      actor: 'selftest',
      authContext: { ownerAuthed: true, tokenInfo: null, capFingerprint: null, actor: 'selftest', source: 'authenticated-selftest' },
    };
    if (t.expect_kind === 'route_ok') dispatchOpts.routeOnly = true;
    try { const d = await dispatch(env, 'ROUTER', t.args, dispatchOpts); out = String(d.result == null ? '' : d.result); qcost = d.cost || 0; }
    catch (e) { out = 'ERR:' + (e?.message || String(e)); }
    const vis = (t.expect_kind === 'route_ok' ? out : visibleReply(out)).replace(/\s+/g, ' ').trim();
    // 3) Answer from Pepper ([BUILD_PHONE]) via PEPPERUP key — the only outbound reply in the group.
    const aSend = await sendAnswer(env, (vis || '(no reply)').slice(0, 900));
    const aStatus = aSend.status;
    const delivered = qStatus > 0 && qStatus < 300 && aStatus > 0 && aStatus < 300 && !aSend.error;
    const v = score(out, t.expect_value, t.expect_kind);
    const pass = v.pass && delivered; // a feature only "works" if it answered AND delivered to the group
    const actual = (vis || '').slice(0, 300) + (delivered ? '' : (' [DELIVERY FAILED q=' + qStatus + qMeta + ' a=' + aStatus + (aSend.error ? ' err=' + aSend.error : '') + ']'));
    await env.DB.prepare('UPDATE directory_tests SET last_actual=?, last_passed=?, last_run_id=?, last_cost=? WHERE id=?').bind(actual, pass ? 1 : 0, runId, qcost, t.id).run();
    results.push({ id: t.id, q: t.args, pass, reason: pass ? 'ok' : (delivered ? v.reason : 'delivery-failed'), delivered, cost: qcost, actual });
  }
  const agg = await env.DB.prepare("SELECT COUNT(*) tot, COALESCE(SUM(CASE WHEN last_passed=1 THEN 1 ELSE 0 END),0) pass, COALESCE(SUM(last_cost),0) cost FROM directory_tests WHERE kind='e2e' AND last_run_id=?").bind(runId).first();
  const sc = agg.tot ? Math.round((agg.pass / agg.tot) * 1000) / 10 : 0;
  const commit = (await env.DB.prepare("SELECT value FROM settings WHERE key='build_commit'").first())?.value || '';
  const isDone = offset + rows.length >= total;
  await env.DB.prepare('INSERT INTO selftest_runs (run_id,build_version,commit_sha,total,passed,score,cost,note) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(run_id) DO UPDATE SET total=excluded.total,passed=excluded.passed,score=excluded.score,build_version=excluded.build_version,commit_sha=excluded.commit_sha,cost=excluded.cost,note=excluded.note')
    .bind(runId, ver, commit, agg.tot, agg.pass, sc, agg.cost, isDone ? 'complete' : 'batched').run();
  if (isDone && env.KV) { try { await env.KV.delete('selftest:lock'); } catch {} }

  let reflex = null;
  if (isDone && agg.pass < agg.tot) {
    const runReflex = () => reflexSelftestFailures(env, runId).catch(() => null);
    try { context.waitUntil(runReflex()); } catch { reflex = await runReflex(); }
  }

  // After e2e completes, optionally run graph populate (shell script of ask/ingest steps).
  let graph = null;
  if (isDone && b.run_graph) {
    const runGraph = async () => {
      const g = await runGraphPopulate(env, {
        run_id: 'gr_after_' + runId,
        notify: !!b.graph_notify,
        sendQuestion: b.graph_notify ? (t) => sendQuestion(env, t) : null,
        sendAnswer: b.graph_notify ? (t) => sendAnswer(env, t) : null,
      }, dispatch);
      const commit = (await env.DB.prepare("SELECT value FROM settings WHERE key='build_commit'").first())?.value || '';
      await env.DB.prepare('INSERT INTO selftest_runs (run_id,build_version,commit_sha,total,passed,score,cost,note) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(run_id) DO UPDATE SET total=excluded.total,passed=excluded.passed,score=excluded.score,note=excluded.note')
        .bind(g.run_id, ver, commit, g.total, g.passed, g.score, 0, 'graph_populate').run();
      return g;
    };
    if (b.graph_async) {
      try { context.waitUntil(runGraph()); graph = { pending: true }; } catch { graph = await runGraph(); }
    } else {
      graph = await runGraph();
    }
  }

  return J({ run_id: runId, version: ver, ran: rows.length, tested_so_far: agg.tot, of: total, passed_so_far: agg.pass, score: sc, cost: agg.cost, next_offset: offset + rows.length, done: isDone, results, reflex_pending: isDone && agg.pass < agg.tot && !reflex, reflex, graph });
}
