-- 0365 — user sheets: the Sheets workbook's stored grids (WT-0092).
-- Directory and Ledger tabs project existing tables; ONLY user-created sheets store cells here.
-- sheet_cells is sparse: a row exists only where a cell has a value. (sheet_id, r, c) is the
-- A1 address — r and c are 1-based, c=1 is column A.

CREATE TABLE IF NOT EXISTS user_sheets (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  rows       INTEGER NOT NULL DEFAULT 1000,
  cols       INTEGER NOT NULL DEFAULT 26,
  col_meta   TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sheet_cells (
  sheet_id   TEXT NOT NULL,
  r          INTEGER NOT NULL,
  c          INTEGER NOT NULL,
  value      TEXT,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (sheet_id, r, c)
);

CREATE INDEX IF NOT EXISTS idx_sheet_cells_sheet_row ON sheet_cells (sheet_id, r);

-- One saved model-run configuration = one named version (v1, v2, …) so different settings
-- run side by side into different columns. The config JSON holds the invoke spec template
-- and the column mapping; prompts live here as data, never in code (MODEL_CALL_LAW).
CREATE TABLE IF NOT EXISTS sheet_run_configs (
  id         TEXT PRIMARY KEY,
  sheet_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  config     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sheet_run_configs_sheet ON sheet_run_configs (sheet_id);
