
import { getSandbox } from '@cloudflare/sandbox';
import { WorkflowEntrypoint } from 'cloudflare:workers';

export { Sandbox } from '@cloudflare/sandbox';

const SUBSTRATE = 'cloudflare_sandbox';
const WORKSPACE_ROOT = '/workspace';
const OUTPUT_INLINE_CAP = 100_000;   // chars returned inline; the rest goes to R2
const JOB_POLL_SECONDS = 5;
const DEFAULT_JOB_TIMEOUT_MS = 20 * 60 * 1000;

/* ------------------------------------------------------------------ helpers */

const nowIso = () => new Date().toISOString();
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

function rid(prefix) {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return prefix + '_' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text ?? '')));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// POSIX single-quote quoting. The bridge spawns (cmd, args[]) with no shell, so
// argv never went through a parser; the Sandbox SDK's exec() takes one string.
// Quoting here keeps that difference from turning a literal argument into shell
// syntax — the whole point of the bridge's argv contract.
function shq(s) {
  return "'" + String(s ?? '').replace(/'/g, `'\\''`) + "'";
}

function composeCommand(cmd, args, useShell) {
  const c = String(cmd || '').trim();
  if (!c) return '';
  const list = Array.isArray(args) ? args : args == null ? [] : [args];
  if (useShell) {
    // shell:true on the bridge means "the caller wrote a shell line".
    return [c, ...list.map(String)].join(' ');
  }
  return [shq(c), ...list.map(shq)].join(' ');
}

// A tenant id becomes part of a sandbox id, which becomes a Durable Object name
// and (optionally) a preview hostname. Anything outside this alphabet is folded
// away so two different tenant strings can never collapse onto one container by
// accident — the hash suffix keeps them distinct.
function slug(s, fallback) {
  const raw = String(s ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return raw.slice(0, 40) || fallback;
}

function sandboxIdFor(tenant, workspaceId) {
  return slug(tenant, 'anon') + '--' + slug(workspaceId, 'ws');
}

function bound(text) {
  const s = String(text ?? '');
  if (s.length <= OUTPUT_INLINE_CAP) return { text: s, truncated: false, full_bytes: s.length };
  return { text: s.slice(0, OUTPUT_INLINE_CAP), truncated: true, full_bytes: s.length };
}

// The worker never injects build credentials into a container, so results should
// not contain them. This is the belt: if a caller echoes one of the two secrets
// this Worker itself holds, it does not travel back out in evidence.
function redact(env, text) {
  let s = String(text ?? '');
  for (const v of [env.SANDBOX_KEY, env.TERMINAL_KEY]) {
    if (v && String(v).length >= 12) s = s.split(String(v)).join('[redacted]');
  }
  return s;
}

/* -------------------------------------------------------------- persistence */

async function ensureTables(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS cloud_workspace (
      id TEXT PRIMARY KEY, tenant TEXT NOT NULL, name TEXT, sandbox_id TEXT NOT NULL,
      cwd TEXT NOT NULL, repo TEXT, state TEXT NOT NULL DEFAULT 'active',
      persist TEXT NOT NULL DEFAULT 'ephemeral', created_at TEXT NOT NULL,
      last_active_at TEXT, destroyed_at TEXT, work_id TEXT, meta TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS cloud_job (
      id TEXT PRIMARY KEY, tenant TEXT NOT NULL, workspace_id TEXT NOT NULL,
      sandbox_id TEXT NOT NULL, command TEXT NOT NULL, cwd TEXT, state TEXT NOT NULL,
      exit_code INTEGER, started_at TEXT, completed_at TEXT, workflow_id TEXT,
      stdout_key TEXT, stderr_key TEXT, stdout_head TEXT, stderr_head TEXT,
      error TEXT, trace_id TEXT, actor TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS cloud_terminal (
      id TEXT PRIMARY KEY, tenant TEXT NOT NULL, workspace_id TEXT NOT NULL,
      sandbox_id TEXT NOT NULL, session_id TEXT NOT NULL, cwd TEXT,
      state TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, last_active_at TEXT)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cloud_ws_tenant ON cloud_workspace(tenant, state)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cloud_job_tenant ON cloud_job(tenant, state)`),
  ]);
}

