-- Que: a test-question bank. One row = one question fed through the real ROUTER turn.
-- reply + reasoning trace land back on the row for inspection/scoring. Mirrors the old GAS 'que' sheet.
CREATE TABLE IF NOT EXISTS que (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt     TEXT NOT NULL,                 -- the question / message text
  slug       TEXT NOT NULL DEFAULT 'go',    -- 'go'/'yes' = full ROUTER turn; else a directory KEY
  response   TEXT,                          -- captured output (NULL/'' = pending)
  ts         TEXT,                          -- when run
  meta       TEXT,                          -- trace note
  status     TEXT,                          -- '' pending | done | error
  trace_id   TEXT,                          -- links to LEDGER events = full reasoning + every tool call
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS que_status_idx ON que(status);

INSERT OR REPLACE INTO directory(key,type,target,auth,content,category,allowed_categories,seq,enabled,planner_visible,planner_rank,updated_at) VALUES
('QUE_ADD','fn','queAdd','',
'# Add a question to the test que. $1 = prompt text. $2 = optional slug (default go).
# WHEN_TO_USE: "add to que", "queue this as a test", capturing a question to test later.
["$1","$2"]','audit','',91,1,1,31,strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('QUE_RUN','fn','queRun','',
'# Run pending que rows (max 25/call) through the real ROUTER. Writes response+trace_id+status back.
# Returns {ran,pending}. Re-call until pending=0.
["$1"]','audit','',92,1,1,32,strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('QUE_LIST','fn','queList','',
'# Inspect the que. $1 = '''' | pending | done | error. Returns rows (response truncated 200ch).
# Deep-inspect one: trace_id -> /admin/trace?data=chain&trace=<id>.
["$1"]','audit','',93,1,1,33,strftime('%Y-%m-%dT%H:%M:%SZ','now'));
