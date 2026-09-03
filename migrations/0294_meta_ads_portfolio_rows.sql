-- Portfolio/businesses/pages read ops for the Meta Ads MCP catalog.
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES
('META_ADS_PORTFOLIO','http','POST https://miscsubjects.com/api/marketing/meta/portfolio','','# WHAT: Whole-portfolio rollup: every ad account with spend, total historical spend, spend-by-business, businesses and pages.
# ARGS: JSON {} (no args).
# TESTS: Read op; live Meta Graph read across /me/adaccounts + /me/businesses + /me/accounts.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1243,1,1,1,'{"type":"object"}','[]',0,'http',''),
('META_ADS_BUSINESSES','http','POST https://miscsubjects.com/api/marketing/meta/businesses','','# WHAT: List every Business Manager the user can access (id, name, verification_status).
# ARGS: JSON {} (no args).
# TESTS: Read op; live /me/businesses.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1244,1,1,1,'{"type":"object"}','[]',0,'http',''),
('META_ADS_PAGES','http','POST https://miscsubjects.com/api/marketing/meta/pages','','# WHAT: List every Facebook Page the user manages (id, name, category).
# ARGS: JSON {} (no args).
# TESTS: Read op; live /me/accounts.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1245,1,1,1,'{"type":"object"}','[]',0,'http','');