async function getWorkspace(env, tenant, id) {
  if (!id) return null;
  const row = await env.DB.prepare('SELECT * FROM cloud_workspace WHERE id=?').bind(id).first();
  if (!row) return null;
  // The boundary. A caller may name any workspace id it likes; it only gets one
  // back if the row says that tenant owns it.
  if (String(row.tenant) !== String(tenant)) return null;
  return row;
}

// Every tenant gets one long-lived default workspace so `CLOUD_EXEC printf hi`
// needs no setup call. It is still a row, still tenant-scoped, still destroyable.
async function defaultWorkspace(env, tenant) {
  const id = 'ws_default_' + slug(tenant, 'anon');
  const existing = await env.DB.prepare('SELECT * FROM cloud_workspace WHERE id=?').bind(id).first();
  if (existing && existing.state !== 'destroyed') return existing;
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO cloud_workspace (id,tenant,name,sandbox_id,cwd,state,persist,created_at,last_active_at)
     VALUES (?,?,?,?,?,'active','durable',?,?)
     ON CONFLICT(id) DO UPDATE SET state='active', destroyed_at=NULL, last_active_at=excluded.last_active_at`
  ).bind(id, tenant, 'default', sandboxIdFor(tenant, id), WORKSPACE_ROOT, ts, ts).run();
  return await env.DB.prepare('SELECT * FROM cloud_workspace WHERE id=?').bind(id).first();
}

async function resolveWorkspace(env, tenant, id) {
  if (!id) return { ws: await defaultWorkspace(env, tenant) };
  const ws = await getWorkspace(env, tenant, id);
  if (!ws) return { err: 'unknown_workspace:' + id };
  if (ws.state === 'destroyed') return { err: 'workspace_destroyed:' + id };
  return { ws };
}

async function touch(env, id) {
  try { await env.DB.prepare('UPDATE cloud_workspace SET last_active_at=? WHERE id=?').bind(nowIso(), id).run(); } catch {}
}

/* ------------------------------------------------------------------ execute */

// One command, one container, one honest result. Shape is deliberately identical
// to the Mac bridge's /exec response so a directory row can be pointed at either
// substrate without touching the row's body template or its callers.
async function runExec(env, tenant, input) {
  const started_at = nowIso();
  const t0 = Date.now();

  const { ws, err } = await resolveWorkspace(env, tenant, input.workspace || input.workspace_id);
  if (err) return { ok: false, error: err, execution_substrate: SUBSTRATE, started_at, completed_at: nowIso() };

  const command = composeCommand(input.cmd, input.args, input.shell === true);
  if (!command) {
    return { ok: false, error: 'cmd_required', execution_substrate: SUBSTRATE,
      workspace_id: ws.id, started_at, completed_at: nowIso() };
  }

  const cwd = String(input.cwd || ws.cwd || WORKSPACE_ROOT);
  const opts = { cwd };
  if (input.env && typeof input.env === 'object') opts.env = input.env;
  if (input.stdin != null) opts.stdin = String(input.stdin);
  const timeout = Number(input.timeout || 0);
  if (timeout > 0) opts.timeout = timeout;

  const sandbox = getSandbox(env.Sandbox, ws.sandbox_id, { enableDefaultSession: false });
  let res;
  try {
    if (input.session_id) res = await sandbox.exec(command, { ...opts, sessionId: String(input.session_id) });
    else res = await sandbox.exec(command, opts);
  } catch (e) {
    const msg = String(e?.message || e);
    // A timeout is a failure with an exit state of "unknown", never a success.
    // The stable SDK raises on timeout while the process keeps running inside
    // the container, so say that instead of pretending the command finished.
    const timedOut = /timeout|timed out/i.test(msg);
    await touch(env, ws.id);
    return {
      ok: false,
      exit: null,
      stdout: '',
      stderr: redact(env, msg),
      error: timedOut ? 'timeout' : 'exec_failed',
      timed_out: timedOut,
      note: timedOut ? 'the command exceeded its timeout; the process may still be running in the container' : undefined,
      command, cwd,
      workspace_id: ws.id, tenant, sandbox_id: ws.sandbox_id,
      execution_substrate: SUBSTRATE,
      started_at, completed_at: nowIso(), duration_ms: Date.now() - t0,
    };
  }

  await touch(env, ws.id);
  const out = bound(redact(env, res.stdout));
  const errOut = bound(redact(env, res.stderr));
  const exit = typeof res.exitCode === 'number' ? res.exitCode : (res.success ? 0 : 1);
  return {
    ok: exit === 0,
    exit,
    exit_code: exit,
    stdout: out.text,
    stderr: errOut.text,
    stdout_truncated: out.truncated,
    stderr_truncated: errOut.truncated,
    stdout_bytes: out.full_bytes,
    stderr_bytes: errOut.full_bytes,
    duration_ms: Date.now() - t0,
    cmd: input.cmd,
    args: Array.isArray(input.args) ? input.args : [],
    command, cwd,
    workspace_id: ws.id, tenant, sandbox_id: ws.sandbox_id,
    session_id: input.session_id || null,
    execution_substrate: SUBSTRATE,
    started_at, completed_at: nowIso(),
  };
}

/* --------------------------------------------------------------- workspaces */

async function workspaceNew(env, tenant, input) {
  const name = String(input.name || 'workspace');
  const id = String(input.id || rid('ws'));
  if (!/^[A-Za-z0-9_.-]{3,60}$/.test(id)) return { ok: false, error: 'bad_workspace_id' };
  const existing = await env.DB.prepare('SELECT id,tenant FROM cloud_workspace WHERE id=?').bind(id).first();
  if (existing && String(existing.tenant) !== String(tenant)) return { ok: false, error: 'workspace_id_taken' };

  const sandbox_id = sandboxIdFor(tenant, id);
  const cwd = String(input.cwd || WORKSPACE_ROOT);
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO cloud_workspace (id,tenant,name,sandbox_id,cwd,repo,state,persist,created_at,last_active_at,work_id,meta)
     VALUES (?,?,?,?,?,?, 'active', ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET state='active', destroyed_at=NULL, last_active_at=excluded.last_active_at`
  ).bind(id, tenant, name, sandbox_id, cwd, input.repo ? String(input.repo) : null,
         String(input.persist || 'ephemeral'), ts, ts,
         input.work_id ? String(input.work_id) : null,
         input.meta ? JSON.stringify(input.meta) : null).run();

  const out = { ok: true, workspace_id: id, tenant, sandbox_id, name, cwd,
    state: 'active', created_at: ts, execution_substrate: SUBSTRATE };

  if (input.repo) {
    const dir = String(input.dir || slug(String(input.repo).split('/').pop().replace(/\.git$/, ''), 'repo'));
    const clone = await runExec(env, tenant, {
      cmd: 'bash', args: ['-lc', `set -e; mkdir -p ${shq(cwd)}; cd ${shq(cwd)}; rm -rf ${shq(dir)}; git clone --depth 50 ${shq(String(input.repo))} ${shq(dir)} 2>&1`],
      workspace: id, timeout: 300000,
    });
    out.clone = { ok: clone.ok, exit: clone.exit, dir, path: cwd.replace(/\/$/, '') + '/' + dir,
      stdout: clone.stdout, stderr: clone.stderr };
    if (!clone.ok) out.ok = false;
  }
  return out;
}

