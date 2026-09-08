-- GROWTH SPINE 4/4 — minimal control layer, schema only. Proposals are separate from receipts; every
-- external mutation begins as an exact proposed action and ends as a receipted action. NO code path
-- in this slice executes a proposal; authority scopes are separately granted. Social content and the
-- opportunity engine are deferred to later slices per the plan.

CREATE TABLE IF NOT EXISTS action_proposals (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  ts TEXT NOT NULL, actor TEXT NOT NULL,         -- ai|owner|rule:<id>|hypothesis:<id>
  action TEXT NOT NULL,                          -- pause|resume|budget_change|bid_change|allocation_change|creative_promote|publish|edit|delete|conversion_upload|audience_upload|route_change
  target_type TEXT NOT NULL, target_id TEXT NOT NULL, provider_id TEXT,
  before_json TEXT, after_json TEXT,
  reason TEXT NOT NULL, evidence_ids_json TEXT DEFAULT '[]', hypothesis_id TEXT,
  expected_result TEXT, confidence_low REAL, confidence_high REAL,
  budget_bound REAL, max_loss REAL, currency TEXT,
  rollback_plan_json TEXT,
  required_authority TEXT NOT NULL,              -- read|publish|campaign_write|budget_write|bid_write|status_write|conversion_upload|audience_upload
  approval_state TEXT NOT NULL DEFAULT 'proposed', -- proposed|approved|rejected|expired|executed|rolled_back
  approved_by TEXT, approved_at TEXT, approval_expires_at TEXT,
  idempotency_key TEXT NOT NULL, receipt_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS action_proposals_idem ON action_proposals(tenant_id, idempotency_key);
CREATE INDEX IF NOT EXISTS action_proposals_state ON action_proposals(tenant_id, approval_state, ts);

CREATE TABLE IF NOT EXISTS action_receipts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  proposal_id TEXT NOT NULL, ts TEXT NOT NULL, actor TEXT,
  attempted_payload_json TEXT, provider_response_json TEXT,
  before_state_json TEXT, after_state_json TEXT,
  provider_mutation_id TEXT, result TEXT NOT NULL, -- ok|error|rolled_back
  error TEXT, rollback_receipt_id TEXT, invocation_id TEXT, ledger_event_id TEXT
);
CREATE INDEX IF NOT EXISTS action_receipts_proposal ON action_receipts(tenant_id, proposal_id);

CREATE TABLE IF NOT EXISTS authority_grants (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  grantee TEXT NOT NULL, scope TEXT NOT NULL,
  provider_id TEXT, target_type TEXT, target_id TEXT,
  budget_bound REAL, max_daily_loss REAL, currency TEXT,
  granted_by TEXT NOT NULL, granted_at TEXT NOT NULL, expires_at TEXT, revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS authority_grants_grantee ON authority_grants(tenant_id, grantee, scope);

CREATE TABLE IF NOT EXISTS hypotheses (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  ts TEXT NOT NULL, actor TEXT, statement TEXT NOT NULL,
  basis_json TEXT, proposed_action_json TEXT,
  experiment_id TEXT, experience_version_id TEXT, creative_version_id TEXT, proposal_id TEXT, rule_id TEXT,
  status TEXT NOT NULL DEFAULT 'proposed',       -- proposed|approved|testing|confirmed|refuted|abandoned
  conclusion TEXT, concluded_at TEXT, confidence REAL
);
CREATE INDEX IF NOT EXISTS hypotheses_status ON hypotheses(tenant_id, status, ts);

CREATE TABLE IF NOT EXISTS growth_rules (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  name TEXT, plain TEXT NOT NULL, condition_json TEXT NOT NULL, action_json TEXT NOT NULL,
  scope TEXT, enabled INTEGER NOT NULL DEFAULT 1, cooldown_s INTEGER DEFAULT 86400,
  last_fired_at TEXT, fires INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, created_by TEXT, updated_at TEXT NOT NULL
);
