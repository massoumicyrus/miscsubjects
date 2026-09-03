-- 0060_cloudflare_durable_objects_inventory.sql
-- Adds the Durable Objects namespace list endpoint the owner pasted.
-- This is a safe READ-only Cloudflare row. It uses the existing scoped Bearer token.

INSERT OR REPLACE INTO directory
  (key, type, target, auth, content, updated_at, category, allowed_categories, seq, enabled, planner_visible, planner_rank)
VALUES
  (
    'CF_DO_NAMESPACES',
    'http',
    'GET https://api.cloudflare.com/client/v4/accounts/$1/workers/durable_objects/namespaces?page=$2&per_page=$3',
    'bearer:CLOUDFLARE_API_TOKEN',
    '# List Durable Object namespaces owned by Cloudflare account $1. $2=page, default 1. $3=per_page, default 20. Returns id, class, name, script, use_sqlite. Source: Cloudflare API GET /accounts/{account_id}/workers/durable_objects/namespaces.',
    datetime('now'),
    'cloudflare',
    NULL,
    NULL,
    1,
    1,
    30
  );

INSERT INTO directory_tests (key, kind, args, expect_kind, expect_value, note) VALUES
  ('CF_DO_NAMESPACES', 'positive', '<CLOUDFLARE_ACCOUNT_ID>|1|20', 'contains', 'success', 'Cloudflare Durable Objects namespaces list endpoint'),
  ('CF_DO_NAMESPACES', 'inverse', '', 'contains', 'accounts/', 'Missing account id should not route to unrelated tool');
