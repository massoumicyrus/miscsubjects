-- ARTICLE_ASK: cross-graph slugs + auto follow-up prompts
UPDATE directory SET content = '# WHAT: Answer from article ledger topology (claims, sources, Reddit/X anecdotes, user reports). Not medical advice.
# WHEN_TO_USE: user asks about a peptide, condition, stack, dosing question, or a specific claim on miscsubjects.
# ARGS: slug|question   OR   slug1,slug2,slug3|question
#   e.g. bpc-157|I have herniated discs — what does your catalogue say?
#   e.g. recovery-stack-herniated-disc,bpc-157,tb-500|what stack and what don''t you know?
# AUTO: single-slug questions that mention a condition (herniated disc, sciatica, GLP-1, etc.) auto-expand to graph topology.
# REPLY includes suggested_followups — offer 3 as iMessage/WhatsApp follow-ups.
# EX: [ARTICLE_ASK]bpc-157|What good and bad experiences are logged for BPC-157?[/ARTICLE_ASK]
["$1"]',
  updated_at = datetime('now')
WHERE key = 'ARTICLE_ASK';