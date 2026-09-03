-- 0041: focus BRAIN's tool view (smaller prompt, faster turns; full set still via DIRECTORY_LIST).
UPDATE directory SET allowed_categories='llm,arcads,docs,blooio,asset,directory,self_mod,pages' , updated_at=datetime('now') WHERE key='BRAIN';
