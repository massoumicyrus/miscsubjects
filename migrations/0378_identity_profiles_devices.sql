-- ONE PROFILE OBJECT. Human customers, browser-model actors, API agents, services, devices and
-- workflows are rows in the same table, so the customer graph the traffic engine writes and the
-- actor graph the authority plane reads are one graph. Column sets are the traffic engine's own
-- (functions/_lib/traffic/store.js INSERT lists) plus the authority columns: profile.kind, and on
-- devices the trust lifecycle, the human-verification instant and the proof-of-possession key.
-- No column here ever holds a raw phone, email, cookie, bearer token or browser fingerprint.

CREATE TABLE IF NOT EXISTS traffic_profiles (
  id                        TEXT PRIMARY KEY,                  -- prf_…
  tenant_id                 TEXT NOT NULL DEFAULT 't_root',
  kind                      TEXT NOT NULL DEFAULT 'human',     -- human|model|service|device|workflow
  known                     INTEGER NOT NULL DEFAULT 0,        -- an identifier has been joined
  customer                  INTEGER NOT NULL DEFAULT 0,
  tags_json                 TEXT NOT NULL DEFAULT '[]',
  attrs_json                TEXT NOT NULL DEFAULT '{}',
  original_attribution_json TEXT,
  account_state             TEXT,
  snapshot_json             TEXT,
  visit_count               INTEGER NOT NULL DEFAULT 0,
  first_seen                TEXT,
  last_seen                 TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL,
  merged_into               TEXT,
  merged_from_json          TEXT,
  erased_at                 TEXT,
  version                   INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS traffic_profiles_tenant_kind ON traffic_profiles(tenant_id, kind);
CREATE INDEX IF NOT EXISTS traffic_profiles_last_seen ON traffic_profiles(last_seen);

CREATE TABLE IF NOT EXISTS traffic_devices (
  id                  TEXT PRIMARY KEY,                        -- dev_…
  tenant_id           TEXT NOT NULL DEFAULT 't_root',
  profile_id          TEXT,
  trusted             INTEGER NOT NULL DEFAULT 0,
  trusted_at          TEXT,
  trust_reason        TEXT,
  trust_expires_at    TEXT,
  revoked_at          TEXT,
  last_verification   TEXT,                                    -- last human verification (Turnstile) instant
  verification_method TEXT,
  public_key_jwk      TEXT,                                    -- EC P-256 public half only, for proof of possession
  label               TEXT,
  class               TEXT,
  browser             TEXT,
  os                  TEXT,
  locale              TEXT,
  timezone            TEXT,
  first_seen          TEXT,
  last_seen           TEXT,
  last_ip_prefix      TEXT,
  last_region         TEXT,
  visit_count         INTEGER NOT NULL DEFAULT 0,
  meta_json           TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS traffic_devices_profile ON traffic_devices(profile_id);

CREATE TABLE IF NOT EXISTS traffic_identifiers (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL DEFAULT 't_root',
  profile_id      TEXT NOT NULL,
  kind            TEXT NOT NULL,                               -- phone|email|customer_id|stripe_customer|…
  value_hash      TEXT NOT NULL,                               -- hmac-style hash, never the value
  value_masked    TEXT,
  value_secure    TEXT,
  match_type      TEXT,
  match_method    TEXT,
  confidence      REAL,
  source          TEXT,
  source_ref      TEXT,
  first_seen      TEXT,
  last_seen       TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  provenance_json TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS traffic_identifiers_unique ON traffic_identifiers(profile_id, kind, value_hash);
CREATE INDEX IF NOT EXISTS traffic_identifiers_lookup ON traffic_identifiers(kind, value_hash);

CREATE TABLE IF NOT EXISTS traffic_events (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL DEFAULT 't_root',
  ts               TEXT NOT NULL,
  kind             TEXT,
  event_type       TEXT NOT NULL,
  decision_id      TEXT,
  profile_id       TEXT,
  device_id        TEXT,
  session_id       TEXT,
  destination_id   TEXT,
  experiment_id    TEXT,
  variant          TEXT,
  campaign_id      TEXT,
  url              TEXT,
  source           TEXT,
  source_event_id  TEXT,
  payload_json     TEXT,
  attribution_json TEXT,
  provenance_json  TEXT,
  evidence_hash    TEXT,
  ingested_at      TEXT
);
CREATE INDEX IF NOT EXISTS traffic_events_profile_ts ON traffic_events(profile_id, ts);
CREATE INDEX IF NOT EXISTS traffic_events_type_ts ON traffic_events(event_type, ts);

CREATE TABLE IF NOT EXISTS traffic_sessions (
  session_id         TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL DEFAULT 't_root',
  profile_id         TEXT,
  device_id          TEXT,
  started_at         TEXT,
  last_seen          TEXT,
  landing_page       TEXT,
  attribution_json   TEXT,
  campaign_id        TEXT,
  experiments_json   TEXT,
  routing_state_json TEXT,
  verification_state TEXT,
  decisions          INTEGER NOT NULL DEFAULT 0,
  last_decision_id   TEXT
);
