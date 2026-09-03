-- OIP federation — invocation ledger isolation.
-- 0215 bound capabilities to a tenant and gated INVOCATION (writes) via tenantGateCheck, but the
-- invocation LEDGER read path was never scoped: any authed caller could read every tenant's
-- receipts. This closes that. invocations gains tenant_id (NULL / 't_root' = owner plane,
-- unchanged), stamped at log time from the invoking capability (dispatch.js invoke path).
-- Reads filter by it so a tenant token sees ONLY its own invocations — fulfilling 0215's stated
-- contract ("read ONLY its own receipts/ledger"). Applied to LEDGER (loop-shared-events).
ALTER TABLE invocations ADD COLUMN tenant_id TEXT;
CREATE INDEX IF NOT EXISTS idx_inv_tenant_ts ON invocations(tenant_id, ts);
