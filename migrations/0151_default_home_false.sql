UPDATE articles
SET meta = json_set(COALESCE(meta, '{}'), '$.home', false),
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
WHERE json_extract(meta, '$.home') IS NULL;
