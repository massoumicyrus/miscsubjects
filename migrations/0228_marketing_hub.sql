-- Marketing hub: expanded Meta API, lbl.fyi bridge, model knowledge, daily sync automation.

UPDATE directory SET
  target = 'target_map:{"me":{"method":"GET","url":"https://graph.facebook.com/v22.0/me?fields=id,name"},"ad_accounts":{"method":"GET","url":"https://graph.facebook.com/v22.0/$1/adaccounts?fields=id,account_id,name,account_status,currency,timezone_name&limit=200"},"owned_ad_accounts":{"method":"GET","url":"https://graph.facebook.com/v22.0/$1/owned_ad_accounts?fields=id,account_id,name,account_status,currency,timezone_name&limit=200"},"client_ad_accounts":{"method":"GET","url":"https://graph.facebook.com/v22.0/$1/client_ad_accounts?fields=id,account_id,name,account_status,currency,timezone_name&limit=200"},"campaigns":{"method":"GET","url":"https://graph.facebook.com/v22.0/$1/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget&limit=250"},"adsets":{"method":"GET","url":"https://graph.facebook.com/v22.0/$1/adsets?fields=id,name,status,daily_budget,campaign_id,effective_status&limit=250"},"ads":{"method":"GET","url":"https://graph.facebook.com/v22.0/$1/ads?fields=id,name,status,effective_status,adset_id,campaign_id,creative&limit=250"},"adcreatives":{"method":"GET","url":"https://graph.facebook.com/v22.0/$1/adcreatives?fields=id,name,title,body,image_url,thumbnail_url,object_story_spec,call_to_action_type&limit=250"},"ad_images":{"method":"GET","url":"https://graph.facebook.com/v22.0/$1/adimages?fields=id,name,url,hash&limit=250"},"insights":{"method":"GET","url":"https://graph.facebook.com/v22.0/$1/insights?level=$2&fields=spend,impressions,clicks,ctr,cpc,cpm,inline_link_clicks,actions,action_values&time_range={\"since\":\"$3\",\"until\":\"$4\"}&limit=500"},"capi_post":{"method":"POST","url":"https://graph.facebook.com/v22.0/27209526152071970/events","body":"{\"data\":[{\"event_name\":\"$1\",\"event_time\":$2,\"event_id\":\"$3\",\"event_source_url\":\"$4\",\"action_source\":\"website\",\"user_data\":{\"client_ip_address\":\"$5\",\"client_user_agent\":\"$6\"}}]}"}}',
  content = '# WHAT: Meta Graph API unified entrypoint (Marketing API)
# WHEN_TO_USE: Meta ad accounts, campaigns, adsets, ads, creatives, insights, CAPI
# ARGS: $1=op, $2..$N=args per op
# OPS: me | ad_accounts | owned_ad_accounts | client_ad_accounts | campaigns | adsets | ads | adcreatives | ad_images | insights | capi_post
# EX owned: [META]owned_ad_accounts|1602361853681297[/META]
# EX campaigns: [META]campaigns|act_1541755486898502[/META]
# EX insights: [META]insights|act_1541755486898502|account|2026-06-01|2026-07-05[/META]
# TESTS: POSITIVE/INVERSE per op. ERR:target_map:unknown_op on bad op.',
  category = 'meta',
  updated_at = datetime('now')
WHERE key = 'META';

INSERT OR IGNORE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES
('LBL_VIEWER_GET', 'fn', 'lblViewerGet', '',
'# WHAT: GET a path on lbl.fyi viewer (Meta tab, JCI cloaker, intelligence). Uses LBL_VIEWER_PASS cookie auth.
# WHEN_TO_USE: read lbl D1-backed marketing/cloaker data from this build
# ARGS: path after host, e.g. api/meta/accounts or api/cloaker-events?limit=50
# EX: [LBL_VIEWER_GET]api/meta/creatives[/LBL_VIEWER_GET]
["$1+"]',
'loopdata', 44, 1, 1, datetime('now')),

('MARKETING_SNAPSHOT', 'fn', 'marketingSnapshot', '',
'# WHAT: Live Meta accounts + lbl.fyi cached meta/creatives/cloaker + MARKETING_STATE — one JSON for models.
# WHEN_TO_USE: "what ads am I running", "marketing status", "ad accounts overview"
# ARGS: none
# EX: [MARKETING_SNAPSHOT][/MARKETING_SNAPSHOT]
[]',
'meta', 42, 1, 1, datetime('now')),

('META_SYNC_BACKFILL', 'fn', 'metaSyncBackfill', '',
'# WHAT: POST api.lbl.fyi/v1/sync/meta/insights_backfill — pull Meta insights into lbl D1. Ledgered.
# WHEN_TO_USE: "sync meta ads", "refresh ad data", daily cron target
# ARGS: none
# EX: [META_SYNC_BACKFILL][/META_SYNC_BACKFILL]
[]',
'meta', 43, 1, 1, datetime('now'));

UPDATE directory SET enabled = 1, content = '# KNOWLEDGE — fetch a knowledge card for models
# ARGS: topic — CUSTOMER_FUNNEL | AD_ACCOUNTS | MARKETING_STATE | LEO_RESEARCH | IMAGE_REFERENCE | REACTIONS | BATCH | ARTICLE_LIST
# EX: [KNOWLEDGE]AD_ACCOUNTS[/KNOWLEDGE]
["$1"]', updated_at = datetime('now') WHERE key = 'KNOWLEDGE';

INSERT OR REPLACE INTO settings (key, value, description, updated_at) VALUES
('marketing_state', '{"focus":"meta_ads_pivot","active_work":"eagle bulk upload eagle1-50 to Meta","eagle_folder":"~/Downloads/eagle-1-50","naming":{"adset":"eagleNN-adset","ad":"eagleNN-ad","utm_content":"eagleNN"},"funnel":"ads → justcloakit → tap-to-text → Blooio lead → Regeneration guide reply","lbl_viewer":"https://lbl.fyi","admin_tab":"https://miscsubjects.com/admin/marketing"}',
 'Model-facing marketing focus', datetime('now')),

('customer_funnel', 'CUSTOMER FUNNEL (Meta ads → miscsubjects)
1. Ad click lands on miscsubjects.com (cloaker ON → humans to leoresearch.com/l/meta money page; bots see safe page).
2. Tap-to-text / Health Hacks CTA → iMessage to Blooio number.
3. Lead routed to WA group grp_98e1acc03a3148f3 for operator visibility.
4. Standard reply: Regeneration vs Degeneration guide — miscsubjects.com article links (BPC-157, TB-500, ARA-290, spine stacks), article ledger note, LeoResearch.com storefront, "Questions? Just reply here."
5. Owner [OWNER_PHONE] is NOT a lead — boolean routing in ROUTER.
6. JCI click data: lbl.fyi JCI tab / [LBL_VIEWER_GET]api/cloaker-events?limit=50[/LBL_VIEWER_GET]
7. Meta performance: [MARKETING_SNAPSHOT] or /admin/marketing',
 'Customer funnel knowledge card for ROUTER', datetime('now'));

INSERT OR IGNORE INTO automations (name, every_min, key, body, enabled, created_at, runs, trigger) VALUES
('daily meta insights backfill', 1440, 'META_SYNC_BACKFILL', '', 1, datetime('now'), 0, 'schedule');