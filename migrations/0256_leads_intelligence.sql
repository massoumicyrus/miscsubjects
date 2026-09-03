-- Lead-system intelligence: mailbox verification + AI ICP scoring (no send paths touched;
-- LEADS_SEND / LEADS_SEND_BATCH stay CONFIRM-gated exactly as migration 0254 left them).

INSERT OR REPLACE INTO directory (key, type, category, target, auth, content, planner_rank, updated_at)
VALUES
  ('LEADS_VERIFY_MX', 'fn', 'biz-dev', 'leadsVerifyMx', NULL,
'# WHAT: Verify lead emails actually have a mailbox behind them — DNS-over-HTTPS MX lookup per domain. Tags every checked lead mx:ok or mx:none; a no-MX lead still in new/enriched is parked as status no_mx so drafting never wastes a slot on a dead address.
# WHEN_TO_USE: before any draft wave; "verify the lead emails", "clean the lead list".
# ARGS: $1 = max leads to check this call (default 25, cap 50).
# EX: [LEADS_VERIFY_MX]25[/LEADS_VERIFY_MX]
["$1"]', 6, datetime('now')),
  ('LEADS_SCORE_AI', 'fn', 'biz-dev', 'leadsScoreAI', NULL,
'# WHAT: AI ICP scoring — one Grok (grok-4.3) call scores a batch of enriched leads 0-100 on real wholesale/white-label peptide buying fit, grounded in OUTREACH_DOSSIER. Writes score + an icp: note (buyer type, volume guess, concrete reason) so LEADS_LIST ranks by commercial fit instead of has-a-website.
# WHEN_TO_USE: after enrichment, before drafting; "score the leads", "which leads are actually worth emailing".
# ARGS: $1 = batch size (default 8, cap 10). Call repeatedly until it returns scored:0.
# EX: [LEADS_SCORE_AI]8[/LEADS_SCORE_AI]
["$1"]', 6, datetime('now'));

INSERT OR IGNORE INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note)
VALUES
  ('LEADS_VERIFY_MX', 'positive', '2', 2, 'contains', 'checked', 'MX verification runs and reports checked/mx_ok/mx_none counts.', 'lead intelligence 0256'),
  ('LEADS_SCORE_AI', 'positive', '2', 2, 'contains', 'scored', 'ICP scoring runs and reports a scored count.', 'lead intelligence 0256');
