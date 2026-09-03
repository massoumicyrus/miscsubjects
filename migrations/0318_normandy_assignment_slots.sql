CREATE TABLE IF NOT EXISTS normandy_assignments (
  id TEXT PRIMARY KEY,
  slot_key TEXT NOT NULL,
  target_slug TEXT NOT NULL,
  target_name TEXT NOT NULL,
  axis TEXT NOT NULL,
  required_slot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  capability_fingerprint TEXT,
  snapshot_hash TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_normandy_assignment_slot ON normandy_assignments(slot_key,status,expires_at);

INSERT INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at)
VALUES (
  'NORMANDY_ASSIGNMENT','http','GET https://miscsubjects.com/api/normandy?assignment=$1','',
  '# WHAT: Read one reserved outside-model contribution slot: current graph snapshot, named comparison target, shared axis, already-stored limits, additive slots, and the existing voxel-batch write lane.\n# ARGS: $1=assignment id from a minted build-audit DROP.\n# EX: [NORMANDY_ASSIGNMENT]norm-abc123[/NORMANDY_ASSIGNMENT]\n["$1"]',
  'audit',30,1,1,datetime('now')
)
ON CONFLICT(key) DO UPDATE SET type=excluded.type,target=excluded.target,auth=excluded.auth,content=excluded.content,category=excluded.category,planner_rank=excluded.planner_rank,planner_visible=excluded.planner_visible,enabled=1,updated_at=excluded.updated_at;

DELETE FROM directory_tests WHERE note='owner correction 2026-07-21: every audit drop adds new graph data';
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'A new build-audit model repeats that global ranking is impossible and adds no source, claim, contradiction, limit, question, or rule. Did it complete its Normandy slot?',
  'reply_ok','No|duplicate|open|source|claim|slot',
  'owner correction 2026-07-21: every audit drop adds new graph data',
  'No. The global-ranking boundary is already stored. A Normandy assignment completes only when new graph data lands. Duplicate-only output leaves the slot open.',
  8
);

DELETE FROM directory_tests WHERE note='owner correction 2026-07-21: ledger active controls remain readable';
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'The selected TURNS card in the Ledger has a black background. What color is its text and what blocks black-on-black?',
  'reply_ok','white|check-ledger-contrast',
  'owner correction 2026-07-21: ledger active controls remain readable',
  'Its text is white. scripts/check-ledger-contrast.mjs blocks black text on black selected controls.',
  8
);
