-- Task threading: a task can hang under a parent task. NULL = top-level.
ALTER TABLE tasks ADD COLUMN parent_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
