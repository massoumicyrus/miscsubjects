-- OIP Independent Compliance Oracle: the missing layer.
-- Citation-semantic validation of decision evidence, and a runtime downstream
-- gate proving a bounded compliance card is executable state, not a dashboard.
-- Idempotent: CREATE TABLE IF NOT EXISTS + INSERT OR REPLACE directory rows.

-- Independent validation that a cited evidence item actually supports the clause
-- finding it was cited for. A model agreeing with another model is NOT citation
-- validation; this records whether the source exists, the version/hash is right,
-- the passage supports the premise, the clause governs the conduct, a material
-- exception was omitted, and whether the conclusion overreaches the source.
CREATE TABLE IF NOT EXISTS oip_citation_validations (
  id TEXT PRIMARY KEY,
  decision_id TEXT NOT NULL,
  clause TEXT NOT NULL,
  evidence_ref TEXT NOT NULL,
  evidence_class TEXT NOT NULL CHECK(evidence_class IN ('operator-served','independently-recomputable','third-party-witnessed','institutionally-attested','private-scoped','unresolved-assertion')),
  verdict TEXT NOT NULL CHECK(verdict IN ('SUPPORTED','PARTIALLY_SUPPORTED','UNSUPPORTED','CONTRADICTED','LEGAL_REVIEW_REQUIRED')),
  source_exists INTEGER NOT NULL DEFAULT 0 CHECK(source_exists IN (0,1)),
  version_hash_correct INTEGER NOT NULL DEFAULT 0 CHECK(version_hash_correct IN (0,1)),
  passage_supports_premise INTEGER NOT NULL DEFAULT 0 CHECK(passage_supports_premise IN (0,1)),
  clause_governs_conduct INTEGER NOT NULL DEFAULT 0 CHECK(clause_governs_conduct IN (0,1)),
  material_omission INTEGER NOT NULL DEFAULT 0 CHECK(material_omission IN (0,1)),
  conclusion_overreach INTEGER NOT NULL DEFAULT 0 CHECK(conclusion_overreach IN (0,1)),
  validator_model TEXT NOT NULL,
  validator_provider TEXT NOT NULL,
  validator_family TEXT NOT NULL,
  prompt_hash TEXT,
  context_hash TEXT,
  prior_answers_visible INTEGER NOT NULL DEFAULT 0 CHECK(prior_answers_visible IN (0,1)),
  recompute_method TEXT,
  justification TEXT NOT NULL,
  record_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY(decision_id) REFERENCES oip_decision_records(id)
);
CREATE INDEX IF NOT EXISTS idx_oip_citeval_decision ON oip_citation_validations(decision_id,created_at ASC);

-- Every attempt to use a bounded compliance card to authorize a consequential
-- operation. Append-only. Each resolution is one typed ALLOW or typed DENY with
-- a reason code, so a card behaves as executable state with receipted denials.
CREATE TABLE IF NOT EXISTS oip_gate_resolutions (
  id TEXT PRIMARY KEY,
  card_id TEXT,
  requested_action TEXT NOT NULL,
  requested_system_version TEXT,
  requested_jurisdiction TEXT,
  requested_risk TEXT,
  requested_certifier_type TEXT,
  presented_card_hash TEXT,
  outcome TEXT NOT NULL CHECK(outcome IN ('ALLOW','DENY')),
  reason_code TEXT NOT NULL,
  detail TEXT,
  request_hash TEXT NOT NULL,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oip_gate_card ON oip_gate_resolutions(card_id,created_at DESC);

INSERT OR REPLACE INTO directory
  (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes)
VALUES
('CITATION_VALIDATION','http','POST https://miscsubjects.com/api/governance/citation-validation','',
'# WHAT: Independently validate that one cited evidence item actually supports the clause finding it was filed under. A model confirming a decision is NOT citation validation; this records source existence, version/hash correctness, passage-to-premise support, clause-to-conduct applicability, material omissions and conclusion overreach, plus the honest evidence class.
# ARGS: JSON {decision_id,clause,evidence_ref,evidence_class:operator-served|independently-recomputable|third-party-witnessed|institutionally-attested|private-scoped|unresolved-assertion,verdict:SUPPORTED|PARTIALLY_SUPPORTED|UNSUPPORTED|CONTRADICTED|LEGAL_REVIEW_REQUIRED,source_exists?,version_hash_correct?,passage_supports_premise?,clause_governs_conduct?,material_omission?,conclusion_overreach?,validator_model,validator_provider,validator_family,prompt_hash?,context_hash?,prior_answers_visible?,recompute_method?,justification}.
# TESTS: Decision and clause must exist; a SUPPORTED verdict requires source_exists and passage_supports_premise and clause_governs_conduct and no conclusion_overreach; operator-served evidence can never be marked independently-recomputable; the record is hash-pinned and append-only.
$1+',datetime('now'),'governance','governance,privacy,protocol',998,1,1,8,'{"type":"object","required":["decision_id","clause","evidence_ref","evidence_class","verdict","validator_model","validator_provider","validator_family","justification"]}','[]',0,'http',''),
('COMPLIANCE_GATE','http','POST https://miscsubjects.com/api/governance/gate','',
'# WHAT: Ask a bounded compliance card to authorize a consequential operation. Proves the card is executable state: a currently valid, in-scope, correct-version, in-jurisdiction, within-risk, dissent-clear, correctly-certified card permits; anything else returns a typed, receipted denial. Uses a safe demonstration operation and never gates production-critical behavior.
# ARGS: JSON {card_id,requested_action,system_version?,jurisdiction?,risk?,required_certifier_type?,presented_card_hash?,require_no_standing_dissent?,actor?}.
# TESTS: Denials are typed (CARD_NOT_FOUND, FORGED_HASH, EXPIRED, REVOKED, SUPERSEDED, WRONG_SYSTEM_VERSION, ACTION_OUT_OF_SCOPE, WRONG_JURISDICTION, RISK_CEILING_EXCEEDED, STANDING_DISSENT_BLOCKS, UNQUALIFIED_CERTIFIER); every resolution is append-only; a forged card hash never permits.
$1+',datetime('now'),'governance','governance,privacy,protocol',999,1,1,8,'{"type":"object","required":["card_id","requested_action"]}','[]',0,'http','');