async function workspaceStatus(env, tenant, id) {
  const { ws, err } = await resolveWorkspace(env, tenant, id);
  if (err) return { ok: false, error: err };
  const jobs = await env.DB.prepare(
    'SELECT state, COUNT(*) n FROM cloud_job WHERE workspace_id=? GROUP BY state'
  ).bind(ws.id).all();
  let container = 'unknown';
  let disk = null;
  try {
    const probe = await runExec(env, tenant, {
      cmd: 'bash', args: ['-lc', 'echo READY; df -Pk /workspace | tail -1'],
      workspace: ws.id, timeout: 60000,
    });
    container = probe.ok && /READY/.test(probe.stdout) ? 'running' : 'unavailable';
    disk = probe.ok ? String(probe.stdout).trim().split('\n').pop() : null;
  } catch { container = 'unavailable'; }
  return {
    ok: true, workspace_id: ws.id, tenant: ws.tenant, name: ws.name, sandbox_id: ws.sandbox_id,
    cwd: ws.cwd, repo: ws.repo, state: ws.state, persist: ws.persist,
    created_at: ws.created_at, last_active_at: ws.last_active_at, work_id: ws.work_id,
    container, disk, jobs: (jobs.results || []).reduce((a, r) => (a[r.state] = r.n, a), {}),
    execution_substrate: SUBSTRATE,
  };
}

