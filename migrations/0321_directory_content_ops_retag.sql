-- Owner order 2026-07-22: agents/tools/flows must never read as "content". The word "content"
-- is the article-corpus KIND; using it as a topical category on capabilities made the directory
-- label tools as content. Retag those capability rows to the unambiguous topical tag content-ops.
-- Articles are not in the directory table (they are projected from the articles table at read
-- time), so every category='content' row here is a capability, not a corpus node.
UPDATE directory
SET category = 'content-ops', updated_at = datetime('now')
WHERE category = 'content' AND type IN ('agent','fn','http','flow');
