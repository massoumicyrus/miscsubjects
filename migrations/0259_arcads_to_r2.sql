-- ARCADS_TO_R2 (loop-content-spine / DB) — resolve a finished ArcAds asset and store its
-- bytes to R2 for a permanent https://miscsubjects.com/img/ link. Closes the "stored in R2"
-- chain for every ArcAds creative (gpt-image, nano-banana, grok-video, etc.).
INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES
('ARCADS_TO_R2', 'fn', 'arcadsToR2', '',
'# WHAT: Poll a finished ArcAds render by arcads_id and re-store its bytes to R2, returning a stable https://miscsubjects.com/img/ link (permanent, not a presigned/expiring S3 url). Waits up to 120s for the render.
# WHEN_TO_USE: after ARCADS_GENERATE / ARCADS_VIDEO_GENERATE returns an arcads_id, to get the durable asset link for the sheet / a text / an ad.
# ARGS: $1 = arcads_id, $2 = model label (optional, for the filename).
# EX: [ARCADS_TO_R2]9a14205f-3683-4231-abc4-bf6228017c0a|gpt-image[/ARCADS_TO_R2]
["$1","$2"]', 'creative', 20, 1, 1, datetime('now'));
