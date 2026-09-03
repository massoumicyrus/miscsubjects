-- 0127: Unify the Tasks API
-- 1. Add DONETASK so agents can close tasks via dispatch.
-- 2. Fix TASKS_ADD so it stores a structured JSON job and includes created_at.
-- 3. Keep ADDTASK/TASKS_LIST in place; this only adds/fixes rows.

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, allowed_categories, planner_visible, planner_rank, enabled, updated_at) VALUES
('DONETASK', 'fn', 'taskDone', '', '# WHAT: Mark a task as done. $1=task_id (number), $2=optional result summary.
# WHEN_TO_USE: a queued task has been completed and should be removed from the open backlog.
# ARGS: $1=task_id, $2=result summary
# EX: [DONETASK]123[/DONETASK]
["$1","$2"]', 'tasks', NULL, 1, 1, 1, datetime('now'));

UPDATE directory SET content = '# WHAT: Add a new task to the queue. $1=title/ask, $2=description/context, $3=priority(P0/P1/P2/P3), $4=assigned_to_agent/role. Stores a structured JSON job so the cron runner can execute it.
# WHEN_TO_USE: queue work for the build to execute later (writer jobs, audits, fixes).
# ARGS: $1=title/ask, $2=description, $3=priority, $4=role/agent
# EX: [TASKS_ADD]write article about BPC-157|evidence-graded review|P2|writer[/TASKS_ADD]
D1_EXEC: INSERT INTO tasks (created_at, status, body, source, trace) VALUES (datetime(''now''), ''open'', json_object(''ask'', ''$1'', ''role'', COALESCE(''$4'',''writer''), ''priority'', ''$3'', ''notes'', ''$2''), COALESCE(''$4'',''writer''), ''$3'')', updated_at = datetime('now') WHERE key = 'TASKS_ADD';
