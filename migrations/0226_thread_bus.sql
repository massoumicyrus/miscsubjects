-- 0226 — DB. THE MATERIAL THREAD BUS: ledger→state promotion layer (recursion close).
-- Raw ledger stays the immutable tape; this is the compiled, branch-aware protocol memory
-- that every model reads before speaking and appends to when it carries new load.
CREATE TABLE IF NOT EXISTS protocol_threads (
  thread_key   TEXT PRIMARY KEY,          -- e.g. B9:T1
  branch_id    TEXT NOT NULL,             -- B1..B10
  branch_name  TEXT NOT NULL,
  thread_id    TEXT NOT NULL,             -- T1..
  thread_name  TEXT NOT NULL,
  target       TEXT NOT NULL DEFAULT 'oip',
  status       TEXT NOT NULL DEFAULT 'open',   -- open | active | settled | superseded
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS thread_updates (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  target              TEXT NOT NULL,
  thread_key          TEXT,                    -- FK protocol_threads.thread_key
  material_type       TEXT NOT NULL,           -- objection|settlement|patch|breakage|test_result|clarification|new_branch|new_thread|prior_art|owner_ruling|relitigation|open_question|proof_update|branch_update|noise
  material_delta      TEXT NOT NULL,
  actor               TEXT,
  source_kind         TEXT,                    -- model_turn|owner_note|audit|test_result|objection|settlement
  source_url          TEXT,
  source_ledger_event TEXT,                    -- the raw turn's event id
  raw_ledger_event    TEXT,                    -- this POST's own ledger event id
  status              TEXT NOT NULL DEFAULT 'proposed', -- proposed|accepted|rejected|settled|superseded|relitigation_candidate
  relitigation_of     INTEGER,
  owner_note          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at          TEXT
);
CREATE INDEX IF NOT EXISTS thread_updates_target_idx ON thread_updates(target, status);
CREATE INDEX IF NOT EXISTS thread_updates_thread_idx ON thread_updates(thread_key);

-- Seed the ten branches (each with its root thread) + the founding thread of cross-model memory.
INSERT OR IGNORE INTO protocol_threads (thread_key, branch_id, branch_name, thread_id, thread_name, target, status) VALUES
 ('B1:T0','B1','protocol_core','T0','root','oip','open'),
 ('B2:T0','B2','mcp_abstraction','T0','root','oip','open'),
 ('B3:T0','B3','receipts_replay_repair','T0','root','oip','open'),
 ('B4:T0','B4','objection_prosecution','T0','root','oip','active'),
 ('B5:T0','B5','total_structure_philosophy','T0','root','oip-total-structure','active'),
 ('B6:T0','B6','machine_json_traversal','T0','root','oip','active'),
 ('B7:T0','B7','proof_hygiene','T0','root','oip','active'),
 ('B8:T0','B8','security_and_authority','T0','root','oip','open'),
 ('B9:T0','B9','cross_model_memory','T0','root','oip','active'),
 ('B10:T0','B10','product_drop','T0','root','oip','active'),
 ('B9:T1','B9','cross_model_memory','T1','ledger_to_machine_json_promotion','oip','active');

INSERT INTO thread_updates (target, thread_key, material_type, material_delta, actor, source_kind, status, decided_at)
SELECT 'oip','B9:T1','branch_update',
 'The ledger already logs model turns. The missing recursion layer is promotion: materially new model turns must be classified into branch/thread state and appended into machine JSON, so the next model inherits protocol state instead of forcing the owner to re-explain the same context.',
 'gpt-5 + the owner (founding delta)','owner_note','accepted',datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM thread_updates WHERE thread_key='B9:T1');
