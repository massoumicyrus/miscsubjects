-- 2026-06-21: existing articles without an explicit home flag should not appear on the home page.
-- New articles already default to home:false via the protocol layer.
UPDATE articles
SET meta = json_set(COALESCE(meta, '{}'), '$.home', false),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
WHERE json_extract(meta, '$.home') IS NULL;
