-- GROWTH SPINE 3/6 — experiences, immutable versions, allocation policy, the click bridge,
-- touchpoints, orders/refunds and lifetime economics. Extends traffic_decisions and creative_runs
-- with nullable canonical ids (SQLite has no ADD COLUMN IF NOT EXISTS; ship treats a duplicate
-- column as already applied). No existing row is rewritten.

CREATE TABLE IF NOT EXISTS experiences (                      -- a logical surface: page, squeeze, destination, email…
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  brand_id TEXT, key TEXT NOT NULL,              -- e.g. squeeze:cmp_x | destination:dst_x | page:/a/slug
  kind TEXT NOT NULL,                            -- squeeze|destination|page|email|sms
  current_version_id TEXT, current_allocation_policy_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS experiences_uq ON experiences(tenant_id, key);

-- immutable after first exposure; a change is a child version
CREATE TABLE IF NOT EXISTS experience_versions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  experience_id TEXT NOT NULL, version INTEGER NOT NULL, parent_version_id TEXT,
  ref_table TEXT, ref_id TEXT,                   -- the concrete traffic_* row (traffic_squeeze_pages / traffic_destinations)
  artifact_hash TEXT,                            -- hash of the rendered artifact / component manifest
  components_json TEXT,                          -- headline, hero, cta, pricing block, …
  offer_id TEXT, price_id TEXT,
  source_creative_constraints_json TEXT,
  eligible_audience_json TEXT,
  hypothesis_id TEXT, change_reason TEXT,
  state TEXT NOT NULL DEFAULT 'draft',           -- draft|active|paused|retired
  first_exposure_at TEXT, last_exposure_at TEXT,
  source TEXT DEFAULT 'human',                   -- human|ai
  created_at TEXT NOT NULL, created_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS experience_versions_exp ON experience_versions(tenant_id, experience_id, version);
CREATE INDEX IF NOT EXISTS experience_versions_ref ON experience_versions(tenant_id, ref_table, ref_id);

-- allocation is versioned separately from content
CREATE TABLE IF NOT EXISTS allocation_policy_versions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  experience_id TEXT NOT NULL, version INTEGER NOT NULL,
  policy_json TEXT NOT NULL,                     -- [{experience_version_id, weight}] or {mode:"bandit",…}
  unit TEXT DEFAULT 'profile', sticky INTEGER NOT NULL DEFAULT 1,
  reason TEXT, hypothesis_id TEXT, proposal_id TEXT,
  effective_from TEXT NOT NULL, effective_to TEXT,
  created_at TEXT NOT NULL, created_by TEXT
);
CREATE INDEX IF NOT EXISTS allocation_policy_exp ON allocation_policy_versions(tenant_id, experience_id, version);

