-- OIP model-governance and privacy-accountability facets.
-- Decision justifications are accountability artifacts, never claims to hidden chain-of-thought.

CREATE TABLE IF NOT EXISTS oip_standards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  authority_class TEXT NOT NULL CHECK(authority_class IN ('internal-profile','external-source','advisory','legal-review-required')),
  source_url TEXT,
  canonical_text TEXT NOT NULL,
  clauses_json TEXT NOT NULL,
  content_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('draft','active','superseded','withdrawn')),
  parent_id TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(parent_id) REFERENCES oip_standards(id)
);
CREATE INDEX IF NOT EXISTS idx_oip_standards_status ON oip_standards(status,created_at DESC);

CREATE TABLE IF NOT EXISTS oip_decision_records (
  id TEXT PRIMARY KEY,
  standard_id TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  model_family TEXT NOT NULL,
  task TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('CONFORMANT','NONCONFORMANT','PARTIAL','UNKNOWN','ABSTAIN','LEGAL_REVIEW_REQUIRED')),
  justification TEXT NOT NULL,
  facts_json TEXT NOT NULL,
  clause_findings_json TEXT NOT NULL,
  uncertainties_json TEXT NOT NULL,
  counterarguments_json TEXT NOT NULL,
  recommended_action TEXT,
  confidence REAL,
  evidence_json TEXT NOT NULL,
  prompt_hash TEXT,
  context_hash TEXT,
  prior_answers_visible INTEGER NOT NULL DEFAULT 0 CHECK(prior_answers_visible IN (0,1)),
  authority TEXT NOT NULL CHECK(authority IN ('model-recommendation','owner-authorized','external-attestation')),
  invocation_id TEXT,
  record_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('active','superseded','repaired')),
  repair_of TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(standard_id) REFERENCES oip_standards(id),
  FOREIGN KEY(repair_of) REFERENCES oip_decision_records(id)
);
CREATE INDEX IF NOT EXISTS idx_oip_decisions_standard ON oip_decision_records(standard_id,created_at DESC);

CREATE TABLE IF NOT EXISTS oip_review_records (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  reviewer_model TEXT NOT NULL,
  reviewer_provider TEXT NOT NULL,
  reviewer_family TEXT NOT NULL,
  stance TEXT NOT NULL CHECK(stance IN ('CONFIRM','CHALLENGE','ABSTAIN')),
  justification TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  evidence_recomputed INTEGER NOT NULL DEFAULT 0 CHECK(evidence_recomputed IN (0,1)),
  prompt_hash TEXT,
  context_hash TEXT,
  prior_answers_visible INTEGER NOT NULL DEFAULT 0 CHECK(prior_answers_visible IN (0,1)),
  authority TEXT NOT NULL CHECK(authority IN ('model-recommendation','owner-authorized','external-attestation')),
  invocation_id TEXT,
  record_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY(decision_id) REFERENCES oip_decision_records(id)
);
CREATE INDEX IF NOT EXISTS idx_oip_reviews_decision ON oip_review_records(decision_id,created_at ASC);

CREATE TABLE IF NOT EXISTS oip_state_cards (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  standard_id TEXT NOT NULL,
  system_version TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  risk_ceiling TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  audit_depth INTEGER NOT NULL,
  surety_snapshot_json TEXT NOT NULL,
  standing_dissent_json TEXT NOT NULL,
  certifier_type TEXT NOT NULL CHECK(certifier_type IN ('regulator','insurer','auditor','compliance_officer','standards_body','owner')),
  certifier_label TEXT NOT NULL,
  authority TEXT NOT NULL CHECK(authority IN ('owner-authorized','external-attestation')),
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','revoked','expired','superseded')),
  parent_id TEXT,
  record_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY(decision_id) REFERENCES oip_decision_records(id),
  FOREIGN KEY(standard_id) REFERENCES oip_standards(id),
  FOREIGN KEY(parent_id) REFERENCES oip_state_cards(id)
);
CREATE INDEX IF NOT EXISTS idx_oip_cards_status ON oip_state_cards(status,expires_at);
CREATE INDEX IF NOT EXISTS idx_oip_cards_certifier ON oip_state_cards(certifier_label,created_at DESC);

