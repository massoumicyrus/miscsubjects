-- Meta read surface via the miscsubjects-meta-bridge service binding. Read-only; the token
-- lives in the bridge (Secrets Store, by reference). No Meta write path exists.

INSERT OR REPLACE INTO directory (key, type, category, target, auth, content, planner_rank, updated_at)
VALUES
  ('META_ACCOUNTS', 'fn', 'marketing', 'metaAccounts', NULL,
'# WHAT: Live Meta ad accounts via the miscsubjects-meta-bridge service binding. Lists every owned/authorized account and upserts them into meta_ad_accounts so the marketing surface + Site Sync stay current. Read-only; never spends.
# WHEN_TO_USE: "what ad accounts do I have", "sync my meta accounts", refresh the ad-account list.
# ARGS: none.
# EX: [META_ACCOUNTS][/META_ACCOUNTS]
[]', 7, datetime('now')),
  ('META_INSIGHTS', 'fn', 'marketing', 'metaInsights', NULL,
'# WHAT: Per-account Meta performance (spend, impressions, clicks, purchases, ROAS) for a date preset, via the miscsubjects-meta-bridge. Read-only.
# WHEN_TO_USE: "how are my ads doing", "meta spend this week", reconcile ad spend against sales.
# ARGS: $1 = date preset (today|yesterday|last_7d|last_14d|last_30d|last_90d, default last_7d). $2 = optional comma-separated act_ ids.
# EX: [META_INSIGHTS]last_7d[/META_INSIGHTS]
["$1","$2"]', 7, datetime('now')),
  ('META_HEALTH', 'fn', 'marketing', 'metaHealth', NULL,
'# WHAT: Bridge + token health — confirms the Meta token is bound and does a live /me ping. Surfaces permission errors (e.g. missing ads_read) plainly.
# WHEN_TO_USE: "is meta connected", debugging why insights are empty.
# ARGS: none.
# EX: [META_HEALTH][/META_HEALTH]
[]', 6, datetime('now'));

INSERT OR IGNORE INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note)
VALUES
  ('META_HEALTH', 'positive', '', 2, 'contains', 'token_present', 'Bridge reports token presence and a /me ping result.', 'meta bridge 0257'),
  ('META_ACCOUNTS', 'positive', '', 2, 'contains', 'accounts', 'Live account list returns (or a plain permission error).', 'meta bridge 0257');