-- THE BRIDGE: external ad entity → click ids → traffic decision → profile/session → exact experience version
CREATE TABLE IF NOT EXISTS media_clicks (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  ts TEXT,
  click_kind TEXT,                               -- fbclid|gclid|ttclid|msclkid|rdt_cid|li_fat_id|utm_only
  click_value_hash TEXT,                         -- keyed hash, never the raw id
  provider_id TEXT,
  deployment_id TEXT, deployment_external_id TEXT, initiative_id TEXT, creative_version_id TEXT,
  utm_json TEXT,
  visitor_hash TEXT, profile_id TEXT, session_id TEXT, device_id TEXT,
  decision_id TEXT, experience_version_id TEXT, destination_id TEXT,
  touchpoint_id TEXT,
  evidence_class TEXT NOT NULL DEFAULT 'first_party_observed',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS media_clicks_uq ON media_clicks(tenant_id, decision_id, click_kind);
CREATE INDEX IF NOT EXISTS media_clicks_deployment ON media_clicks(tenant_id, deployment_external_id);
CREATE INDEX IF NOT EXISTS media_clicks_profile ON media_clicks(tenant_id, profile_id);

CREATE TABLE IF NOT EXISTS touchpoints (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  ts TEXT NOT NULL,
  subject_kind TEXT, subject_id TEXT,            -- profile|visitor_hash|brand|unknown
  brand_id TEXT, channel_id TEXT, provider_id TEXT,
  initiative_id TEXT, deployment_id TEXT, creative_id TEXT, creative_version_id TEXT,
  content_deployment_id TEXT, experience_version_id TEXT, keyword_id TEXT, placement_id TEXT,
  action TEXT NOT NULL,                          -- ad_impression|ad_click|organic_post_view|site_visit|product_view|cta|lead|sms_verified|email_open|checkout|purchase|refund|repeat_purchase|subscription_started|subscription_canceled
  value REAL, currency TEXT,
  source TEXT, evidence_class TEXT NOT NULL DEFAULT 'first_party_observed', confidence REAL NOT NULL DEFAULT 1,
  decision_id TEXT, event_id TEXT, evidence_id TEXT,
  meta_json TEXT
);
CREATE INDEX IF NOT EXISTS touchpoints_subject ON touchpoints(tenant_id, subject_kind, subject_id, ts);
CREATE INDEX IF NOT EXISTS touchpoints_brand ON touchpoints(tenant_id, brand_id, ts);
CREATE INDEX IF NOT EXISTS touchpoints_creative ON touchpoints(tenant_id, creative_id, ts);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  brand_id TEXT, profile_id TEXT, provider_id TEXT, external_id TEXT NOT NULL,
  ts TEXT NOT NULL, currency TEXT, gross REAL, discount REAL, shipping REAL, tax REAL, net REAL,
  cogs REAL, fees REAL, contribution_margin REAL,
  items_json TEXT, first_order INTEGER, source_touchpoint_id TEXT,
  raw_snapshot_id TEXT, evidence_id TEXT, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_uq ON orders(tenant_id, provider_id, external_id);
CREATE INDEX IF NOT EXISTS orders_profile ON orders(tenant_id, profile_id, ts);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  order_id TEXT, profile_id TEXT, provider_id TEXT, external_id TEXT NOT NULL,
  ts TEXT NOT NULL, amount REAL, currency TEXT, reason TEXT,
  raw_snapshot_id TEXT, evidence_id TEXT, created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS refunds_uq ON refunds(tenant_id, provider_id, external_id);

-- lifetime economics per profile — recomputed from orders/refunds, never hand-edited
CREATE TABLE IF NOT EXISTS customer_economics (
  tenant_id TEXT NOT NULL DEFAULT 't_root', profile_id TEXT NOT NULL,
  brand_id TEXT,
  first_order_at TEXT, first_order_value REAL, last_order_at TEXT,
  orders INTEGER NOT NULL DEFAULT 0, gross REAL NOT NULL DEFAULT 0, net REAL NOT NULL DEFAULT 0,
  refunds REAL NOT NULL DEFAULT 0, contribution_margin REAL,
  ltv_30 REAL, ltv_60 REAL, ltv_90 REAL, ltv_180 REAL, realized_ltv REAL, predicted_ltv REAL,
  predicted_ltv_model TEXT, predicted_ltv_confidence REAL,
  acquisition_touchpoint_id TEXT, acquisition_channel_id TEXT, acquisition_deployment_id TEXT,
  currency TEXT, computed_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, profile_id)
);

-- ---------------------------------------------------------------- extend existing objects (nullable)
ALTER TABLE traffic_decisions ADD COLUMN deployment_id TEXT;
ALTER TABLE traffic_decisions ADD COLUMN creative_version_id TEXT;
ALTER TABLE traffic_decisions ADD COLUMN content_deployment_id TEXT;
ALTER TABLE traffic_decisions ADD COLUMN experience_version_id TEXT;
ALTER TABLE traffic_decisions ADD COLUMN keyword_id TEXT;
ALTER TABLE traffic_decisions ADD COLUMN audience_id TEXT;
ALTER TABLE traffic_decisions ADD COLUMN placement_id TEXT;
ALTER TABLE traffic_decisions ADD COLUMN touchpoint_id TEXT;
ALTER TABLE traffic_decisions ADD COLUMN click_ids_json TEXT;

ALTER TABLE creative_runs ADD COLUMN creative_id TEXT;
ALTER TABLE creative_runs ADD COLUMN creative_version_id TEXT;
ALTER TABLE creative_runs ADD COLUMN asset_hash TEXT;
ALTER TABLE creative_runs ADD COLUMN hook TEXT;
ALTER TABLE creative_runs ADD COLUMN angle TEXT;
ALTER TABLE creative_runs ADD COLUMN persona TEXT;
ALTER TABLE creative_runs ADD COLUMN offer_id TEXT;
ALTER TABLE creative_runs ADD COLUMN proof_type TEXT;
ALTER TABLE creative_runs ADD COLUMN visual_style TEXT;
ALTER TABLE creative_runs ADD COLUMN transcript TEXT;
ALTER TABLE creative_runs ADD COLUMN ocr_text TEXT;
ALTER TABLE creative_runs ADD COLUMN hypothesis_id TEXT;
ALTER TABLE creative_runs ADD COLUMN change_reason TEXT;

ALTER TABLE traffic_campaigns ADD COLUMN initiative_id TEXT;
ALTER TABLE traffic_campaigns ADD COLUMN brand_id TEXT;
