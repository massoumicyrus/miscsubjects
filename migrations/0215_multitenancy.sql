
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id       TEXT PRIMARY KEY,          -- t_<slug>
  name            TEXT,
  status          TEXT DEFAULT 'active',     -- active | suspended
  allow_keys      TEXT DEFAULT '',           -- comma list of invokable keys, or '*' for all
  allow_prefixes  TEXT DEFAULT '',           -- comma list of key prefixes (e.g. ARTICLE,GROK)
  risk_ceiling    TEXT DEFAULT 'low',        -- low | high — max row sensitivity this tenant may reach
  owner_actor     TEXT,                      -- who provisioned it
  created_at      TEXT DEFAULT (datetime('now')),
  created_event_id TEXT
);

ALTER TABLE capabilities ADD COLUMN tenant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_cap_tenant ON capabilities(tenant_id);
