-- CANONICAL WORK OBJECTS (owner order, 2026-08-04).
--
-- Before this migration the project's operational intelligence lived in files no agent other than
-- the running one could read: CLAUDE.md carried the rules, STATE.md carried what remained
-- unfinished, AGENTS.md carried agent instructions, and a supervising Claude session carried
-- priority, dependency resolution, assignment and the decision that work was done. A fresh agent
-- could not enter the project. A different model could not continue it. Nothing was auditable.
--
-- The invariant this schema exists to hold: every operational fact is a row here, no operational
-- fact exists only in a model's context, a transcript, a Markdown file or an agent's final report,
-- and no agent can move a task to a completed state by asserting that it did the work.
--
-- work_tasks   — the task objects. One row is one bounded unit of work with its own acceptance
--                tests and evidence requirements. Failures are child rows (kind='failure').
-- work_actions — append-only, hash-chained audit. Every lease, progress note, submission,
--                acceptance, refusal and repair is one row. Nothing is ever updated or deleted.

CREATE TABLE IF NOT EXISTS work_tasks (
  id                TEXT PRIMARY KEY,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'work',      -- work | failure | migration | import
  objective         TEXT NOT NULL,
  detail            TEXT,                              -- what "done" looks like, in prose, for the agent
  state             TEXT NOT NULL DEFAULT 'open',      -- see WORK_STATES in functions/_lib/work_object.js
  priority          INTEGER NOT NULL DEFAULT 5,        -- 1 highest .. 9 someday
  depends_on        TEXT NOT NULL DEFAULT '[]',        -- JSON array of task ids that must be 'completed' first
  capabilities      TEXT NOT NULL DEFAULT '[]',        -- JSON array of permitted capability keys
  acceptance        TEXT NOT NULL DEFAULT '[]',        -- JSON array of machine-checkable tests
  evidence_required TEXT NOT NULL DEFAULT '[]',        -- JSON array of required evidence field names
  parent_id         TEXT,                              -- failure objects hang off the task that failed
  supersedes        TEXT,                              -- a revision names what it replaces; nothing is overwritten
  lease_holder      TEXT,
  lease_model       TEXT,
  lease_token       TEXT,
  lease_expires_at  TEXT,
  revision          INTEGER NOT NULL DEFAULT 1,
  failure_count     INTEGER NOT NULL DEFAULT 0,
  last_result       TEXT,                              -- JSON: last mechanical acceptance result
  failure           TEXT,                              -- JSON: failure-object fields when kind='failure'
  completed_at      TEXT,
  prev_hash         TEXT NOT NULL DEFAULT 'genesis',
  hash              TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS work_tasks_state_priority ON work_tasks(state, priority, created_at);
CREATE INDEX IF NOT EXISTS work_tasks_parent ON work_tasks(parent_id);

CREATE TABLE IF NOT EXISTS work_actions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  ts             TEXT NOT NULL,
  task_id        TEXT NOT NULL,
  action         TEXT NOT NULL,                        -- lease | progress | submit | accept | refuse | fail | repair | create | revise
  agent          TEXT,
  model          TEXT,
  capability     TEXT,                                 -- the token identity that authorized it (never the secret)
  task_revision  INTEGER,
  from_state     TEXT,
  to_state       TEXT,
  input          TEXT,                                 -- exact input, JSON
  output         TEXT,                                 -- exact output, JSON
  changed        TEXT,                                 -- files / rows / objects changed, JSON
  tests          TEXT,                                 -- tests run and their results, JSON
  evidence       TEXT,                                 -- evidence submitted, JSON
  result         TEXT,                                 -- accepted | refused | recorded
  parent_action  INTEGER,
  prev_hash      TEXT NOT NULL DEFAULT 'genesis',
  hash           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS work_actions_task ON work_actions(task_id, id);
