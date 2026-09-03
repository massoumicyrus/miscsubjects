-- 0072_content_dispatch_rows.sql — make content addressable through the directory kernel.
-- Read flows mirror the PAGES_LIST / SERVE_PAGE pattern (0008). Writes stay on the REST API
-- (POST/PATCH /api/content) — not added as dispatch rows to avoid shipping untested templating.

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, updated_at) VALUES
('CONTENT_LIST', 'flow', '', '',
 'D1_QUERY: SELECT slug,type,section,title,status,source_order FROM content_items ORDER BY type, (source_order IS NULL), source_order, slug',
 'content', strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('CONTENT_GET', 'flow', '', '',
 'D1_QUERY: SELECT * FROM content_items WHERE slug=''$1''',
 'content', strftime('%Y-%m-%dT%H:%M:%SZ','now')),
('CONTENT_SEARCH', 'flow', '', '',
 'D1_QUERY: SELECT slug,type,title,section FROM content_items WHERE title LIKE ''%$1%'' OR body_md LIKE ''%$1%'' OR tags_json LIKE ''%$1%'' LIMIT 100',
 'content', strftime('%Y-%m-%dT%H:%M:%SZ','now'));
