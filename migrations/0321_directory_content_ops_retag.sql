UPDATE directory
SET category = 'content-ops', updated_at = datetime('now')
WHERE category = 'content' AND type IN ('agent','fn','http','flow');
