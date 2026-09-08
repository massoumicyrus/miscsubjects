-- GROWTH SPINE 2/6 — markets, brands, channels, the paid-media hierarchy and reusable objects.
--
-- account → initiative → group → deployment  (ad account → campaign/order → ad set/ad group/line item → ad)
-- Provider-native type and raw payload are retained on every row. Owned brands and competitors use
-- the same tables; brands.is_self and evidence class distinguish them. Names avoid collisions with
-- the capability market (market_offers, market_wants): growth objects are growth_offers / prices.

CREATE TABLE IF NOT EXISTS markets (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  name TEXT NOT NULL, vertical TEXT, geographies_json TEXT DEFAULT '[]', description TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS brands (
  id            TEXT PRIMARY KEY,                -- brd_…
  tenant_id     TEXT NOT NULL DEFAULT 't_root',
  market_id     TEXT,
  name          TEXT NOT NULL,
  is_self       INTEGER NOT NULL DEFAULT 0,
  domains_json  TEXT DEFAULT '[]',
  products_json TEXT DEFAULT '[]',
  vertical      TEXT,
  geographies_json TEXT DEFAULT '[]',
  social_json   TEXT DEFAULT '[]',               -- [{platform, handle, url}]
  ad_accounts_json TEXT DEFAULT '[]',            -- [{provider_id, external_id}]
  competitor_of_json TEXT DEFAULT '[]',          -- brand ids
  first_seen TEXT, last_seen TEXT,
  evidence_class TEXT DEFAULT 'first_party_observed',
  meta_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS brands_market ON brands(tenant_id, market_id);

-- channels as data (not hard-coded "paid ads")
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,                           -- paid_search|paid_social|display|native|push|pop|affiliate|organic_social|seo|email|sms|creator|referral|direct|marketplace|retail_media|app_store|community|newsletter|sponsorship|integration|reseller
  tenant_id TEXT NOT NULL DEFAULT 't_root',
  name TEXT NOT NULL, paid INTEGER NOT NULL DEFAULT 0, description TEXT,
  created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------- paid-media hierarchy
CREATE TABLE IF NOT EXISTS media_accounts (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  brand_id TEXT, provider_id TEXT NOT NULL, connection_id TEXT,
  external_id TEXT NOT NULL, name TEXT, currency TEXT, timezone TEXT, status TEXT,
  native_type TEXT, raw_snapshot_id TEXT,
  synced_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS media_accounts_uq ON media_accounts(tenant_id, provider_id, external_id);

CREATE TABLE IF NOT EXISTS media_initiatives (                 -- campaign / insertion order
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  account_id TEXT, provider_id TEXT NOT NULL, external_id TEXT NOT NULL,
  name TEXT, objective TEXT, status TEXT, native_type TEXT,
  daily_budget REAL, lifetime_budget REAL, bid_strategy TEXT, currency TEXT,
  start_at TEXT, end_at TEXT,
  channel_id TEXT, traffic_campaign_id TEXT,     -- link to the funnel's traffic_campaigns row when the same initiative
  raw_snapshot_id TEXT,
  synced_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS media_initiatives_uq ON media_initiatives(tenant_id, provider_id, external_id);
CREATE INDEX IF NOT EXISTS media_initiatives_account ON media_initiatives(tenant_id, account_id);

CREATE TABLE IF NOT EXISTS media_groups (                      -- ad set / ad group / line item
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  initiative_id TEXT, provider_id TEXT NOT NULL, external_id TEXT NOT NULL,
  name TEXT, status TEXT, native_type TEXT,
  daily_budget REAL, lifetime_budget REAL, bid_amount REAL, optimization_goal TEXT,
  audience_definition_version_id TEXT, targeting_json TEXT,
  raw_snapshot_id TEXT,
  synced_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS media_groups_uq ON media_groups(tenant_id, provider_id, external_id);
CREATE INDEX IF NOT EXISTS media_groups_initiative ON media_groups(tenant_id, initiative_id);

CREATE TABLE IF NOT EXISTS media_deployments (                 -- ad / promoted post / keyword deployment
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  group_id TEXT, initiative_id TEXT, provider_id TEXT NOT NULL, external_id TEXT NOT NULL,
  name TEXT, status TEXT, native_type TEXT,
  creative_id TEXT, creative_version_id TEXT,    -- the logical creative + exact version deployed
  content_deployment_id TEXT,                    -- when the ad promotes an organic post
  destination_url TEXT, experience_version_id TEXT, -- the page version the ad points at (when known)
  raw_snapshot_id TEXT,
  first_seen TEXT, last_seen TEXT,
  synced_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS media_deployments_uq ON media_deployments(tenant_id, provider_id, external_id);
CREATE INDEX IF NOT EXISTS media_deployments_group ON media_deployments(tenant_id, group_id);
CREATE INDEX IF NOT EXISTS media_deployments_creative ON media_deployments(tenant_id, creative_id);

-- ---------------------------------------------------------------- reusable first-class objects
-- the LOGICAL creative: one identity across networks/campaigns; deployments point here
CREATE TABLE IF NOT EXISTS creatives (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  brand_id TEXT, name TEXT, format TEXT,          -- image|video|carousel|text|collection
  asset_hash TEXT,                               -- content identity (dedupe across platforms)
  current_version_id TEXT,
  creative_run_id TEXT,                          -- when generated by the build (creative_runs.id)
  evidence_class TEXT DEFAULT 'first_party_observed',
  first_seen TEXT, last_seen TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS creatives_hash ON creatives(tenant_id, asset_hash);

-- never mutated under test; a change is a child version with parentage + reason
CREATE TABLE IF NOT EXISTS creative_versions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  creative_id TEXT NOT NULL, version INTEGER NOT NULL, parent_version_id TEXT,
  change_reason TEXT, hypothesis_id TEXT,
  asset_hash TEXT, headline TEXT, body TEXT, cta TEXT,
  image_url TEXT, video_url TEXT, audio_url TEXT, landing_url TEXT,
  duration_s REAL, width INTEGER, height INTEGER,
  transcript TEXT, ocr_text TEXT,
  hook TEXT, angle TEXT, persona TEXT, offer_id TEXT, proof_type TEXT, visual_style TEXT,
  tags_json TEXT DEFAULT '[]',                   -- AI semantic tags
  generation_payload_json TEXT, provider_response_json TEXT, model TEXT, tool TEXT,
  creative_run_id TEXT,                          -- creative_runs.id when the build made it
  owner_review TEXT,                             -- unreviewed|approved|rejected
  provider_external_ids_json TEXT DEFAULT '{}',  -- {"meta_ads":"2676…"} where this version lives
  source TEXT DEFAULT 'human',                   -- human|ai|observed
  created_at TEXT NOT NULL, created_by TEXT
);
CREATE INDEX IF NOT EXISTS creative_versions_creative ON creative_versions(tenant_id, creative_id, version);

CREATE TABLE IF NOT EXISTS audiences (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  brand_id TEXT, name TEXT, kind TEXT,           -- saved|custom|lookalike|interest|keyword|retargeting
  current_definition_version_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audience_definition_versions (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  audience_id TEXT NOT NULL, version INTEGER NOT NULL, definition_json TEXT NOT NULL,
  provider_external_ids_json TEXT DEFAULT '{}', estimated_size REAL, created_at TEXT NOT NULL, created_by TEXT
);

CREATE TABLE IF NOT EXISTS keywords (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  text TEXT NOT NULL, match_type TEXT, language TEXT, geography TEXT, cluster_id TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS keywords_uq ON keywords(tenant_id, text, match_type, language, geography);
CREATE TABLE IF NOT EXISTS search_terms (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  text TEXT NOT NULL, keyword_id TEXT, provider_id TEXT, first_seen TEXT, last_seen TEXT
);
CREATE TABLE IF NOT EXISTS placements (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  provider_id TEXT, name TEXT NOT NULL, publisher_id TEXT, kind TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS publishers (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  name TEXT NOT NULL, domain TEXT, kind TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  brand_id TEXT, name TEXT NOT NULL, sku TEXT, category TEXT, cogs REAL, currency TEXT,
  external_ids_json TEXT DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS growth_offers (                     -- NOT market_offers (capability market)
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  brand_id TEXT, name TEXT NOT NULL, kind TEXT,  -- discount|bundle|trial|subscription|guarantee|bonus
  terms_json TEXT, product_ids_json TEXT DEFAULT '[]',
  first_seen TEXT, last_seen TEXT, evidence_class TEXT DEFAULT 'first_party_observed',
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS prices (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  product_id TEXT, offer_id TEXT, amount REAL NOT NULL, currency TEXT NOT NULL, cadence TEXT,
  observed_at TEXT NOT NULL, evidence_class TEXT DEFAULT 'first_party_observed', evidence_id TEXT
);