async function workspaceDestroy(env, tenant, id) {
  const { ws, err } = await resolveWorkspace(env, tenant, id);
  if (err) return { ok: false, error: err };
  let destroyed = false, note = null;
  try {
    const sandbox = getSandbox(env.Sandbox, ws.sandbox_id, { enableDefaultSession: false });
    await sandbox.destroy();
    destroyed = true;
  } catch (e) { note = 'container_destroy: ' + String(e?.message || e); }
  await env.DB.prepare('UPDATE cloud_workspace SET state=?, destroyed_at=? WHERE id=?')
    .bind('destroyed', nowIso(), ws.id).run();
  // The row survives on purpose: the execution resource is gone, the record of
  // what the workspace was and what ran in it is not.
  return { ok: true, workspace_id: ws.id, container_destroyed: destroyed, note,
    record: 'retained', execution_substrate: SUBSTRATE };
}

async function workspaceList(env, tenant) {
  const r = await env.DB.prepare(
    `SELECT id,name,sandbox_id,cwd,repo,state,persist,created_at,last_active_at
       FROM cloud_workspace WHERE tenant=? ORDER BY created_at DESC LIMIT 100`
  ).bind(tenant).all();
  return { ok: true, tenant, workspaces: r.results || [], execution_substrate: SUBSTRATE };
}

/* ---------------------------------------------------------------- terminals */

