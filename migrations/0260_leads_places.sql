-- Google Places (New) discovery for the lead loop — better small-business coverage than Overpass.
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES
('LEADS_DISCOVER_PLACES','fn','leadsDiscoverPlaces','',
'# WHAT: Discover B2B leads via Google Places API (New) — med-spas/clinics/longevity by segment + city, with website/phone/rating. Better coverage than the Overpass source. Inserts into the leads table.
# WHEN_TO_USE: "find medspas in Newport Beach", building the wholesale target list.
# ARGS: $1=segment free text (e.g. "medical spa","longevity clinic"), $2=city, $3=limit (default 40).
# EX: [LEADS_DISCOVER_PLACES]medical spa|Newport Beach|40[/LEADS_DISCOVER_PLACES]
["$1","$2","$3"]','leads',20,1,1,datetime('now'));
