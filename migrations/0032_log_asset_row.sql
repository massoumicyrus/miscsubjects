-- 0032: LOG_ASSET dispatch row -> fn logAsset. Files an image into the asset library.
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES ('LOG_ASSET', 'fn', 'logAsset', '',
 '# File an image into the asset library. Args: category|label|url|source_url|engine|prompt|sender|chat|protocol|is_group|parent_id|r2_key. Returns asset id.
["$1","$2","$3","$4","$5","$6","$7","$8","$9","$10","$11","$12"]',
 'asset', 100, datetime('now'));
