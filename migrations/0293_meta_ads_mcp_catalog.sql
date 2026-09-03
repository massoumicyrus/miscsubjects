-- Meta Marketing API + Ads MCP: full tool catalog (directory rows), namespaced META_ADS_*.
-- Every row is POST /api/marketing/meta/<op>. Reads: read-auth. Writes: act-auth (create ops default PAUSED).
-- planner_rank=1 (top priority: owner core work). Idempotent. Does NOT touch legacy META_* rows except a priority bump.

INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_ACCOUNTS','http','POST https://miscsubjects.com/api/marketing/meta/accounts','','# WHAT: List all ad accounts (owned + client + authorized) with status, currency, spend.
# ARGS: JSON {} (no args).
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1200,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_ACCOUNT_GET','http','POST https://miscsubjects.com/api/marketing/meta/account-get','','# WHAT: Get one ad account: status, currency, spend, balance, spend_cap, funding, capabilities.
# ARGS: JSON {account_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1201,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CAMPAIGNS','http','POST https://miscsubjects.com/api/marketing/meta/campaigns','','# WHAT: List campaigns in an ad account (id,name,status,objective,budgets,times).
# ARGS: JSON {account_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1202,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_ADSETS','http','POST https://miscsubjects.com/api/marketing/meta/adsets','','# WHAT: List ad sets in an ad account (id,name,status,budget,campaign_id,effective_status).
# ARGS: JSON {account_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1203,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_ADS','http','POST https://miscsubjects.com/api/marketing/meta/ads','','# WHAT: List ads in an ad account (id,name,status,effective_status,adset_id,campaign_id,creative).
# ARGS: JSON {account_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1204,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CREATIVES','http','POST https://miscsubjects.com/api/marketing/meta/creatives','','# WHAT: List ad creatives (title,body,image_url,object_story_spec,cta,link).
# ARGS: JSON {account_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1205,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_IMAGES','http','POST https://miscsubjects.com/api/marketing/meta/images','','# WHAT: List ad images (name,url,hash,dimensions).
# ARGS: JSON {account_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1206,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_VIDEOS','http','POST https://miscsubjects.com/api/marketing/meta/videos','','# WHAT: List ad videos (title,description,length,thumbnails).
# ARGS: JSON {account_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1207,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_OBJECT_GET','http','POST https://miscsubjects.com/api/marketing/meta/object-get','','# WHAT: Get any Graph node by id with a fields list.
# ARGS: JSON {id, fields?}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1208,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_INSIGHTS','http','POST https://miscsubjects.com/api/marketing/meta/insights','','# WHAT: Comprehensive reporting: insights at account/campaign/adset/ad level with fields, breakdowns, date_preset or time_range, attribution windows, filtering.
# ARGS: JSON {object_id|account_id, level?, fields?, breakdowns?, date_preset?, time_range?, time_increment?, action_attribution_windows?, filtering?}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1209,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_INSIGHTS_ASYNC_CREATE','http','POST https://miscsubjects.com/api/marketing/meta/insights-async-create','','# WHAT: Start an async insights report job (large pulls).
# ARGS: JSON {object_id|account_id, level?, fields?, breakdowns?, date_preset?|time_range?}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1210,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_INSIGHTS_ASYNC_STATUS','http','POST https://miscsubjects.com/api/marketing/meta/insights-async-status','','# WHAT: Poll an async insights report job.
# ARGS: JSON {report_run_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1211,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_INSIGHTS_ASYNC_RESULT','http','POST https://miscsubjects.com/api/marketing/meta/insights-async-result','','# WHAT: Read a completed async insights report.
# ARGS: JSON {report_run_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1212,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_TARGETING_SEARCH','http','POST https://miscsubjects.com/api/marketing/meta/targeting-search','','# WHAT: Search targeting: interests, behaviors, demographics, employers, schools.
# ARGS: JSON {q, type?, class?, limit?}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1213,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_TARGETING_BROWSE','http','POST https://miscsubjects.com/api/marketing/meta/targeting-browse','','# WHAT: Browse the targeting interest taxonomy.
# ARGS: JSON {limit?}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1214,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_DELIVERY_ESTIMATE','http','POST https://miscsubjects.com/api/marketing/meta/delivery-estimate','','# WHAT: Estimated daily reach for a targeting spec + optimization goal.
# ARGS: JSON {account_id, optimization_goal, targeting_spec}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1215,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CATALOGS','http','POST https://miscsubjects.com/api/marketing/meta/catalogs','','# WHAT: List product catalogs on the business.
# ARGS: JSON {} (no args).
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1216,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CATALOG_GET','http','POST https://miscsubjects.com/api/marketing/meta/catalog-get','','# WHAT: Get a product catalog (product_count, vertical, feed_count).
# ARGS: JSON {catalog_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1217,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CATALOG_PRODUCTS','http','POST https://miscsubjects.com/api/marketing/meta/catalog-products','','# WHAT: List products in a catalog (retailer_id,availability,price,review_status,visibility).
# ARGS: JSON {catalog_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1218,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CATALOG_PRODUCT_SETS','http','POST https://miscsubjects.com/api/marketing/meta/catalog-product-sets','','# WHAT: List product sets in a catalog.
# ARGS: JSON {catalog_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1219,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CATALOG_FEEDS','http','POST https://miscsubjects.com/api/marketing/meta/catalog-feeds','','# WHAT: List data feeds in a catalog (schedule, latest_upload).
# ARGS: JSON {catalog_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1220,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CATALOG_DIAGNOSTICS','http','POST https://miscsubjects.com/api/marketing/meta/catalog-diagnostics','','# WHAT: Catalog diagnostics: data feed and item visibility issues.
# ARGS: JSON {catalog_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1221,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_PIXELS','http','POST https://miscsubjects.com/api/marketing/meta/pixels','','# WHAT: List ad account pixels/datasets (last_fired_time, availability, matching).
# ARGS: JSON {account_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1222,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_DATASET_STATS','http','POST https://miscsubjects.com/api/marketing/meta/dataset-stats','','# WHAT: Signal health/quality stats for a pixel/dataset.
# ARGS: JSON {pixel_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1223,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_AUDIENCES','http','POST https://miscsubjects.com/api/marketing/meta/audiences','','# WHAT: List custom audiences (subtype, size, operation_status).
# ARGS: JSON {account_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1224,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_STUDIES','http','POST https://miscsubjects.com/api/marketing/meta/studies','','# WHAT: List A/B tests and conversion-lift studies on the business.
# ARGS: JSON {} (no args).
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1225,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_STUDY_GET','http','POST https://miscsubjects.com/api/marketing/meta/study-get','','# WHAT: Get an A/B test / lift study (cells, objectives, status).
# ARGS: JSON {study_id}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1226,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_ACTIVITIES','http','POST https://miscsubjects.com/api/marketing/meta/activities','','# WHAT: Activity log for an ad account (Ads Manager change history).
# ARGS: JSON {account_id, limit?}.
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1227,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_MCP_TOOLS','http','POST https://miscsubjects.com/api/marketing/meta/mcp-tools','','# WHAT: List every tool exposed by Metas hosted Ads MCP server (live proxy to mcp.facebook.com/ads).
# ARGS: JSON {} (no args).
# TESTS: Read op; live Meta Graph read. Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1228,1,1,1,'{"type":"object"}','[]',0,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CAMPAIGN_CREATE','http','POST https://miscsubjects.com/api/marketing/meta/campaign-create','','# WHAT: Create a campaign (defaults status PAUSED so it does not spend until activated).
# ARGS: JSON {account_id, name, objective, status?, special_ad_categories?, buying_type?, bid_strategy?, daily_budget?, lifetime_budget?}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1229,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CAMPAIGN_UPDATE','http','POST https://miscsubjects.com/api/marketing/meta/campaign-update','','# WHAT: Update a campaign (name, status, budget, bid_strategy).
# ARGS: JSON {campaign_id|id, params:{...}}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1230,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_ADSET_CREATE','http','POST https://miscsubjects.com/api/marketing/meta/adset-create','','# WHAT: Create an ad set (defaults status PAUSED).
# ARGS: JSON {account_id, name, campaign_id, optimization_goal, billing_event, daily_budget?|lifetime_budget?, targeting?, bid_amount?, promoted_object?, start_time?, end_time?}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1231,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_ADSET_UPDATE','http','POST https://miscsubjects.com/api/marketing/meta/adset-update','','# WHAT: Update an ad set (status, budget, targeting, bid).
# ARGS: JSON {adset_id|id, params:{...}}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1232,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_AD_CREATE','http','POST https://miscsubjects.com/api/marketing/meta/ad-create','','# WHAT: Create an ad (defaults status PAUSED).
# ARGS: JSON {account_id, name, adset_id, creative:{creative_id}}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1233,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_AD_UPDATE','http','POST https://miscsubjects.com/api/marketing/meta/ad-update','','# WHAT: Update an ad (status, creative, name).
# ARGS: JSON {ad_id|id, params:{...}}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1234,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CREATIVE_CREATE','http','POST https://miscsubjects.com/api/marketing/meta/creative-create','','# WHAT: Create an ad creative.
# ARGS: JSON {account_id, name, object_story_spec|object_story_id|asset_feed_spec}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1235,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_STATUS_SET','http','POST https://miscsubjects.com/api/marketing/meta/status-set','','# WHAT: Pause/activate/archive any campaign, ad set or ad.
# ARGS: JSON {id, status:ACTIVE|PAUSED|ARCHIVED}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1236,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_BUDGET_SET','http','POST https://miscsubjects.com/api/marketing/meta/budget-set','','# WHAT: Set daily or lifetime budget (minor units / cents) on a campaign or ad set.
# ARGS: JSON {id, daily_budget?|lifetime_budget?}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1237,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_OBJECT_DELETE','http','POST https://miscsubjects.com/api/marketing/meta/object-delete','','# WHAT: Delete a campaign, ad set, ad or creative.
# ARGS: JSON {id}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1238,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_CATALOG_CREATE','http','POST https://miscsubjects.com/api/marketing/meta/catalog-create','','# WHAT: Create a product catalog on the business.
# ARGS: JSON {name, vertical?}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1239,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_AUDIENCE_CREATE','http','POST https://miscsubjects.com/api/marketing/meta/audience-create','','# WHAT: Create a custom audience (website/customer-list/engagement).
# ARGS: JSON {account_id, name, subtype, rule?|customer_file_source?, description?, retention_days?}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1240,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_LOOKALIKE_CREATE','http','POST https://miscsubjects.com/api/marketing/meta/lookalike-create','','# WHAT: Create a lookalike audience from a source custom audience.
# ARGS: JSON {account_id, name, origin_audience_id, country?, ratio?}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1241,1,1,1,'{"type":"object"}','[]',1,'http','');
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank,input_schema,examples,sensitive,runner,includes) VALUES ('META_ADS_MCP_CALL','http','POST https://miscsubjects.com/api/marketing/meta/mcp-call','','# WHAT: Call any tool on Metas hosted Ads MCP server by name (live proxy).
# ARGS: JSON {name, arguments:{...}}.
# TESTS: Write op; requires act auth; create ops default status PAUSED (no spend until activated). Full op index: GET/POST /api/marketing/meta.
$1+',datetime('now'),'marketing','marketing,governance,protocol',1242,1,1,1,'{"type":"object"}','[]',1,'http','');

UPDATE directory SET planner_rank=1 WHERE key IN ('META','META_ACCOUNTS','META_INSIGHTS','META_CAPI_EVENT','META_HEALTH','META_SYNC_BACKFILL','MARKETING_SNAPSHOT');
