-- ARTICLE_CLAIM: prompt-injection style claim post into ledger (voxel + posted_by)
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'ARTICLE_CLAIM',
  'fn',
  'protoClaim',
  '',
  '# WHAT: Post one tiered claim voxel into an article ledger with who_claims + posted_by provenance. Not medical advice.
# WHEN_TO_USE: user or model has one falsifiable assertion to append — who claims what, anecdote, study finding.
# ARGS: slug|tier|assertion   tier = human|preclinical|anecdotal|mechanistic|speculative
# EX: [ARTICLE_CLAIM]bpc-157|anecdotal|Reddit user reports gut healing after GLP-1[/ARTICLE_CLAIM]
["$1|$2+"]',
  'content',
  44,
  1,
  1,
  datetime('now')
);