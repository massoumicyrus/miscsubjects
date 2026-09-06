-- TRAFFIC ENGINE — the config, evidence and funnel tables the engine reads and writes.
-- The identity tables (traffic_profiles/devices/identifiers/events/sessions) ship in 0378; this
-- migration adds everything the splitter, evaluator, lists, Turnstile, grants, SMS funnel,
-- experiments, memberships and JCI history need. All CREATE ... IF NOT EXISTS so it is idempotent.

-- ---------------------------------------------------------------- configuration (owner-authored)
CREATE TABLE IF NOT EXISTS traffic_rulesets (
  id                       TEXT PRIMARY KEY,
  tenant_id                TEXT NOT NULL DEFAULT 't_root',
  name                     TEXT,
  description              TEXT,
  state                    TEXT NOT NULL DEFAULT 'draft',   -- draft|test|active|retired
  entry_json               TEXT NOT NULL DEFAULT '[]',      -- [{host,path,entry}] patterns (glob)
  priority                 INTEGER NOT NULL DEFAULT 100,
  default_destination      TEXT,
  fail_mode                TEXT NOT NULL DEFAULT 'FALLBACK', -- FAIL_CLOSED|FALLBACK|DENY|STATIC_PAGE
  static_html              TEXT,
  business_tz              TEXT DEFAULT 'America/Los_Angeles',
  turnstile_max_age_s      INTEGER DEFAULT 86400,
  capture_query_json       TEXT DEFAULT '[]',
  allowed_capabilities_json TEXT DEFAULT '[]',
  enrichment_json          TEXT DEFAULT '[]',
  salt                     TEXT,
  status_precedence_json   TEXT,
  campaign_id              TEXT,
  revision                 INTEGER NOT NULL DEFAULT 0,
  hash                     TEXT,
  activated_at             TEXT,
  activated_by             TEXT,
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS traffic_rulesets_tenant_state ON traffic_rulesets(tenant_id, state);

CREATE TABLE IF NOT EXISTS traffic_rules (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL DEFAULT 't_root',
  ruleset_id     TEXT NOT NULL,
  name           TEXT,
  description    TEXT,
  enabled        INTEGER NOT NULL DEFAULT 1,
  shadow         INTEGER NOT NULL DEFAULT 0,
  priority       INTEGER NOT NULL DEFAULT 100,
  condition_json TEXT NOT NULL DEFAULT '{}',
  actions_json   TEXT NOT NULL DEFAULT '[]',
  on_match       TEXT NOT NULL DEFAULT 'stop',              -- stop|continue
  effective_from TEXT,
  effective_to   TEXT,
  revision       INTEGER NOT NULL DEFAULT 1,
  created_by     TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS traffic_rules_ruleset ON traffic_rules(tenant_id, ruleset_id, priority);

CREATE TABLE IF NOT EXISTS traffic_destinations (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL DEFAULT 't_root',
  name                   TEXT,
  type                   TEXT NOT NULL DEFAULT 'redirect',  -- redirect|inline|proxy|group|static|squeeze
  url                    TEXT,
  html                   TEXT,
  enabled                INTEGER NOT NULL DEFAULT 1,
  health                 TEXT DEFAULT 'healthy',            -- healthy|degraded|maintenance|down|unknown
  fallback_id            TEXT,
  allowed_hosts_json     TEXT DEFAULT '[]',
  query_passthrough      TEXT DEFAULT 'attribution',        -- all|none|attribution|list
  attribution_passthrough INTEGER NOT NULL DEFAULT 1,
  grant_required         INTEGER NOT NULL DEFAULT 0,
  grant_ttl_s            INTEGER DEFAULT 300,
  grant_one_time         INTEGER NOT NULL DEFAULT 1,
  members_json           TEXT,
  sticky                 INTEGER NOT NULL DEFAULT 0,
  campaign_id            TEXT,
  meta_json              TEXT DEFAULT '{}',
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS traffic_destinations_tenant ON traffic_destinations(tenant_id);

CREATE TABLE IF NOT EXISTS traffic_list_entries (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL DEFAULT 't_root',
  list        TEXT NOT NULL,                                -- allow|deny
  kind        TEXT NOT NULL,                                -- profile|device|identifier|ip|cidr|country|asn|email_domain|tag|ua|referrer|region|visitor_hash|phone_hash
  value       TEXT NOT NULL,
  reason      TEXT NOT NULL,
  expires_at  TEXT,
  enabled     INTEGER NOT NULL DEFAULT 1,
  priority    INTEGER NOT NULL DEFAULT 100,
  effect      TEXT NOT NULL DEFAULT 'decide',               -- decide|score|skip_challenge|route|set
  effect_json TEXT DEFAULT '{}',
  provenance  TEXT,
  meta_json   TEXT DEFAULT '{}',
  created_by  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS traffic_list_entries_tenant ON traffic_list_entries(tenant_id, list, priority);
CREATE INDEX IF NOT EXISTS traffic_list_entries_kind ON traffic_list_entries(tenant_id, kind, value);

CREATE TABLE IF NOT EXISTS traffic_segments (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL DEFAULT 't_root',
  name           TEXT,
  description    TEXT,
  condition_json TEXT NOT NULL DEFAULT '{}',
  enabled        INTEGER NOT NULL DEFAULT 1,
  scope          TEXT DEFAULT 'request',                    -- request|profile|both
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS traffic_experiments (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL DEFAULT 't_root',
  name                   TEXT,
  description            TEXT,
  enabled                INTEGER NOT NULL DEFAULT 1,
  state                  TEXT DEFAULT 'draft',              -- draft|active|paused|ended
  assignment             TEXT DEFAULT 'deterministic',      -- deterministic|random
  unit                   TEXT DEFAULT 'profile',            -- profile|device
  salt                   TEXT,
  variants_json          TEXT NOT NULL DEFAULT '[]',
  segment_condition_json TEXT,
  start_at               TEXT,
  end_at                 TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS traffic_campaigns (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL DEFAULT 't_root',
  name                   TEXT,
  description            TEXT,
  enabled                INTEGER NOT NULL DEFAULT 1,
  ruleset_id             TEXT,
  entry                  TEXT,
  attribution_json       TEXT,
  default_destination    TEXT,
  approved_destination   TEXT,
  blocked_destination    TEXT,
  review_destination     TEXT,
  fallback_destination   TEXT,
  blocked_capture        INTEGER NOT NULL DEFAULT 0,
  sms_phone              TEXT,
  sms_channel            TEXT DEFAULT 'blooio',
  sms_message_template   TEXT,
  sms_reply_approved     TEXT,
  sms_reply_blocked      TEXT,
  sms_reply_review       TEXT,
  access_policy_json     TEXT,
  experiments_json       TEXT,
  expected_countries_json TEXT,
  start_at               TEXT,
  end_at                 TEXT,
  goals_json             TEXT,
  created_at             TEXT NOT NULL,
  updated_at             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS traffic_squeeze_pages (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL DEFAULT 't_root',
  campaign_id     TEXT NOT NULL,
  name            TEXT,
  enabled         INTEGER NOT NULL DEFAULT 1,
  version         INTEGER NOT NULL DEFAULT 1,
  weight          INTEGER NOT NULL DEFAULT 1,
  status          TEXT DEFAULT 'draft',                     -- draft|active|retired
  headline        TEXT,
  body_html       TEXT,
  cta_text        TEXT,
  media_json      TEXT,
  layout          TEXT,
  phone           TEXT,
  channel         TEXT,
  message_template TEXT,
  completion_html TEXT,
  fallback_html   TEXT,
  start_at        TEXT,
  end_at          TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS traffic_squeeze_campaign ON traffic_squeeze_pages(tenant_id, campaign_id);

CREATE TABLE IF NOT EXISTS traffic_signal_policy (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL DEFAULT 't_root',
  signal       TEXT NOT NULL,
  value        TEXT,
  effect       TEXT NOT NULL DEFAULT 'observe',             -- allow|block|score|challenge|observe
  effect_value TEXT,
  note         TEXT,
  enabled      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- ---------------------------------------------------------------- evidence & runtime (append-only)
CREATE TABLE IF NOT EXISTS traffic_decisions (
  decision_id             TEXT PRIMARY KEY,
  tenant_id               TEXT NOT NULL DEFAULT 't_root',
  ts                      TEXT NOT NULL,
  request_id              TEXT,
  host                    TEXT,
  path                    TEXT,
  entry                   TEXT,
  mode                    TEXT,                             -- live|test|explain|replay|post_sms
  profile_id              TEXT,
  device_id               TEXT,
  session_id              TEXT,
  ruleset_id              TEXT,
  ruleset_revision        INTEGER,
  ruleset_hash            TEXT,
  signals_json            TEXT,
  evaluated_json          TEXT,
  matched_rules_json      TEXT,
  list_matches_json       TEXT,
  turnstile_json          TEXT,
  experiment_json         TEXT,
  destination_id          TEXT,
  experience              TEXT,
  outcome                 TEXT,
  campaign_id             TEXT,
  fallback_used           INTEGER,
  fail_mode_used          TEXT,
  reason                  TEXT,
  latency_ms              INTEGER,
  grant_jti               TEXT,
  shadow_json             TEXT,
  error                   TEXT,
  evidence_hash           TEXT,
  ledger_event_id         TEXT,
  response_kind           TEXT,
  response_target         TEXT,
  profile_snapshot_version INTEGER
);
CREATE INDEX IF NOT EXISTS traffic_decisions_ts ON traffic_decisions(tenant_id, ts);
CREATE INDEX IF NOT EXISTS traffic_decisions_profile ON traffic_decisions(tenant_id, profile_id, ts);

CREATE TABLE IF NOT EXISTS traffic_grants (
  jti              TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL DEFAULT 't_root',
  audience         TEXT,
  destination_id   TEXT,
  profile_id       TEXT,
  device_id        TEXT,
  issued_at        TEXT,
  expires_at       TEXT,
  one_time         INTEGER,
  consumed_at      TEXT,
  consumed_by      TEXT,
  reason           TEXT,
  ruleset_revision INTEGER,
  decision_id      TEXT,
  status           TEXT,
  error            TEXT
);
CREATE INDEX IF NOT EXISTS traffic_grants_device ON traffic_grants(tenant_id, device_id);

CREATE TABLE IF NOT EXISTS traffic_acknowledgements (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL DEFAULT 't_root',
  policy_key     TEXT,
  policy_version TEXT,
  profile_id     TEXT,
  device_id      TEXT,
  accepted_at    TEXT,
  source         TEXT,
  expires_at     TEXT,
  meta_json      TEXT,
  revoked_at     TEXT
);
CREATE INDEX IF NOT EXISTS traffic_ack_device ON traffic_acknowledgements(tenant_id, device_id);

CREATE TABLE IF NOT EXISTS traffic_memberships (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL DEFAULT 't_root',
  subject_kind     TEXT NOT NULL,                           -- profile|device|phone_hash|visitor_hash
  subject_value    TEXT NOT NULL,
  status           TEXT NOT NULL,                           -- approved|blocked|review
  population       TEXT NOT NULL,
  source           TEXT,
  provenance_json  TEXT,
  original_decision TEXT,
  original_reason  TEXT,
  decided_at       TEXT,
  imported_at      TEXT,
  confidence       REAL,
  evidence_json    TEXT DEFAULT '[]',
  effective_status TEXT,
  created_by       TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  superseded_at    TEXT,
  superseded_by    TEXT
);
CREATE INDEX IF NOT EXISTS traffic_memberships_subject ON traffic_memberships(tenant_id, subject_kind, subject_value, superseded_at);

CREATE TABLE IF NOT EXISTS traffic_ruleset_revisions (
  id            TEXT PRIMARY KEY,                            -- <ruleset_id>:<revision>
  tenant_id     TEXT NOT NULL DEFAULT 't_root',
  ruleset_id    TEXT NOT NULL,
  revision      INTEGER NOT NULL,
  hash          TEXT,
  snapshot_json TEXT,
  activated_at  TEXT,
  activated_by  TEXT,
  note          TEXT
);
CREATE INDEX IF NOT EXISTS traffic_revisions_ruleset ON traffic_ruleset_revisions(tenant_id, ruleset_id, revision);

CREATE TABLE IF NOT EXISTS traffic_assignments (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL DEFAULT 't_root',
  experiment_id     TEXT NOT NULL,
  unit_key          TEXT,
  profile_id        TEXT,
  device_id         TEXT,
  session_id        TEXT,
  variant           TEXT,
  assignment_method TEXT,
  assigned_at       TEXT,
  decision_id       TEXT
);
CREATE INDEX IF NOT EXISTS traffic_assignments_lookup ON traffic_assignments(tenant_id, experiment_id, profile_id);

CREATE TABLE IF NOT EXISTS traffic_codes (
  code                 TEXT NOT NULL,
  tenant_id            TEXT NOT NULL DEFAULT 't_root',
  campaign_id          TEXT,
  squeeze_page_id      TEXT,
  profile_id           TEXT,
  device_id            TEXT,
  session_id           TEXT,
  decision_id          TEXT,
  issued_at            TEXT,
  expires_at           TEXT,
  status               TEXT,                                 -- issued|received|verified|expired
  meta_json            TEXT,
  phone_hash           TEXT,
  phone_masked         TEXT,
  received_at          TEXT,
  inbound_event_id     TEXT,
  verified_at          TEXT,
  outcome              TEXT,
  outcome_decision_id  TEXT,
  progression_grant_jti TEXT,
  PRIMARY KEY (tenant_id, code)
);
CREATE INDEX IF NOT EXISTS traffic_codes_status ON traffic_codes(tenant_id, status, expires_at);

CREATE TABLE IF NOT EXISTS traffic_history (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL DEFAULT 't_root',
  ts                TEXT,
  source            TEXT,
  route             TEXT,
  visitor_hash      TEXT,
  ua                TEXT,
  language          TEXT,
  referrer          TEXT,
  query             TEXT,
  decision          TEXT,                                    -- allowed|blocked
  raw_status        TEXT,
  raw_reason        TEXT,
  raw_network       TEXT,
  isp               TEXT,
  org               TEXT,
  os                TEXT,
  browser           TEXT,
  device_type       TEXT,
  connection_type   TEXT,
  country_code      TEXT,
  region            TEXT,
  city              TEXT,
  ip_timezone       TEXT,
  signals_json      TEXT,
  utm_json          TEXT,
  click_ids_json    TEXT,
  imported_at       TEXT,
  returning         INTEGER,
  replay_json       TEXT,
  replay_decision   TEXT,
  replay_reason     TEXT,
  replay_agreement  INTEGER,
  replay_ruleset    TEXT,
  replay_revision   INTEGER,
  replayed_at       TEXT
);
CREATE INDEX IF NOT EXISTS traffic_history_visitor ON traffic_history(tenant_id, visitor_hash, ts);

CREATE TABLE IF NOT EXISTS traffic_merge_log (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL DEFAULT 't_root',
  kind               TEXT,
  from_profiles_json TEXT,
  into_profile       TEXT,
  reason             TEXT,
  evidence_json      TEXT,
  actor              TEXT,
  ts                 TEXT,
  undo_json          TEXT
);

CREATE TABLE IF NOT EXISTS traffic_merge_proposals (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL DEFAULT 't_root',
  profile_a  TEXT,
  profile_b  TEXT,
  basis      TEXT,
  confidence REAL,
  status     TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS traffic_features (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL DEFAULT 't_root',
  profile_id      TEXT NOT NULL,
  feature         TEXT NOT NULL,
  value           TEXT,
  value_json      TEXT,
  confidence      REAL,
  source          TEXT,
  source_refs_json TEXT,
  provenance_json TEXT,
  first_seen      TEXT,
  updated_at      TEXT
);
CREATE INDEX IF NOT EXISTS traffic_features_profile ON traffic_features(tenant_id, profile_id, feature);
