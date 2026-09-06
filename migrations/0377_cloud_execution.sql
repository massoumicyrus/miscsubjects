-- 0377 — THE CLOUD EXECUTION PLANE
--
-- Before this migration, "run a command" meant "reach the Mac". 95 directory
-- rows pointed at agent.miscsubjects.com. This migration adds the two things
-- that make that a choice rather than a dependency:
--
--   1. directory.execution — one column saying WHERE a capability may run.
--      A capability row already says what it does; it never said where.
--   2. The generic CLOUD_* capabilities — the substrate itself, expressed as
--      ordinary directory rows so flows, cron, agents and REST reach them
--      through the same canonical dispatch as everything else.
--
-- execution values (functions/_lib/execution_routing.js is the authority):
--   cloud            cloud only; if the cloud is down the call fails and says so
--   cloud_preferred  identical either place → cloud first, Mac as fallback
--   cloud_pending    classified cloud-capable, but the row body still hard-codes
--                    a Mac path; NOT rerouted yet. Honest bookkeeping, not a lie.
--   edge_required    genuinely needs that Mac; never silently rerouted
--   either           run where pointed; fall back if that substrate is down
--   NULL             unclassified — behaves exactly as it did before

ALTER TABLE directory ADD COLUMN execution TEXT;

-- Workspaces, jobs and terminals are RECORDS, not container state. A container
-- can be evicted or replaced at any moment; what ran must outlive it.
CREATE TABLE IF NOT EXISTS cloud_workspace (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  name TEXT,
  sandbox_id TEXT NOT NULL,
  cwd TEXT NOT NULL,
  repo TEXT,
  state TEXT NOT NULL DEFAULT 'active',
  persist TEXT NOT NULL DEFAULT 'ephemeral',
  created_at TEXT NOT NULL,
  last_active_at TEXT,
  destroyed_at TEXT,
  work_id TEXT,
  meta TEXT
);

CREATE TABLE IF NOT EXISTS cloud_job (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  sandbox_id TEXT NOT NULL,
  command TEXT NOT NULL,
  cwd TEXT,
  state TEXT NOT NULL,
  exit_code INTEGER,
  started_at TEXT,
  completed_at TEXT,
  workflow_id TEXT,
  stdout_key TEXT,
  stderr_key TEXT,
  stdout_head TEXT,
  stderr_head TEXT,
  error TEXT,
  trace_id TEXT,
  actor TEXT
);

CREATE TABLE IF NOT EXISTS cloud_terminal (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  sandbox_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  cwd TEXT,
  state TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  last_active_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cloud_ws_tenant  ON cloud_workspace(tenant, state);
CREATE INDEX IF NOT EXISTS idx_cloud_job_tenant ON cloud_job(tenant, state);
CREATE INDEX IF NOT EXISTS idx_cloud_job_ws     ON cloud_job(workspace_id);

-- ── the capabilities ─────────────────────────────────────────────────────────
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,runner,execution,updated_at,created_at,enabled,planner_visible,planner_rank)
VALUES
('CLOUD_EXEC','http','POST https://miscsubjects.com/api/cloud/exec','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Run a shell command in this tenant''s CLOUD workspace (Cloudflare Container). No Mac involved.
# WHEN_TO_USE: any ordinary compute — git, node, python, grep, tests, file work — especially when the Mac may be asleep.
# ARGS: $1+ = the whole shell command line (pipes are preserved).
# EX: CLOUD_EXEC printf CLOUD_EXEC_OK
# EX: CLOUD_EXEC cd /workspace/repo && npm test
# RETURNS: {ok, exit, stdout, stderr, duration_ms, workspace_id, execution_substrate}. A non-zero exit is ok:false with the real exit code.
{"cmd":"bash","args":["-lc","$1+"],"timeout":600000}',
 'cloud','edge','cloud','2026-09-06','2026-09-06',1,1,10),

('CLOUD_EXEC_IN','http','POST https://miscsubjects.com/api/cloud/exec','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Same as CLOUD_EXEC but in a NAMED workspace (a cloned repo, a coding session).
# ARGS: $1 = workspace_id (from CLOUD_WORKSPACE_NEW), $2+ = the shell command line.
# EX: CLOUD_EXEC_IN ws_a1b2c3|cd /workspace/repo && git diff
{"workspace":"$1","cmd":"bash","args":["-lc","$2+"],"timeout":600000}',
 'cloud','edge','cloud','2026-09-06','2026-09-06',1,1,11),

