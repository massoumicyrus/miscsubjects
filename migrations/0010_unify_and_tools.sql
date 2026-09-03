-- 0010_unify_and_tools.sql
-- 1. Unify the personality prompt and the ROUTER prompt into a single source of truth.
--    The canonical prompt now lives in directory.ROUTER.content. blooio.js reads it from there.
--    settings.system_prompt is retained as a mirror for backwards compatibility but is no longer authoritative.
-- 2. Create the tasks table used by ADDTASK regex demonstration.
-- 3. Seed new directory rows: ADDTASK, KV_LIST, KV_GET_JSON, KV_PUT_JSON, KV_APPEND, R2_PUT, R2_GET, R2_DEL, R2_LIST, REGEX_PARSE.

UPDATE directory
SET content = (SELECT value FROM settings WHERE key = 'system_prompt'),
    updated_at = '2026-06-09T00:00:00Z'
WHERE key = 'ROUTER'
  AND EXISTS (SELECT 1 FROM settings WHERE key = 'system_prompt');

CREATE TABLE IF NOT EXISTS tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  body        TEXT NOT NULL,
  source      TEXT,
  trace       TEXT
);

INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at) VALUES
  ('ADDTASK',      'fn',   'taskAdd',   '', '["$1","ADDTASK"]', '2026-06-09T00:00:00Z'),
  ('TASKS_LIST',   'flow', '',          '', 'D1_QUERY: SELECT id, created_at, status, body, source, trace FROM tasks ORDER BY id DESC LIMIT 200', '2026-06-09T00:00:00Z'),
  ('KV_LIST',      'fn',   'kvList',    '', '["$1"]', '2026-06-09T00:00:00Z'),
  ('KV_GET_JSON',  'fn',   'kvGetJson', '', '["$1"]', '2026-06-09T00:00:00Z'),
  ('KV_PUT_JSON',  'fn',   'kvPutJson', '', '["$1","$2"]', '2026-06-09T00:00:00Z'),
  ('KV_APPEND',    'fn',   'kvAppend',  '', '["$1","$2"]', '2026-06-09T00:00:00Z'),
  ('R2_PUT',       'fn',   'r2Put',     '', '["$1","$2"]', '2026-06-09T00:00:00Z'),
  ('R2_GET',       'fn',   'r2Get',     '', '["$1"]', '2026-06-09T00:00:00Z'),
  ('R2_DEL',       'fn',   'r2Del',     '', '["$1"]', '2026-06-09T00:00:00Z'),
  ('R2_LIST',      'fn',   'r2List',    '', '["$1"]', '2026-06-09T00:00:00Z'),
  ('REGEX_PARSE',  'fn',   'regexParse','', '["$1"]', '2026-06-09T00:00:00Z');
