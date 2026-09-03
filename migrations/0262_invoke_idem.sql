-- Race-proof invoke idempotency: claim BEFORE fire (INSERT OR IGNORE).
-- KV get→fire→put lets parallel identical calls all miss and all fire (7× OPEN_URL).
CREATE TABLE IF NOT EXISTS invoke_idem (
  k TEXT PRIMARY KEY,
  inv_id TEXT NOT NULL,
  ts TEXT NOT NULL
);
