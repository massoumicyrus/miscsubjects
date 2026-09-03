-- REACTIVITY AND LINEAGE, THE TWO THINGS A GRID NEEDS AND THIS ONE LACKED.
--
-- 1. formula. A cell's stored `value` stays the COMPUTED result, so every existing reader — the
--    workbook, the REST lane, CSV export, the widgets — keeps working untouched. The expression
--    that produced it lives beside it. A cell written as "=DISPATCH(...)" keeps the text here and
--    the answer in value.
-- 2. sheet_cell_versions. Writes append. The current value is the highest version for that
--    address. cause_trace points at the turn that caused it, so a value walks back to the model
--    call that set it. Nothing is ever overwritten, which is what lets two agents disagree about
--    one cell with both positions surviving.
ALTER TABLE sheet_cells ADD COLUMN formula TEXT;

CREATE TABLE IF NOT EXISTS sheet_cell_versions (
  sheet_id    TEXT NOT NULL,
  r           INTEGER NOT NULL,
  c           INTEGER NOT NULL,
  version     INTEGER NOT NULL,
  value       TEXT,
  formula     TEXT,
  actor       TEXT,
  ts          TEXT NOT NULL,
  cause_trace TEXT,
  prev_hash   TEXT NOT NULL DEFAULT 'genesis',
  hash        TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (sheet_id, r, c, version)
);

CREATE INDEX IF NOT EXISTS sheet_cell_versions_addr ON sheet_cell_versions(sheet_id, r, c, version DESC);
CREATE INDEX IF NOT EXISTS sheet_cell_versions_trace ON sheet_cell_versions(cause_trace);
