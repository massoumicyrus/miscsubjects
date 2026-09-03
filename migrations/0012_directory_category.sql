-- 0012_directory_category.sql
-- Add `category` (free-text label, used for color-coding + filtering in the admin UI)
-- and `allowed_categories` (only meaningful on agent rows: comma-separated list of categories
--   this agent's {{TOOLS}} listing is restricted to, or '*' for all).
-- Add `seq` (manual ordinal — only used to pin specific rows to specific positions like ROUTER=1).

ALTER TABLE directory ADD COLUMN category TEXT;
ALTER TABLE directory ADD COLUMN allowed_categories TEXT;
ALTER TABLE directory ADD COLUMN seq INTEGER;

UPDATE directory SET seq = 1 WHERE key = 'ROUTER';

-- Categories assigned from key prefix.
UPDATE directory SET category = 'router'   WHERE key = 'ROUTER';
UPDATE directory SET category = 'llm'      WHERE key IN ('XAI_CHAT','GROK_AUDIT');
UPDATE directory SET category = 'self_mod' WHERE key IN ('ADD_ROW','EDIT_ROW','DEL_ROW');
UPDATE directory SET category = 'kv'       WHERE key LIKE 'KV_%';
UPDATE directory SET category = 'r2'       WHERE key LIKE 'R2_%';
UPDATE directory SET category = 'd1'       WHERE key LIKE 'D1_%';
UPDATE directory SET category = 'blooio'   WHERE key LIKE 'BLOOIO_%';
UPDATE directory SET category = 'meta'     WHERE key LIKE 'META_%';
UPDATE directory SET category = 'pages'    WHERE key LIKE 'PAGES_%' OR key = 'SERVE_PAGE';
UPDATE directory SET category = 'settings' WHERE key LIKE 'SETTINGS_%';
UPDATE directory SET category = 'directory' WHERE key LIKE 'DIRECTORY_%';
UPDATE directory SET category = 'log'      WHERE key LIKE 'LOG_%' OR key = 'GROK_LEDGER_TAIL' OR key = 'BLOOIO_LOGS_TAIL';
UPDATE directory SET category = 'tasks'    WHERE key = 'ADDTASK' OR key = 'TASKS_LIST';
UPDATE directory SET category = 'stripe'   WHERE key LIKE 'STRIPE_%';
UPDATE directory SET category = 'flow'     WHERE key = 'SEND_INVOICE_VIA_BLOOIO';
UPDATE directory SET category = 'util'     WHERE key IN ('NOW','UPPER','LOWER','SHA256_LOWER','DEDUP_INSERT','REGEX_PARSE');

-- ROUTER defaults to seeing every tool. the owner can restrict via /admin/directory/ROUTER edit.
UPDATE directory SET allowed_categories = '*' WHERE type = 'agent';
