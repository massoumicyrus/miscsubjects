-- ARTICLE_ASK / ARTICLE_INGEST: $2+ rejoins question/evidence after first | (dispatch splits on |)
UPDATE directory SET content = '# WHAT: Answer from article ledger topology (claims, sources, Reddit/X anecdotes, user reports). Not medical advice.
# WHEN_TO_USE: user asks about a peptide, condition, stack, or a specific claim on miscsubjects.
# ARGS: slug|question   OR   slug1,slug2,slug3|question
# EX: [ARTICLE_ASK]bpc-157|What good and bad experiences are logged?[/ARTICLE_ASK]
["$1|$2+"]',
  updated_at = datetime('now')
WHERE key = 'ARTICLE_ASK';

UPDATE directory SET content = '# WHAT: Parse user-submitted evidence and write to article source ledger + optional claims. Hash-chained.
# WHEN_TO_USE: user texts evidence to add to a peptide article, or replies to a question node with new info.
# ARGS: slug|evidence text   OR   slug|q:NODE_ID|evidence text
# EX: [ARTICLE_INGEST]bpc-157|paste from another model here[/ARTICLE_INGEST]
["$1|$2+"]',
  updated_at = datetime('now')
WHERE key = 'ARTICLE_INGEST';