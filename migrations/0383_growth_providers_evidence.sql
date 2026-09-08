-- GROWTH SPINE 1/4 — providers, connections, syncs, raw snapshots, evidence, observations, estimates.
-- Law: raw + normalized (raw stored ONCE in raw_snapshots, referenced by id); facts / provider reports /
-- provider estimates / model inferences / forecasts are distinct classes; every metric carries subject,
-- interval, dimensions, currency, timezone, source, observation time; missing data is a named state, never
-- a silent zero; ratios are derived at read time from primitives (provider ratios kept only as
-- *_reported observations for reconciliation). Uniqueness + idempotency on every external entity,
-- observation and sync window. All IF NOT EXISTS; no existing row is touched.

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  name TEXT NOT NULL, category TEXT NOT NULL,    -- paid_media|analytics|commerce|search|social|creative_intel|competitive|estimates
  channels_json TEXT DEFAULT '[]',
  cap_account_discovery TEXT DEFAULT 'unverified', cap_entity_reads TEXT DEFAULT 'unverified', cap_metric_reads TEXT DEFAULT 'unverified',
  cap_backfill TEXT DEFAULT 'unverified', cap_webhooks TEXT DEFAULT 'unverified', cap_content_history TEXT DEFAULT 'unverified',
  cap_content_publish TEXT DEFAULT 'unverified', cap_campaign_mutation TEXT DEFAULT 'unverified', cap_budget_mutation TEXT DEFAULT 'unverified',
  cap_bid_mutation TEXT DEFAULT 'unverified', cap_status_mutation TEXT DEFAULT 'unverified', cap_conversion_upload TEXT DEFAULT 'unverified',
  cap_audience_sync TEXT DEFAULT 'unverified', cap_keyword_estimates TEXT DEFAULT 'unverified', cap_reach_estimates TEXT DEFAULT 'unverified',
  cap_competitor_ads TEXT DEFAULT 'unverified', cap_traffic_estimates TEXT DEFAULT 'unverified', cap_placement_data TEXT DEFAULT 'unverified',
  docs_url TEXT, verified_at TEXT, verified_note TEXT, adapter_module TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  provider_id TEXT NOT NULL, external_account_id TEXT, label TEXT,
  state TEXT NOT NULL DEFAULT 'not_connected',   -- authorized|not_connected|permission_missing|rate_limited|error|expired
  scopes_json TEXT DEFAULT '[]',                 -- read|publish|campaign_write|budget_write|bid_write|conversion_upload|audience_upload
  secret_ref TEXT,                               -- the NAME of the secret, never a value
  last_healthcheck_at TEXT, last_health TEXT, last_error TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS provider_connections_uq ON provider_connections(tenant_id, provider_id, COALESCE(external_account_id,''));

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  provider_id TEXT NOT NULL, connection_id TEXT,
  kind TEXT NOT NULL,                            -- discover|entities|metrics|backfill|content|webhook|healthcheck
  window_start TEXT NOT NULL DEFAULT '', window_end TEXT NOT NULL DEFAULT '',
  idempotency_key TEXT NOT NULL,                 -- provider|connection|kind|window
  started_at TEXT NOT NULL, finished_at TEXT,
  state TEXT NOT NULL DEFAULT 'running',         -- running|ok|partial|failed|rate_limited|replayed
  counts_json TEXT, errors_json TEXT, evidence_id TEXT, actor TEXT, invocation_ids_json TEXT DEFAULT '[]'
);
CREATE UNIQUE INDEX IF NOT EXISTS sync_runs_uq ON sync_runs(tenant_id, idempotency_key, started_at);
CREATE INDEX IF NOT EXISTS sync_runs_window ON sync_runs(tenant_id, provider_id, kind, window_start, window_end);

CREATE TABLE IF NOT EXISTS raw_snapshots (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  provider_id TEXT NOT NULL, sync_run_id TEXT,
  subject_type TEXT, subject_external_id TEXT,
  captured_at TEXT NOT NULL,
  body_preview TEXT, body_inline TEXT, r2_key TEXT, -- inline ≤ 10 KB, R2 above (existing cutoff)
  body_hash TEXT NOT NULL, bytes INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS raw_snapshots_uq ON raw_snapshots(tenant_id, provider_id, body_hash);
CREATE INDEX IF NOT EXISTS raw_snapshots_subject ON raw_snapshots(tenant_id, provider_id, subject_type, subject_external_id);

CREATE TABLE IF NOT EXISTS evidence_records (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  ts TEXT NOT NULL,
  evidence_class TEXT NOT NULL,                  -- first_party_observed|directly_observed_public|provider_reported|provider_estimated|model_inferred|forecast
  source TEXT NOT NULL, sync_run_id TEXT, raw_snapshot_id TEXT,
  request_json TEXT, normalizer_version TEXT, derived_json TEXT, interpretation TEXT, confidence REAL, actor TEXT
);
CREATE INDEX IF NOT EXISTS evidence_ts ON evidence_records(tenant_id, ts);

CREATE TABLE IF NOT EXISTS metric_observations (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  subject_type TEXT NOT NULL, subject_id TEXT NOT NULL,
  metric TEXT NOT NULL,                          -- primitives: spend|impressions|reach|frequency|clicks|landing_page_views|conversions|purchases|leads|revenue|refunds|orders ; reconciliation-only: ctr_reported|cpc_reported|cpm_reported|cpa_reported|roas_reported
  value REAL,
  state TEXT NOT NULL DEFAULT 'observed',        -- observed|unsupported|not_connected|permission_missing|not_collected|rate_limited|unknown
  interval_start TEXT NOT NULL, interval_end TEXT NOT NULL,
  dimensions_json TEXT NOT NULL DEFAULT '{}', dimensions_hash TEXT NOT NULL DEFAULT 'none',
  currency TEXT, timezone TEXT,
  source TEXT NOT NULL, evidence_class TEXT NOT NULL DEFAULT 'provider_reported',
  observed_at TEXT NOT NULL, evidence_id TEXT, sync_run_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS metric_obs_uq ON metric_observations(tenant_id, subject_type, subject_id, metric, interval_start, interval_end, dimensions_hash, source);
CREATE INDEX IF NOT EXISTS metric_obs_subject ON metric_observations(tenant_id, subject_type, subject_id, interval_start);

CREATE TABLE IF NOT EXISTS external_estimates (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 't_root',
  subject_type TEXT NOT NULL, subject_id TEXT NOT NULL, metric TEXT NOT NULL,
  low REAL, mid REAL, high REAL, estimate_json TEXT,
  provider_id TEXT NOT NULL, method TEXT, confidence REAL,
  interval_start TEXT, interval_end TEXT, observed_at TEXT NOT NULL, evidence_id TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ext_est_uq ON external_estimates(tenant_id, subject_type, subject_id, metric, provider_id, COALESCE(interval_start,''), observed_at);
