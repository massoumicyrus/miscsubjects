-- Two-stage tool selection: small planning fields so {{TOOLS}} renders a candidate
-- subset, not the full directory. Existing rows stay enabled + planner-visible by
-- default; demote a tool by setting planner_visible=0 or planner_rank to a large number.

ALTER TABLE directory ADD COLUMN enabled INTEGER DEFAULT 1;
ALTER TABLE directory ADD COLUMN planner_visible INTEGER DEFAULT 1;
ALTER TABLE directory ADD COLUMN planner_rank INTEGER DEFAULT 100;
ALTER TABLE directory ADD COLUMN input_schema TEXT;
ALTER TABLE directory ADD COLUMN examples TEXT;

CREATE INDEX IF NOT EXISTS directory_planner_idx
  ON directory (planner_visible, enabled, category, planner_rank, key);
