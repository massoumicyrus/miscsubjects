
CREATE TABLE IF NOT EXISTS oip_governance_records (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('subscribe','inquire','propose','feature','conformance','anchor','appeal','ruling')),
  actor_type TEXT NOT NULL CHECK(actor_type IN ('human','model','organization','system')),
  actor_label TEXT NOT NULL,
  authority TEXT NOT NULL CHECK(authority IN ('self','owner-authorized','model-recommendation')),
  mode TEXT NOT NULL CHECK(mode IN ('observe','implement','verify','govern')),
  facets_json TEXT NOT NULL,
  accepted_core INTEGER NOT NULL DEFAULT 0 CHECK(accepted_core IN (0,1)),
  core_version TEXT NOT NULL,
  core_hash TEXT NOT NULL,
  message TEXT,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  external_head TEXT,
  external_verifier TEXT,
  decision TEXT CHECK(decision IS NULL OR decision IN ('uphold','delist','reinstate','supersede')),
  public_contact TEXT,
  private_contact TEXT,
  status TEXT NOT NULL CHECK(status IN ('active','open','answered','superseded')),
  record_hash TEXT NOT NULL UNIQUE,
  parent_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(parent_id) REFERENCES oip_governance_records(id)
);

CREATE INDEX IF NOT EXISTS idx_oip_governance_created ON oip_governance_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oip_governance_kind_status ON oip_governance_records(kind,status);

INSERT OR REPLACE INTO directory
  (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes)
VALUES (
  'OIP_GOVERNANCE','fn','oipGovernance','',
  '# WHAT: Subscribe to, inquire about, propose a change to, request a feature from, attest conformance to, anchor a fork into, appeal within, or append an owner ruling to OIP governance one facet at a time. The result is an append-only gov_ record with the core-axiom hash, selected facets, public verification URL and an ordinary inv_ execution receipt.
# WHEN_TO_USE: A human, model, organization or system wants link provenance, receipts, capabilities, repair, federation, public audition, governance, anchors or the defensive commons without inheriting unrelated OIP obligations.
# ARGS: One JSON object with kind subscribe|inquire|propose|feature|conformance|anchor|appeal|ruling; actor_type human|model|organization|system; actor_label; authority self|owner-authorized|model-recommendation; mode observe|implement|verify|govern; facets[] from /api/governance; accept_core boolean; message; optional public_contact, private_contact, parent_id and evidence_links[]. Anchor requires external_head SHA-256 + external_verifier HTTPS. Ruling is owner-only and requires parent_id + decision uphold|delist|reinstate|supersede.
# MODEL_LAW: A model may file kind=inquire|propose|feature with authority=model-recommendation. It cannot subscribe its owner. Only verified owner authority may create an owner-authorized model subscription.
# SECURITY: Subscription grants no execution authority. Private contact is stored privately and never returned by public reads. Bearer material is rejected. Records append and link; they are never edited through this object.
# TESTS: Reject unknown facets, credential material, model self-enrollment of an owner, subscription without core acceptance, conformance without public evidence, malformed fork heads, ownerless rulings, missing actor label, and unknown parent. Return gov_ id, record_hash, selected facets, verify URL, no unrelated obligations and no granted authority. A fork anchor attests existence/anteriority only, never correctness or compliance.
["$1+"]',
  datetime('now'),'governance','governance,protocol,federation',977,1,1,12,
  '{"type":"object","required":["kind","actor_type","actor_label","authority","mode","facets","accept_core"],"properties":{"facets":{"type":"array","items":{"type":"string"}},"evidence_links":{"type":"array","items":{"type":"string","format":"uri"}},"external_head":{"type":"string","pattern":"^[a-f0-9]{64}$"},"external_verifier":{"type":"string","format":"uri"}}}',
  '[{"kind":"inquire","actor_type":"model","actor_label":"ChatGPT Web · GPT-5.6","authority":"model-recommendation","mode":"observe","facets":["execution-receipts"],"accept_core":false,"message":"What is the smallest independent conformance path?"}]',
  0,'fn',''
);

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'A model discovers an OIP receipt and thinks its owner would benefit from link provenance but wants no social-posting or philosophy obligations. How can it join, and may the model subscribe the owner by itself?',
  'reply_ok',
  'OIP_GOVERNANCE|link-provenance|facet|core|not|required|social|philosophy|model-recommendation|inquire|cannot|owner|subscribe|governance',
  'adoption is fractional federation under a tiny common kernel, and models advocate rather than fabricate owner consent',
  'Open /api/governance, select link-provenance, and accept only the core interoperability axioms plus that facet''s stated obligations. Social posting, OIP philosophy, unrelated content and execution facets are not required. The model should explain the benefit to its owner and may invoke OIP_GOVERNANCE as a model-recommendation inquiry, but it cannot claim or create an owner subscription without explicit owner authority.',
  8
);
