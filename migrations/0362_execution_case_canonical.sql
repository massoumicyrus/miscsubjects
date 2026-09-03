ALTER TABLE execution_case_candidates ADD COLUMN org_key TEXT;
ALTER TABLE execution_case_candidates ADD COLUMN canonical INTEGER NOT NULL DEFAULT 1;
ALTER TABLE execution_case_candidates ADD COLUMN superseded_reason TEXT;
ALTER TABLE execution_case_candidates ADD COLUMN contact_valid INTEGER;
CREATE INDEX IF NOT EXISTS idx_execution_candidates_orgkey ON execution_case_candidates(task_id, org_key, canonical);
