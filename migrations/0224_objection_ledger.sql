-- 0224 — DB (loop-content-spine). THE OBJECTION LEDGER, live (Book IV / IX.7 compiled).
-- A model or reader objects; the owner (or the artifact) answers; the exchange is stored,
-- ledgered, and rendered inside the article + its machine JSON + its bundle — so settled
-- ground holds itself and nobody re-fights it without new load.
CREATE TABLE IF NOT EXISTS oip_objections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL,
  objection   TEXT NOT NULL,
  answer      TEXT,
  actor       TEXT,                       -- who objected (model name, human, url)
  answered_by TEXT,                       -- who answered (usually the owner)
  status      TEXT NOT NULL DEFAULT 'open',  -- open | settled | reopened
  surface     TEXT,                       -- optional S1-S8 per Book X
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  answered_at TEXT
);
CREATE INDEX IF NOT EXISTS oip_objections_slug_idx ON oip_objections(slug, status);

-- Text-native intake: "[OBJECTION]slug|objection|answer|actor[/OBJECTION]" from iMessage or any model.
INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'OBJECTION_LOG',
  'fn',
  'objectionLog',
  '',
  '# WHAT: Log an objection (and optionally its answer) against any /a/ article into the live objection ledger. Renders on the page, in the JSON, and in the machine bundle. Answer later with the same call (answer fills, status flips to settled).
# WHEN_TO_USE: a model criticises the structure and the owner answers it once — never re-fight settled ground. Also for models posting their own objections per Book X.
# ARGS: slug | objection | answer (optional) | actor (optional)
# EX: [OBJECTION_LOG]oip-total-structure|The moral floor is unfalsifiable|S1 names the exact falsifier; read /a/oip-falsification|gpt-5[/OBJECTION_LOG]
["$1","$2","$3","$4"]',
  'governance', 1, 1, 24, datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth, content=excluded.content,
  category=excluded.category, enabled=excluded.enabled, planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;
