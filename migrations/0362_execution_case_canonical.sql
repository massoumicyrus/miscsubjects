-- WT-0090 / Table Web cold audit: the selection record must show ONE decision per firm.
-- Discovery ran ~70 queries; the same firm surfaced by many of them produced many rows, some
-- included and some excluded, so the public exhibit showed the system contradicting itself. These
-- columns let a resolver mark exactly one canonical row per organization without deleting the raw
-- discovery history (append-only). org_key is the identity that dedupes (registrable domain when a
-- firm has an official site, else its normalized name). contact_valid records whether a stamped
-- contact address is syntactically real — the fix for a fake TLD passing verification.
ALTER TABLE execution_case_candidates ADD COLUMN org_key TEXT;
ALTER TABLE execution_case_candidates ADD COLUMN canonical INTEGER NOT NULL DEFAULT 1;
ALTER TABLE execution_case_candidates ADD COLUMN superseded_reason TEXT;
ALTER TABLE execution_case_candidates ADD COLUMN contact_valid INTEGER;
CREATE INDEX IF NOT EXISTS idx_execution_candidates_orgkey ON execution_case_candidates(task_id, org_key, canonical);
