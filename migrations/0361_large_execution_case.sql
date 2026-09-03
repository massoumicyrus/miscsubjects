
CREATE TABLE IF NOT EXISTS execution_case_candidates (
  candidate_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  invocation_id TEXT,
  query_text TEXT NOT NULL,
  query_sha256 TEXT,
  organization_name TEXT NOT NULL,
  official_url TEXT,
  source_url TEXT,
  source_quote TEXT,
  skill_name TEXT,
  skill_version INTEGER,
  skill_hash TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('included','excluded')),
  decision_reason TEXT NOT NULL CHECK (length(trim(decision_reason)) > 0),
  lead_id INTEGER,
  contact_status TEXT NOT NULL DEFAULT 'not_sought',
  contact_email TEXT,
  contact_email_sha256 TEXT,
  contact_source_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(task_id, query_sha256, organization_name, official_url)
);
CREATE INDEX IF NOT EXISTS idx_execution_candidates_task ON execution_case_candidates(task_id, decision, contact_status);
CREATE INDEX IF NOT EXISTS idx_execution_candidates_invocation ON execution_case_candidates(invocation_id);

-- Existing LEADS_ENRICH remains the only crawler. These triggers bind its result back to every
-- active execution-case candidate that names the lead, so the proof cannot drift from the lead row.
CREATE TRIGGER IF NOT EXISTS execution_case_contact_verified
AFTER UPDATE OF email, status ON leads
WHEN NEW.email IS NOT NULL AND trim(NEW.email) <> '' AND NEW.status IN ('enriched','drafted','sent')
BEGIN
  UPDATE execution_case_candidates
     SET contact_status='verified_public',
         contact_email=lower(trim(NEW.email)),
         contact_source_url=COALESCE(contact_source_url, NEW.website),
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
   WHERE lead_id=NEW.id AND decision='included';
END;

CREATE TRIGGER IF NOT EXISTS execution_case_contact_missing
AFTER UPDATE OF status ON leads
WHEN NEW.status IN ('no_email','no_site')
BEGIN
  UPDATE execution_case_candidates
     SET contact_status=NEW.status,
         updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
   WHERE lead_id=NEW.id AND decision='included' AND contact_status <> 'verified_public';
END;

CREATE TABLE IF NOT EXISTS execution_case_sends (
  send_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  invocation_id TEXT,
  subject TEXT NOT NULL,
  body_public TEXT NOT NULL,
  body_sha256 TEXT NOT NULL,
  review_status TEXT NOT NULL CHECK (review_status IN ('pending','approved','change','deleted')),
  review_receipt TEXT,
  provider_status TEXT NOT NULL DEFAULT 'not_sent',
  provider_message_id TEXT,
  proof_id TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(candidate_id) REFERENCES execution_case_candidates(candidate_id)
);
CREATE INDEX IF NOT EXISTS idx_execution_sends_task ON execution_case_sends(task_id, review_status, provider_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_execution_sends_proof ON execution_case_sends(proof_id) WHERE proof_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS execution_case_audits (
  audit_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  model TEXT NOT NULL,
  model_family TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  verdict_text TEXT NOT NULL,
  verdict_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(task_id, model_family, receipt_id)
);
CREATE INDEX IF NOT EXISTS idx_execution_audits_task ON execution_case_audits(task_id, model_family);