('CLOUD_WORKSPACE_NEW','http','POST https://miscsubjects.com/api/cloud/workspace/new','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Create a durable cloud workspace, optionally cloning a git repo into it.
# ARGS: $1 = name, $2 = git repo URL (optional), $3 = fixed workspace id (optional).
# EX: CLOUD_WORKSPACE_NEW review|https://github.com/octocat/Hello-World.git
# RETURNS: {ok, workspace_id, sandbox_id, cwd, clone:{ok,exit,dir,path}}
{"name":"$1","repo":"$2","id":"$3"}',
 'cloud','edge','cloud','2026-09-06','2026-09-06',1,1,12),

('CLOUD_WORKSPACE_STATUS','http','GET https://miscsubjects.com/api/cloud/workspace/status?id=$1','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: One workspace: record + a live probe of whether its container is running.
# ARGS: $1 = workspace_id.
','cloud','edge','cloud','2026-09-06','2026-09-06',1,1,13),

('CLOUD_WORKSPACE_LIST','http','GET https://miscsubjects.com/api/cloud/workspace/list','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Every cloud workspace this tenant owns.
','cloud','edge','cloud','2026-09-06','2026-09-06',1,1,14),

('CLOUD_WORKSPACE_DESTROY','http','POST https://miscsubjects.com/api/cloud/workspace/destroy','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Destroy the container. The RECORD of the workspace and its jobs is kept on purpose.
# ARGS: $1 = workspace_id.
{"id":"$1"}','cloud','edge','cloud','2026-09-06','2026-09-06',1,1,15),

('CLOUD_TERMINAL_NEW','http','POST https://miscsubjects.com/api/cloud/terminal/new','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Open a persistent shell session in a cloud workspace. cwd and exported vars survive between sends.
# ARGS: $1 = workspace_id (blank = the tenant default workspace).
{"workspace":"$1"}','cloud','edge','cloud','2026-09-06','2026-09-06',1,1,16),

('CLOUD_TERMINAL_SEND','http','POST https://miscsubjects.com/api/cloud/terminal/send','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Run a line in an open cloud terminal and read its output.
# ARGS: $1 = terminal_id, $2+ = the line.
# EX: CLOUD_TERMINAL_SEND term_ab12|cd /workspace && pwd
{"terminal_id":"$1","input":"$2+"}','cloud','edge','cloud','2026-09-06','2026-09-06',1,1,17),

('CLOUD_TERMINAL_CLOSE','http','POST https://miscsubjects.com/api/cloud/terminal/close','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Close a cloud terminal session. ARGS: $1 = terminal_id.
{"terminal_id":"$1"}','cloud','edge','cloud','2026-09-06','2026-09-06',1,1,18),

('CLOUD_JOB_START','http','POST https://miscsubjects.com/api/cloud/job/start','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Start a LONG job that outlives the request that started it (Cloudflare Workflow + Sandbox). Returns a job id immediately.
# WHEN_TO_USE: builds, test suites, long clones, anything past a normal HTTP lifetime.
# ARGS: $1 = workspace_id (blank = default), $2+ = the shell script to run.
# EX: CLOUD_JOB_START |npm ci && npm test
# EX: CLOUD_JOB_START ws_a1b2|seq 1 60 | xargs -I{} sh -c "echo tick {} && sleep 2"
{"workspace":"$1","script":"$2+"}','cloud','edge','cloud','2026-09-06','2026-09-06',1,1,19),

('CLOUD_JOB_STATUS','http','GET https://miscsubjects.com/api/cloud/job/status?id=$1','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Read a cloud job: state, exit_code, stdout/stderr head, R2 keys for the full output.
# ARGS: $1 = job_id. States: running | done | failed | timeout | interrupted | cancelled.
','cloud','edge','cloud','2026-09-06','2026-09-06',1,1,20),

('CLOUD_JOB_LIST','http','GET https://miscsubjects.com/api/cloud/job/list','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: This tenant''s cloud jobs, newest first.
','cloud','edge','cloud','2026-09-06','2026-09-06',1,1,21),

('CLOUD_JOB_CANCEL','http','POST https://miscsubjects.com/api/cloud/job/cancel','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Cancel a running cloud job. ARGS: $1 = job_id.
{"id":"$1"}','cloud','edge','cloud','2026-09-06','2026-09-06',1,1,22),

('CLOUD_HEALTH','http','GET https://miscsubjects.com/api/cloud/health','headers:{"x-terminal-key":"$TERMINAL_KEY"}',
 '# WHAT: Machine-readable health of the WHOLE execution plane: cloud sandbox, Mac bridge, active workspaces, jobs by state.
# WHEN_TO_USE: before deciding a capability cannot run. "Mac offline" is not "cannot execute".
# RETURNS: {cloud_available, edge_available, substrates:{cloudflare_sandbox, mac_bridge}, workspaces_active, jobs}
','cloud','edge','cloud','2026-09-06','2026-09-06',1,1,9);
