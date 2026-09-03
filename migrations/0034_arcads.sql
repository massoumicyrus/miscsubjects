-- 0034: ArcAds (external-api.arcads.ai) image surface. Auth = ARCADS_BASIC_AUTH (full
-- "Basic <b64>" header). 7 image models. Flow: generate -> poll asset -> watch final.

INSERT OR REPLACE INTO directory
 (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES

('ARCADS_PRODUCTS', 'http', 'GET https://external-api.arcads.ai/v1/products?page=1&pageSize=50', 'headers:{"Authorization":"$ARCADS_BASIC_AUTH","Accept":"application/json"}',
 '# List ArcAds products (each has an id used as productId in image generation). No args. Loop product id = acbf46ed-c1b0-4858-8690-6cccaa082774.',
 'arcads', 6, datetime('now')),

('ARCADS_GENERATE', 'fn', 'arcadsGenerate', '',
 '# Generate an ad image via ArcAds, poll to completion, store to R2, return a stable link. Args: model|prompt|aspectRatio|referenceImages|productId|enhance.
# model: nano-banana | nano-banana-2 | gpt-image | gpt-image-2 | grok_image | seedream | seedream_5_lite
# aspectRatio: 9:16 | 1:1 | 16:9 | 4:5 | 2:3 | 3:2
# referenceImages: comma-separated external-api-temp-uploads/<uuid>.png OR drive://<fileId> OR https URLs (first = primary product reference)
# productId: blank = Loop product. enhance: true|false.
["$1","$2","$3","$4","$5","$6"]',
 'arcads', 6, datetime('now')),

('ARCADS_IMAGE_RAW', 'http', 'POST https://external-api.arcads.ai/v2/images/generate', 'headers:{"Authorization":"$ARCADS_BASIC_AUTH","Accept":"application/json","Content-Type":"application/json"}',
 '# Raw ArcAds generate (returns {id}; does not poll). Pass the full JSON body as $1 for total field control: {model,productId,prompt,aspectRatio,referenceImages[],enhance}.
$1',
 'arcads', 100, datetime('now')),

('ARCADS_ASSET_GET', 'http', 'GET https://external-api.arcads.ai/v1/assets/$1', 'headers:{"Authorization":"$ARCADS_BASIC_AUTH","Accept":"application/json"}',
 '# Poll an ArcAds asset by id. Arg: asset_id. Returns status + url when ready.',
 'arcads', 100, datetime('now')),

('ARCADS_ASSET_WATCH', 'http', 'GET https://external-api.arcads.ai/v1/assets/$1/watch', 'headers:{"Authorization":"$ARCADS_BASIC_AUTH","Accept":"application/json"}',
 '# Final/watch endpoint for an ArcAds asset. Arg: asset_id.',
 'arcads', 100, datetime('now')),

-- Field reference: every controllable field + allowed values, kept as a callable doc row.
('ARCADS_FIELDS', 'fn', 'noop', '',
 '# ArcAds /v2/images/generate field reference.
# model (string): nano-banana, nano-banana-2, gpt-image, gpt-image-2, grok_image, seedream, seedream_5_lite
# productId (string, required): ArcAds product id. Loop = acbf46ed-c1b0-4858-8690-6cccaa082774. List via ARCADS_PRODUCTS.
# prompt (string, required): full creative prompt. First reference image is treated as primary product source-of-truth.
# aspectRatio (string): 9:16 (default ads), 1:1, 16:9, 4:5, 2:3, 3:2
# referenceImages (string[]): each item is external-api-temp-uploads/<uuid>.png (uploaded), drive://<fileId>, or an https URL. First = primary product reference; rest = creative inspiration.
# enhance (bool): true | false
# Async result: response {id}; poll GET /v1/assets/{id} for status+url; GET /v1/assets/{id}/watch for final.
# outputFolderId (string, optional): Drive folder id to deposit the asset.
["$1"]',
 'arcads', 100, datetime('now'));
