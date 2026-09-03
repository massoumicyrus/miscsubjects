-- 0013_secrets_audit_rows.sql
-- Add directory rows that expose every secret-backed capability:
--   STRIPE_PUBLIC_KEY_GET → returns env.STRIPE_PUBLIC_KEY (safe for client embedding)
--   VERIFY_BLOOIO_SIG     → HMAC-SHA256 hex of body using env.BLOOIO_WEBHOOK_SECRET (used by Blooio webhook handler)
-- Drops DB_ADMIN_TOKEN reference (legacy, no row).

INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at, category) VALUES
  ('STRIPE_PUBLIC_KEY_GET', 'fn', 'envGet', '', '["STRIPE_PUBLIC_KEY"]', '2026-06-09T18:00:00Z', 'stripe'),
  ('VERIFY_BLOOIO_SIG',     'fn', 'hmacSha256Hex', '', '["BLOOIO_WEBHOOK_SECRET","$1"]', '2026-06-09T18:00:00Z', 'blooio'),
  ('SECRETS_AUDIT',         'flow', '', '', 'D1_QUERY: SELECT auth, COUNT(*) AS rows FROM directory WHERE auth != '''' GROUP BY auth ORDER BY rows DESC', '2026-06-09T18:00:00Z', 'directory');
