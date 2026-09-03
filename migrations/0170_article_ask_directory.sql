-- ROUTER / iMessage: ask article topology (claims + sources + anecdotes)
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'ARTICLE_ASK',
  'fn',
  'protoAsk',
  '',
  '# WHAT: Answer from article ledger topology (claims, sources, Reddit/X anecdotes, user reports). Not medical advice.
# WHEN_TO_USE: user asks about a peptide, condition, stack, or a specific claim on miscsubjects.
# ARGS: slug|question   e.g. bpc-157|I have herniated discs — what does your catalogue say?
# EX: [ARTICLE_ASK]bpc-157|What good and bad experiences are logged for BPC-157?[/ARTICLE_ASK]
["$1"]',
  'content',
  45,
  1,
  1,
  datetime('now')
);