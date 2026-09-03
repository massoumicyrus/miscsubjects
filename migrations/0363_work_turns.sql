-- PUBLIC WORK TURNS (owner order 2026-08-28): the build is going public, so the operator wants the
-- session behind a work object — his verbatim instructions, every tool call, every error — visible
-- as inspectable state cards, the same way the ledger renders turns as widgets. This is a CURATED,
-- SANITIZED, READ-ONLY projection, not the raw admin ledger: it is populated deliberately through the
-- guarded append path (which strips secrets), it is hash-chained so a reader can prove nothing was
-- edited after the fact, and it exposes no write surface. Security is the point — the raw ledger stays
-- private; only what is explicitly published here is public.
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
