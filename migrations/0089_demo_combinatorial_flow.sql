-- 0089_demo_combinatorial_flow.sql — ONE demo flow proving cross-surface sequential composition.
-- DEMO_D1_TO_KV: Cloudflare API (d1_list) -> KV_PUT, passing the result via $$PREV. Deletable.
-- Revert: DELETE FROM directory WHERE key='DEMO_D1_TO_KV';
INSERT OR REPLACE INTO directory (key,type,target,auth,content,updated_at,category,allowed_categories,seq,enabled,planner_visible,planner_rank)
VALUES ('DEMO_D1_TO_KV','flow','','',
'# WHAT: demo — list D1 databases via the Cloudflare API, then store that JSON in KV. Proves sequential cross-surface composition.
# WHEN_TO_USE: demonstration of combinatorial flows only.
CF: d1_list|<CLOUDFLARE_ACCOUNT_ID>
> KV_PUT: demo_infra_snapshot|$$PREV',
'2026-06-14T19:40:00Z','demo',NULL,NULL,1,0,90);