CREATE TABLE IF NOT EXISTS oip_state_card_events (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('certify','revoke','expire','supersede','inspect')),
  actor TEXT NOT NULL,
  reason TEXT,
  evidence_json TEXT NOT NULL,
  invocation_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(card_id) REFERENCES oip_state_cards(id)
);
CREATE INDEX IF NOT EXISTS idx_oip_card_events_card ON oip_state_card_events(card_id,created_at ASC);

CREATE TABLE IF NOT EXISTS oip_egress_authorizations (
  id TEXT PRIMARY KEY,
  payload_hash TEXT NOT NULL,
  recipient TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  maximum_downstream_use TEXT NOT NULL,
  classification_ceiling TEXT NOT NULL,
  human_approval INTEGER NOT NULL DEFAULT 0 CHECK(human_approval IN (0,1)),
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('active','revoked','expired','exhausted')),
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oip_disclosure_receipts (
  id TEXT PRIMARY KEY,
  authorization_id TEXT NOT NULL,
  source_context_hash TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  payload_visibility TEXT NOT NULL CHECK(payload_visibility IN ('private','redacted','public')),
  recipient TEXT NOT NULL,
  recipient_role_claim TEXT NOT NULL CHECK(recipient_role_claim IN ('processor','controller','recipient','unknown')),
  purpose TEXT NOT NULL,
  legal_basis_claim TEXT,
  user_notice TEXT NOT NULL,
  user_approval TEXT NOT NULL,
  retention_claim TEXT,
  erasure_route TEXT,
  execution_receipt TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('sent','failed','blocked','unknown')),
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(authorization_id) REFERENCES oip_egress_authorizations(id)
);
CREATE INDEX IF NOT EXISTS idx_oip_disclosures_recipient ON oip_disclosure_receipts(recipient,created_at DESC);

CREATE TABLE IF NOT EXISTS oip_erasure_events (
  id TEXT PRIMARY KEY,
  disclosure_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('requested','delivered','acknowledged','rejected','unreachable','legally_exempt','verification_unavailable')),
  detail TEXT,
  evidence_receipt TEXT,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(disclosure_id) REFERENCES oip_disclosure_receipts(id)
);
CREATE INDEX IF NOT EXISTS idx_oip_erasure_disclosure ON oip_erasure_events(disclosure_id,created_at ASC);

INSERT OR REPLACE INTO directory
  (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes)
