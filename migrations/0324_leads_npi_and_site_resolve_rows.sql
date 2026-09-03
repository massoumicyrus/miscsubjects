-- Directory rows for the two new lead-discovery sources added 2026-07-22 (NPPES NPI registry
-- discovery + Google Places website backfill). The runners live in functions/_lib/fn_runners.js
-- (leadsDiscoverNpi, leadsResolveSitesPlaces). Rows were created live in D1; this migration
-- makes them survive a rebuild. The trailing JSON array is the arg template dispatch fills from
-- the pipe-split body — without it, dispatch defaults to a single "$1" arg.
INSERT INTO directory (key,type,target,auth,content,category,enabled,planner_visible,planner_rank,sensitive,created_at,updated_at)
VALUES (
  'LEADS_DISCOVER_NPI','fn','leadsDiscoverNpi','',
  '# WHAT: Discover leads from the NPPES NPI Registry (authoritative federal provider directory, free/no key). Real clinic identity + phone + address; no website (run LEADS_RESOLVE_SITES to backfill).
# WHEN_TO_USE: broad authoritative discovery of clinics/providers by taxonomy + city/state.
# ARGS: $1=taxonomy_description, $2=city, $3=state(2-letter), $4=limit(default 200).
# EX: [LEADS_DISCOVER_NPI]Nurse Practitioner|Miami|FL|200[/LEADS_DISCOVER_NPI]
["$1","$2","$3","$4"]',
  'leads',1,1,20,0,datetime('now'),datetime('now')
)
ON CONFLICT(key) DO UPDATE SET target=excluded.target, content=excluded.content, updated_at=datetime('now');

INSERT INTO directory (key,type,target,auth,content,category,enabled,planner_visible,planner_rank,sensitive,created_at,updated_at)
VALUES (
  'LEADS_RESOLVE_SITES','fn','leadsResolveSitesPlaces','',
  '# WHAT: Backfill missing websites on siteless leads (NPPES/OSM) by looking them up on Google Places by name+city, so the enrichment crawler can reach them.
# WHEN_TO_USE: after LEADS_DISCOVER_NPI or OSM discovery, before enrichment.
# ARGS: $1=limit(default 20).
# EX: [LEADS_RESOLVE_SITES]25[/LEADS_RESOLVE_SITES]
["$1"]',
  'leads',1,1,20,0,datetime('now'),datetime('now')
)
ON CONFLICT(key) DO UPDATE SET target=excluded.target, content=excluded.content, updated_at=datetime('now');
