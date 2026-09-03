-- 0035: ArcAds video + presigned upload + credit budget (80,440/mo).

CREATE TABLE IF NOT EXISTS arcads_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  kind TEXT,          -- image | video
  model TEXT,
  asset_id TEXT,
  credits INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS arcads_ledger_ts_idx ON arcads_ledger(ts);

INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('arcads_monthly_credits', '80440', datetime('now'));

INSERT OR REPLACE INTO directory
 (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES

('ARCADS_VIDEO_GENERATE', 'fn', 'arcadsVideoGenerate', '',
 '# Generate a video via ArcAds, poll, store to R2, return a stable link. Args: model|prompt|aspectRatio|referenceImages|duration|productId.
# model: sora2 | sora2-pro | veo31 | kling-2.6 | kling-3.0 | grok-video | seedance | seedance-2.0 | happy-horse
# aspectRatio: 1:1 | 16:9 | 9:16 (grok-video also auto; seedance-2.0 only 9:16|16:9)
# duration sec: sora2/pro 4/8/12/16/20 · kling-2.6 5/10 · kling-3.0 3-15 · grok-video 1-15 · seedance 4-12 · seedance-2.0 4-15 · veo31 n/a
# referenceImages (comma list, http auto-uploaded): max sora2 1, sora2-pro 1, veo31 3, seedance 1, seedance-2.0 9, happy-horse 1
["$1","$2","$3","$4","$5","$6"]',
 'arcads', 6, datetime('now')),

('ARCADS_VIDEO_RAW', 'http', 'POST https://external-api.arcads.ai/v2/videos/generate', 'headers:{"Authorization":"$ARCADS_BASIC_AUTH","Accept":"application/json","Content-Type":"application/json"}',
 '# Raw ArcAds video generate (returns {id}; no poll). Pass full JSON body as $1 for total control: {model,productId,prompt,aspectRatio,duration,resolution,referenceImages[],referenceVideos[],referenceAudios[],audioEnabled,startFrame,endFrame,nbGenerations,enhance,projectId}.
$1',
 'arcads', 100, datetime('now')),

('ARCADS_UPLOAD', 'fn', 'arcadsUpload', '',
 '# Upload a file to ArcAds (presign + S3 PUT). Args: source_url|file_type. Returns {filePath,fileId}; pass filePath in referenceImages. fileType e.g. image/png, image/jpeg, video/mp4, audio/mp3.
["$1","$2"]',
 'arcads', 100, datetime('now')),

('ARCADS_CREDITS', 'fn', 'arcadsCredits', '',
 '# ArcAds credit usage this month. Returns {month,used,cap,remaining}. Cap from settings.arcads_monthly_credits (80440). Logged from each generate (data.creditsCharged).
[]',
 'arcads', 6, datetime('now')),

('ARCADS_VIDEO_FIELDS', 'fn', 'noop', '',
 '# ArcAds /v2/videos/generate field reference.
# model (req): sora2, sora2-pro, veo31, kling-2.6, kling-3.0, grok-video, seedance, seedance-2.0, happy-horse
# productId (req); prompt (req); projectId (opt)
# aspectRatio: 1:1 | 16:9 | 9:16 (grok-video also auto; seedance-2.0 only 9:16|16:9)
# duration (sec): sora2/pro 4/8/12/16/20 · kling-2.6 5/10 · kling-3.0 3-15 · grok-video 1-15 · seedance 4-12 · seedance-2.0 4-15 · veo31 n/a
# resolution: e.g. 720p
# referenceImages[] max: sora2 1, sora2-pro 1, veo31 3, seedance 1, seedance-2.0 9, happy-horse 1 (upload via ARCADS_UPLOAD first; http auto-uploaded by ARCADS_VIDEO_GENERATE)
# referenceVideos[] / referenceAudios[] (seedance-2.0 audios max 3); audioEnabled (seedance-2.0)
# startFrame / endFrame: presigned file paths (veo31, kling-2.6, kling-3.0, seedance)
# nbGenerations 1-10 (sora2/sora2-pro only); enhance bool (+8 credits)
[]',
 'arcads', 100, datetime('now')),

-- Refresh image field reference: add soul model, nbGenerations, projectId, ref maxima, enhance cost.
('ARCADS_FIELDS', 'fn', 'noop', '',
 '# ArcAds /v2/images/generate field reference.
# model (req): gpt-image, gpt-image-2, nano-banana, nano-banana-2, soul, grok_image, seedream, seedream_5_lite
# productId (req); prompt (req); projectId (opt)
# aspectRatio: 1:1 | 16:9 | 9:16
# enhance (bool): Claude-enhances the prompt, +8 credits
# nbGenerations 1-10 (SOUL model only)
# referenceImages[] max: gpt-image 5, gpt-image-2 5, nano-banana 14, nano-banana-2 14, soul 0, grok_image 1, seedream 4, seedream_5_lite 4 (upload via ARCADS_UPLOAD first; http auto-uploaded by ARCADS_GENERATE). First ref = primary product source-of-truth.
# Async: response {id}; poll GET /v1/assets/{id} (status generated + url); GET /v1/assets/{id}/watch.
[]',
 'arcads', 100, datetime('now')),

-- Useful read-only catalogs.
('ARCADS_SITUATIONS', 'http', 'GET https://external-api.arcads.ai/v1/situations?page=1&pageSize=50', 'headers:{"Authorization":"$ARCADS_BASIC_AUTH","Accept":"application/json"}',
 '# List ArcAds situations (templates for actor/video scripts). Paginated.',
 'arcads', 100, datetime('now')),

('ARCADS_ACTORS', 'http', 'GET https://external-api.arcads.ai/v1/actors?page=1&pageSize=50', 'headers:{"Authorization":"$ARCADS_BASIC_AUTH","Accept":"application/json"}',
 '# List ArcAds actors (for talking-actor video). Paginated; filters age/gender/skinTone.',
 'arcads', 100, datetime('now')),

('ARCADS_PRESETS', 'http', 'GET https://external-api.arcads.ai/v1/presets', 'headers:{"Authorization":"$ARCADS_BASIC_AUTH","Accept":"application/json"}',
 '# List ArcAds preset types: camera-movement, fashion-tryon, gestures, product-showcase, showyourapp, unboxing-pov, gameplay-ad.',
 'arcads', 100, datetime('now'));