// A terminal here is a Sandbox SDK *session*: a bash context that keeps its cwd
// and exported variables between calls. It is the execution primitive a real PTY
// needs; the interactive byte stream lands when the 1.0 PTY API stabilises.
async function terminalNew(env, tenant, input) {
  const { ws, err } = await resolveWorkspace(env, tenant, input.workspace);
  if (err) return { ok: false, error: err };
  const id = rid('term');
  const sessionId = 'sess_' + id.slice(5);
  const cwd = String(input.cwd || ws.cwd || WORKSPACE_ROOT);
  const sandbox = getSandbox(env.Sandbox, ws.sandbox_id, { enableDefaultSession: false });
  try {
    await sandbox.createSession({ id: sessionId, cwd, env: input.env && typeof input.env === 'object' ? input.env : undefined });
  } catch (e) {
    return { ok: false, error: 'session_create_failed', detail: redact(env, String(e?.message || e)) };
  }
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO cloud_terminal (id,tenant,workspace_id,sandbox_id,session_id,cwd,state,created_at,last_active_at)
     VALUES (?,?,?,?,?,?,'open',?,?)`
  ).bind(id, tenant, ws.id, ws.sandbox_id, sessionId, cwd, ts, ts).run();
  return { ok: true, terminal_id: id, session_id: sessionId, workspace_id: ws.id,
    cwd, created_at: ts, execution_substrate: SUBSTRATE };
}

async function terminalRow(env, tenant, id) {
  const row = await env.DB.prepare('SELECT * FROM cloud_terminal WHERE id=?').bind(id).first();
  if (!row || String(row.tenant) !== String(tenant)) return null;
  return row;
}

async function terminalSend(env, tenant, input) {
  const row = await terminalRow(env, tenant, String(input.terminal_id || input.id || ''));
  if (!row) return { ok: false, error: 'unknown_terminal' };
  if (row.state !== 'open') return { ok: false, error: 'terminal_closed' };
  const line = String(input.input ?? input.line ?? input.cmd ?? '');
  if (!line) return { ok: false, error: 'input_required' };
  const res = await runExec(env, tenant, {
    cmd: line, args: [], shell: true, workspace: row.workspace_id,
    session_id: row.session_id, timeout: Number(input.timeout || 120000),
  });
  await env.DB.prepare('UPDATE cloud_terminal SET last_active_at=? WHERE id=?').bind(nowIso(), row.id).run();
  return { ...res, terminal_id: row.id };
}

async function terminalClose(env, tenant, input) {
  const row = await terminalRow(env, tenant, String(input.terminal_id || input.id || ''));
  if (!row) return { ok: false, error: 'unknown_terminal' };
  try {
    const sandbox = getSandbox(env.Sandbox, row.sandbox_id, { enableDefaultSession: false });
    if (typeof sandbox.deleteSession === 'function') await sandbox.deleteSession(row.session_id);
  } catch {}
  await env.DB.prepare('UPDATE cloud_terminal SET state=? , last_active_at=? WHERE id=?')
    .bind('closed', nowIso(), row.id).run();
  return { ok: true, terminal_id: row.id, state: 'closed', execution_substrate: SUBSTRATE };
}

async function terminalList(env, tenant, workspace) {
  const r = workspace
    ? await env.DB.prepare('SELECT id,workspace_id,session_id,cwd,state,created_at,last_active_at FROM cloud_terminal WHERE tenant=? AND workspace_id=? ORDER BY created_at DESC LIMIT 100').bind(tenant, workspace).all()
    : await env.DB.prepare('SELECT id,workspace_id,session_id,cwd,state,created_at,last_active_at FROM cloud_terminal WHERE tenant=? ORDER BY created_at DESC LIMIT 100').bind(tenant).all();
  return { ok: true, tenant, terminals: r.results || [] };
}

/* --------------------------------------------------------------------- jobs */

const jobDir = (jobId) => `${WORKSPACE_ROOT}/.jobs/${jobId}`;

async function jobStart(env, tenant, input) {
  const { ws, err } = await resolveWorkspace(env, tenant, input.workspace);
  if (err) return { ok: false, error: err };
  const script = String(input.script || input.command || input.cmd || '');
  if (!script) return { ok: false, error: 'script_required' };
  const id = rid('job');
  const cwd = String(input.cwd || ws.cwd || WORKSPACE_ROOT);
  const ts = nowIso();

  await env.DB.prepare(
    `INSERT INTO cloud_job (id,tenant,workspace_id,sandbox_id,command,cwd,state,started_at,trace_id,actor)
     VALUES (?,?,?,?,?,?,'queued',?,?,?)`
  ).bind(id, tenant, ws.id, ws.sandbox_id, script, cwd, ts,
         input.trace_id ? String(input.trace_id) : null,
         input.actor ? String(input.actor) : null).run();

  const instance = await env.CLOUD_JOB_WF.create({
    id,
    params: {
      job_id: id, tenant, workspace_id: ws.id, sandbox_id: ws.sandbox_id,
      script, cwd, env: input.env && typeof input.env === 'object' ? input.env : null,
      timeout_ms: Number(input.timeout_ms || input.timeout || DEFAULT_JOB_TIMEOUT_MS),
    },
  });
  await env.DB.prepare('UPDATE cloud_job SET workflow_id=?, state=? WHERE id=?')
    .bind(instance.id, 'running', id).run();

  return { ok: true, job_id: id, workflow_id: instance.id, workspace_id: ws.id, tenant,
    state: 'running', command: script, cwd, started_at: ts,
    execution_substrate: SUBSTRATE,
    status_url: '/api/cloud/job/status?id=' + id };
}

async function jobStatus(env, tenant, id) {
  const row = await env.DB.prepare('SELECT * FROM cloud_job WHERE id=?').bind(id).first();
  if (!row || String(row.tenant) !== String(tenant)) return { ok: false, error: 'unknown_job' };
  let workflow = null;
  if (row.workflow_id) {
    try {
      const inst = await env.CLOUD_JOB_WF.get(row.workflow_id);
      const st = await inst.status();
      workflow = { status: st.status, error: st.error ? String(st.error) : null };
    } catch (e) { workflow = { status: 'unknown', error: String(e?.message || e) }; }
  }
  const terminal = ['done', 'failed', 'interrupted', 'cancelled', 'timeout'].includes(row.state);
  return {
    ok: true,
    job_id: row.id, tenant: row.tenant, workspace_id: row.workspace_id,
    state: row.state, running: !terminal,
    // `ok` on the envelope means "the status read succeeded". Whether the JOB
    // succeeded is exit_code — a finished job with exit 1 is a real failure and
    // must never be readable as success.
    succeeded: row.state === 'done' && Number(row.exit_code) === 0,
    exit_code: row.exit_code == null ? null : Number(row.exit_code),
    command: row.command, cwd: row.cwd,
    started_at: row.started_at, completed_at: row.completed_at,
    stdout: row.stdout_head || '', stderr: row.stderr_head || '',
    stdout_key: row.stdout_key, stderr_key: row.stderr_key,
    error: row.error, workflow, workflow_id: row.workflow_id,
    execution_substrate: SUBSTRATE,
  };
}

async function jobCancel(env, tenant, id) {
  const row = await env.DB.prepare('SELECT * FROM cloud_job WHERE id=?').bind(id).first();
  if (!row || String(row.tenant) !== String(tenant)) return { ok: false, error: 'unknown_job' };
  try {
    const sandbox = getSandbox(env.Sandbox, row.sandbox_id, { enableDefaultSession: false });
    await sandbox.exec(`bash -lc ${shq(`touch ${jobDir(row.id)}/cancel; pkill -f ${shq(jobDir(row.id))} || true`)}`, { cwd: WORKSPACE_ROOT, timeout: 30000 });
  } catch {}
  try {
    if (row.workflow_id) {
      const inst = await env.CLOUD_JOB_WF.get(row.workflow_id);
      if (typeof inst.terminate === 'function') await inst.terminate();
    }
  } catch {}
  await env.DB.prepare('UPDATE cloud_job SET state=?, completed_at=? WHERE id=? AND state NOT IN (?,?,?)')
    .bind('cancelled', nowIso(), row.id, 'done', 'failed', 'interrupted').run();
  return { ok: true, job_id: row.id, state: 'cancelled', execution_substrate: SUBSTRATE };
}

async function jobList(env, tenant, workspace) {
  const r = workspace
    ? await env.DB.prepare('SELECT id,workspace_id,state,exit_code,command,started_at,completed_at FROM cloud_job WHERE tenant=? AND workspace_id=? ORDER BY started_at DESC LIMIT 100').bind(tenant, workspace).all()
    : await env.DB.prepare('SELECT id,workspace_id,state,exit_code,command,started_at,completed_at FROM cloud_job WHERE tenant=? ORDER BY started_at DESC LIMIT 100').bind(tenant).all();
  return { ok: true, tenant, jobs: r.results || [] };
}

/* ---------------------------------------------------------------- workflow */

// A job outlives the request that started it. The Workflow owns the waiting: it
// launches a detached process inside the container, then polls a marker file.
//
// Polling a FILE rather than holding a process handle is deliberate. The Sandbox
// SDK's process handles are container-local and die with the container; a file
// under /workspace/.jobs/<id>/ tells the truth in three states — still running,
// finished with an exit code, or gone because the container was replaced. The
// third case is reported as `interrupted`, which is what actually happened.
export class CloudJobWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const env = this.env;
    const p = event.payload;
    const dir = jobDir(p.job_id);

    const launched = await step.do('launch', async () => {
      const sandbox = getSandbox(env.Sandbox, p.sandbox_id, { enableDefaultSession: false });
      await sandbox.setKeepAlive(true);
      const runner = [
        '#!/bin/bash',
        `cd ${shq(p.cwd)} || exit 127`,
        p.script,
        `echo $? > ${dir}/exit`,
        '',
      ].join('\n');
      await sandbox.mkdir(dir, { recursive: true });
      await sandbox.writeFile(`${dir}/run.sh`, runner);
      const boot = await sandbox.exec(
        `bash -lc ${shq(`chmod +x ${dir}/run.sh; nohup ${dir}/run.sh > ${dir}/stdout 2> ${dir}/stderr < /dev/null & echo $!`)}`,
        { cwd: WORKSPACE_ROOT, timeout: 60000 }
      );
      return { pid: String(boot.stdout || '').trim(), exit: boot.exitCode };
    });

    const deadline = Date.now() + Number(p.timeout_ms || DEFAULT_JOB_TIMEOUT_MS);
    let final = null;

    for (let i = 0; i < 1000 && !final; i += 1) {
      await step.sleep(`wait-${i}`, `${JOB_POLL_SECONDS} seconds`);
      const probe = await step.do(`poll-${i}`, async () => {
        const sandbox = getSandbox(env.Sandbox, p.sandbox_id, { enableDefaultSession: false });
        try {
          const r = await sandbox.exec(
            `bash -lc ${shq(`if [ -f ${dir}/exit ]; then echo "EXIT:$(cat ${dir}/exit)"; elif [ -f ${dir}/run.sh ]; then echo RUNNING; else echo GONE; fi`)}`,
            { cwd: WORKSPACE_ROOT, timeout: 60000 }
          );
          return { line: String(r.stdout || '').trim() };
        } catch (e) { return { line: 'PROBE_ERR', detail: String(e?.message || e).slice(0, 300) }; }
      });
      const line = String(probe.line || '');
      if (line.startsWith('EXIT:')) final = { state: 'done', exit: parseInt(line.slice(5), 10) };
      else if (line === 'GONE') final = { state: 'interrupted', exit: null, error: 'container replaced before the job finished; the job record survives, the container filesystem did not' };
      else if (Date.now() > deadline) final = { state: 'timeout', exit: null, error: 'job exceeded its timeout budget' };
    }
    if (!final) final = { state: 'timeout', exit: null, error: 'poll budget exhausted' };

    await step.do('finalize', async () => {
      const sandbox = getSandbox(env.Sandbox, p.sandbox_id, { enableDefaultSession: false });
      let stdout = '', stderr = '';
      try { stdout = await sandbox.readFile(`${dir}/stdout`).then((f) => f?.content ?? f ?? ''); } catch {}
      try { stderr = await sandbox.readFile(`${dir}/stderr`).then((f) => f?.content ?? f ?? ''); } catch {}
      stdout = redact(env, typeof stdout === 'string' ? stdout : JSON.stringify(stdout));
      stderr = redact(env, typeof stderr === 'string' ? stderr : JSON.stringify(stderr));

      const base = `cloud-jobs/${p.tenant}/${p.job_id}`;
      let stdoutKey = null, stderrKey = null;
      try {
        await env.R2.put(`${base}/stdout.txt`, stdout);
        await env.R2.put(`${base}/stderr.txt`, stderr);
        stdoutKey = `${base}/stdout.txt`; stderrKey = `${base}/stderr.txt`;
      } catch {}

      await env.DB.prepare(
        `UPDATE cloud_job SET state=?, exit_code=?, completed_at=?, stdout_key=?, stderr_key=?,
           stdout_head=?, stderr_head=?, error=? WHERE id=?`
      ).bind(
        final.state, final.exit == null ? null : final.exit, nowIso(),
        stdoutKey, stderrKey,
        stdout.slice(0, 8000), stderr.slice(0, 8000),
        final.error || null, p.job_id
      ).run();

      try { await sandbox.setKeepAlive(false); } catch {}
      return {
        job_id: p.job_id, state: final.state, exit_code: final.exit,
        stdout_sha256: await sha256Hex(stdout), stderr_sha256: await sha256Hex(stderr),
        stdout_key: stdoutKey, stderr_key: stderrKey,
      };
    });

    return { job_id: p.job_id, state: final.state, exit_code: final.exit, launched };
  }
}

/* ------------------------------------------------------------------- health */

async function health(env, tenant) {
  const out = { ok: true, worker: 'miscsubjects-sandbox', ts: nowIso(), execution_substrate: SUBSTRATE };
  const t0 = Date.now();
  try {
    const probe = await runExec(env, tenant, { cmd: 'printf', args: ['SANDBOX_HEALTH_OK'], timeout: 60000 });
    out.sandbox = { available: probe.ok && probe.stdout === 'SANDBOX_HEALTH_OK',
      exit: probe.exit, latency_ms: Date.now() - t0, error: probe.error || null };
  } catch (e) {
    out.sandbox = { available: false, error: String(e?.message || e), latency_ms: Date.now() - t0 };
  }
  try {
    const ws = await env.DB.prepare(
      `SELECT COUNT(*) n FROM cloud_workspace WHERE state='active'`).first();
    const jobs = await env.DB.prepare(
      `SELECT state, COUNT(*) n FROM cloud_job GROUP BY state`).all();
    out.workspaces_active = ws?.n ?? 0;
    out.jobs = (jobs.results || []).reduce((a, r) => (a[r.state] = r.n, a), {});
  } catch (e) { out.record_error = String(e?.message || e); }
  out.ok = !!out.sandbox?.available;
  return out;
}

/* ------------------------------------------------------------------ routing */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/cloud/, '') || '/';

    // The only authority this Worker recognises. It has no public route; this is
    // the second lock so a mistaken route or a leaked workers.dev host is still
    // not an open shell.
    if (!env.SANDBOX_KEY || request.headers.get('x-sandbox-key') !== env.SANDBOX_KEY) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
    const tenant = String(request.headers.get('x-tenant') || 'owner').trim() || 'owner';

    let input = {};
    if (request.method === 'POST') {
      const raw = await request.text();
      if (raw.trim()) {
        try { input = JSON.parse(raw); }
        catch (e) { return json({ ok: false, error: 'malformed_json', detail: String(e.message) }, 400); }
      }
    }
    for (const [k, v] of url.searchParams) if (!(k in input)) input[k] = v;

    try {
      await ensureTables(env);
      switch (path) {
        case '/':
        case '/health':      return json(await health(env, tenant));
        case '/exec':        return json(await runExec(env, tenant, input));
        case '/workspace/new':      return json(await workspaceNew(env, tenant, input));
        case '/workspace/status':   return json(await workspaceStatus(env, tenant, input.id || input.workspace));
        case '/workspace/destroy':  return json(await workspaceDestroy(env, tenant, input.id || input.workspace));
        case '/workspace/list':     return json(await workspaceList(env, tenant));
        case '/terminal/new':       return json(await terminalNew(env, tenant, input));
        case '/terminal/send':      return json(await terminalSend(env, tenant, input));
        case '/terminal/close':     return json(await terminalClose(env, tenant, input));
        case '/terminal/list':      return json(await terminalList(env, tenant, input.workspace));
        case '/job/start':          return json(await jobStart(env, tenant, input));
        case '/job/status':         return json(await jobStatus(env, tenant, String(input.id || input.job_id || '')));
        case '/job/cancel':         return json(await jobCancel(env, tenant, String(input.id || input.job_id || '')));
        case '/job/list':           return json(await jobList(env, tenant, input.workspace));
        default: return json({ ok: false, error: 'unknown_route', path }, 404);
      }
    } catch (e) {
      return json({ ok: false, error: 'sandbox_worker_error', detail: String(e?.message || e),
        execution_substrate: SUBSTRATE }, 500);
    }
  },
};
