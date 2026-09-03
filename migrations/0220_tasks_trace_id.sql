-- 0220 — DB (loop-content-spine).
-- tasks.trace_id: same trace namespace as events.trace_id / agent_turns.trace_id,
-- so a task, the ledger events around it, and the coding-agent turns that worked it
-- are one queryable chain. tasks.trace (free-text summary) is unchanged.
ALTER TABLE tasks ADD COLUMN trace_id TEXT;
CREATE INDEX IF NOT EXISTS tasks_trace_idx ON tasks(trace_id);
CREATE INDEX IF NOT EXISTS tasks_gh_idx ON tasks(google_task_id);
