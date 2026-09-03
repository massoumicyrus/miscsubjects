-- 0326_leads_followups.sql — register LEADS_FOLLOWUPS as a callable directory row.
-- Generates touch 2 (new angle) + touch 3 (honest break-up) on the same thread for a drafted lead.
-- 40-60% of positive cold-outreach replies come from follow-ups, not the first send.
INSERT OR REPLACE INTO directory(key, target, type, content, updated_at) VALUES (
  'LEADS_FOLLOWUPS',
  'leadsFollowups',
  'fn',
  '# WHAT: Generate the follow-up sequence (touch 2 new-angle + touch 3 break-up) for an already-drafted lead, on the same thread. DOES NOT SEND. Stored on the lead draft as {followups:{touch2,touch3}}.
# WHEN_TO_USE: after LEADS_DRAFT_AI has produced the first touch; before sending, so the whole 3-touch sequence is staged for review.
# ARGS: $1=lead id, $2=brand (default LeoResearch).
# EX: [LEADS_FOLLOWUPS]2633|LeoResearch[/LEADS_FOLLOWUPS]
["$1","$2"]',
  datetime('now')
);
