-- 0223 — DB (miscsubjects-content). QUADSYNC_RUN: fire the server-side sync on demand.
INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'QUADSYNC_RUN',
  'fn',
  'quadsyncRun',
  '',
  '# WHAT: Run the server half of QUADSYNC now — mirror new ledger events to GitHub (ledger-mirror/events-<day>.jsonl) and fold recent GitHub commits + [auto] issues back into the ledger/tasks. Returns both results plus all four corner health stamps.
# WHEN_TO_USE: the owner says "sync", "sync everything", "run quadsync", "is everything synced" — or any model needs the corners current before reasoning about build state. Automatic every 10 min via dispatch traffic; local Mac + Google Drive corners run via launchd com.owner.miscsubjects.quadsync.
# ARGS: none
# EX: [QUADSYNC_RUN][/QUADSYNC_RUN]
[]',
  'governance', 1, 1, 23, datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth, content=excluded.content,
  category=excluded.category, enabled=excluded.enabled, planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;
