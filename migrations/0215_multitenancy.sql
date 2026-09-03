-- OIP v0.5 — multi-tenancy proof layer, built on the existing object-capability substrate.
-- A tenant is an isolation boundary: its tokens may invoke ONLY its allow-listed keys/prefixes,
-- read ONLY its own receipts/ledger, and can never touch another tenant's data or the owner plane.
-- The capability record (already the auth substrate) gains a tenant_id; the token format is unchanged.
-- Applied to LEDGER (loop-shared-events), where capabilities + invocations live.

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

-- Bind every capability to a tenant. NULL / 't_root' = the owner plane (unrestricted, unchanged).
ALTER TABLE capabilities ADD COLUMN tenant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_cap_tenant ON capabilities(tenant_id);
