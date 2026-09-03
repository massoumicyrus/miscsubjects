-- OIP v0.8 — TRAILS (DB db: loop-content-spine). A trail is a named sequence of past
-- invocations harvested from the ledger, replayable as one unit. Every re-fired step
-- gets its own receipt linked replay_of to the original.
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, updated_at) VALUES
('TRAIL_SAVE', 'fn', 'trailSave', '', '# WHAT: Name a sequence of past invocations (receipts) as a TRAIL — a replayable macro harvested from the ledger. Stores each step''s object key and recorded input.
# ARGS: name|inv_ID1,inv_ID2,... (2-20 receipt ids, oldest first, comma-separated)
# EX: [TRAIL_SAVE]morning-report|inv_abc123,inv_def456[/TRAIL_SAVE]
# WHEN_TO_USE: a sequence of calls just worked by hand and should become one runnable unit. Every id must be a real receipt id (inv_...). TRAIL_ steps are refused (no recursion).
# TESTS: bad id -> ERR:trail:unknown_invocation. Saved trail -> TRAIL_RUN name re-fires every step with replay_of lineage.
["$1","$2"]', 'util', datetime('now')),
('TRAIL_RUN', 'fn', 'trailRun', '', '# WHAT: Run a named TRAIL — re-fires each recorded step in order. Every step produces its own receipt with replay_of linking back to the original invocation.
# ARGS: name (the trail name given to TRAIL_SAVE)
# EX: [TRAIL_RUN]morning-report[/TRAIL_RUN]
# WHEN_TO_USE: run a saved sequence as one unit. The result lists each step''s new invocation id, ok flag, and receipt link.
# TESTS: unknown name -> ERR:trail:not_found. Each step''s receipt carries replay_of = the original inv id.
["$1"]', 'util', datetime('now')),
('TRAIL_LIST', 'fn', 'trailList', '', '# WHAT: List every saved trail — name, step count, created timestamp.
# ARGS: (none)
# EX: [TRAIL_LIST][/TRAIL_LIST]
# WHEN_TO_USE: "what trails exist?" / before TRAIL_RUN when the name is uncertain.
# TESTS: returns {ok:true, trails:[...]} — empty list when none saved.
[]', 'util', datetime('now'));
