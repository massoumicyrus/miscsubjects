CREATE TABLE IF NOT EXISTS work_turns (
  turn_id TEXT PRIMARY KEY,          -- turn_<hex>
  task_id TEXT NOT NULL,
  seq INTEGER NOT NULL,              -- order within the task
  role TEXT NOT NULL,                -- 'operator' (the human) | 'agent' | 'system'
  actor TEXT,                        -- model id / who acted
  title TEXT,                        -- short label for the card
  text TEXT,                         -- the message text (operator words verbatim; agent narration)
  tools_json TEXT,                   -- [{name, summary, status}] — tool calls made in this turn
  errors_json TEXT,                  -- [{where, message}] — errors encountered and how resolved
  refs_json TEXT,                    -- receipts / URLs this turn produced
  ts TEXT NOT NULL,
  prev_hash TEXT NOT NULL,           -- chain: sha256(prev_hash + '|' + canonical(payload))
  hash TEXT NOT NULL,
  UNIQUE(task_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_work_turns_task ON work_turns(task_id, seq);