VALUES
('STANDARD_REGISTER','http','POST https://miscsubjects.com/api/governance/standards','',
'# WHAT: Register a versioned standard whose clauses can be cited by decision records. This records the source and authority class; it does not turn advisory text into law.
# ARGS: JSON {id,name,version,authority_class:internal-profile|external-source|advisory|legal-review-required,source_url?,canonical_text,clauses:[{id,title,requirement,test?,authority?}],status?,parent_id?,created_by}.
# TESTS: Unique clause ids; external/legal standards require an HTTPS source; exact canonical content is hash-pinned; bearer material is rejected.
$1+',datetime('now'),'governance','governance,privacy,protocol',990,1,1,8,'{"type":"object","required":["id","name","version","authority_class","canonical_text","clauses","created_by"]}','[]',0,'http',''),
('DECISION_RECORD','http','POST https://miscsubjects.com/api/governance/decisions','',
'# WHAT: File a clause-cited model decision justification with facts, evidence, uncertainty and counterarguments. This is an accountability artifact, never a hidden chain-of-thought claim or legal determination.
# ARGS: JSON {standard_id,model,provider,model_family,task,decision:CONFORMANT|NONCONFORMANT|PARTIAL|UNKNOWN|ABSTAIN|LEGAL_REVIEW_REQUIRED,justification,facts[],clause_findings:[{clause,result,reason,evidence[]}],uncertainties[],counterarguments[],recommended_action?,confidence?,evidence[],prompt_hash?,context_hash?,prior_answers_visible?,authority,invocation_id?,repair_of?}.
# TESTS: Standard and clause ids must exist; every PASS/FAIL finding needs evidence; legal-review standards cannot yield a runtime legal conclusion; record is hash-pinned and append-only.
$1+',datetime('now'),'governance','governance,privacy,protocol',991,1,1,8,'{"type":"object","required":["standard_id","model","provider","model_family","task","decision","justification","clause_findings","authority"]}','[]',0,'http',''),
('REVIEW_RECORD','http','POST https://miscsubjects.com/api/governance/reviews','',
'# WHAT: Confirm, challenge or abstain on a decision record while preserving reviewer provider/family, evidence, prompt/context fingerprints and whether prior answers were visible.
# ARGS: JSON {decision_id,reviewer_model,reviewer_provider,reviewer_family,stance:CONFIRM|CHALLENGE|ABSTAIN,justification,evidence[],evidence_recomputed?,prompt_hash?,context_hash?,prior_answers_visible?,authority,invocation_id?}.
# TESTS: Unknown decisions fail; repeated same-provider reviews remain visible but do not multiply independent-provider surety.
$1+',datetime('now'),'governance','governance,privacy,protocol',992,1,1,8,'{"type":"object","required":["decision_id","reviewer_model","reviewer_provider","reviewer_family","stance","justification","authority"]}','[]',0,'http',''),
('SURETY_RECORD','http','POST https://miscsubjects.com/api/governance/surety','',
'# WHAT: Compute the disclosed independence-weighted support/challenge profile for one decision. Surety measures corroboration, not truth, legality or consensus authority.
# ARGS: JSON {decision_id}.
# TESTS: Count unique providers separately from raw reviews; disclose every weight and discount; preserve challenges and prior-answer visibility.
$1+',datetime('now'),'governance','governance,privacy,protocol',993,1,1,8,'{"type":"object","required":["decision_id"]}','[]',0,'http',''),
('STATE_CARD_CERTIFY','http','POST https://miscsubjects.com/api/governance/cards','',
'# WHAT: Certify a bounded, expiring compliance state card from an existing decision and its current surety/dissent record. The card grants no tool authority by itself.
# ARGS: JSON {decision_id,system_version,scope[],risk_ceiling,jurisdiction,audit_depth,certifier_type:regulator|insurer|auditor|compliance_officer|standards_body|owner,certifier_label,authority:owner-authorized|external-attestation,expires_at,parent_id?,evidence[],invocation_id?}.
# TESTS: Card binds standard/system/scope/risk/jurisdiction/audit depth/expiry; current dissent is attached; expiry is bounded; certification never erases dissent or becomes truth/legal compliance by itself.
$1+',datetime('now'),'governance','governance,privacy,protocol',994,1,1,8,'{"type":"object","required":["decision_id","system_version","scope","risk_ceiling","jurisdiction","audit_depth","certifier_type","certifier_label","authority","expires_at"]}','[]',0,'http',''),
('STATE_CARD_REVOKE','http','POST https://miscsubjects.com/api/governance/cards/revoke','',
'# WHAT: Revoke a state card without deleting it; append the reason, evidence and actor to the certifier history.
# ARGS: JSON {card_id,actor,reason,evidence[],invocation_id?}.
# TESTS: Revocation is append-only, idempotent only for already-revoked state, and immediately changes card standing.
$1+',datetime('now'),'governance','governance,privacy,protocol',995,1,1,8,'{"type":"object","required":["card_id","actor","reason"]}','[]',0,'http',''),
('CERTIFIER_HISTORY','http','POST https://miscsubjects.com/api/governance/certifiers','',
'# WHAT: Read the cards, revocations, expiries and evidence history filed by a named regulator, insurer, auditor, compliance officer, standards body or owner.
# ARGS: JSON {certifier_label}.
# TESTS: Returns public bounded records only; this is a performance history, not proof of legal identity, competence or independence.
$1+',datetime('now'),'governance','governance,privacy,protocol',996,1,1,8,'{"type":"object","required":["certifier_label"]}','[]',0,'http',''),
('PRIVACY_EGRESS','http','POST https://miscsubjects.com/api/privacy','',
'# WHAT: Shape or record context egress under the OIP Privacy Profile. Dry-run classification/minimization never executes a transmission; authorization binds an exact hash/recipient/purpose; disclosure and erasure outcomes remain distinct.
# ARGS: JSON {action:shape|classify|minimize|authorize|disclose|erasure|conformance,...}. Read https://miscsubjects.com/api/privacy for exact per-action schemas. For real sensitive payloads call the owner-authenticated endpoint directly; dispatch receipts store invocation input, so use this row only with synthetic or already-redacted content.
# TESTS: No shape/classify/minimize action executes or stores payloads; request-sent never means deleted; recipient roles and legal bases are claims; unknown recipients stay unknown.
$1+',datetime('now'),'privacy','privacy,governance,protocol',997,1,1,8,'{"type":"object","required":["action"]}','[]',1,'http','');
