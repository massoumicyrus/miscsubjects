-- 0036: docs store + conversational ARCADS_AGENT + Blooio chat-mode support.
CREATE TABLE IF NOT EXISTS docs (slug TEXT PRIMARY KEY, title TEXT, body TEXT NOT NULL, updated_at TEXT NOT NULL);
INSERT OR REPLACE INTO docs (slug,title,body,updated_at) VALUES ('arcads','ArcAds API reference','ARCADS API — reference for the ArcAds agent.

BASE: https://external-api.arcads.ai   AUTH: Basic (env ARCADS_BASIC_AUTH).
Product "Loop" id = acbf46ed-c1b0-4858-8690-6cccaa082774 (default productId).
CREDITS: 80,440 / month. Each generation charges data.creditsCharged. enhance=+8 credits. Check with [ARCADS_CREDITS].

IMAGE — POST /v2/images/generate (async: returns {id}; poll /v1/assets/{id} until status "generated" + url; ~30s).
  image models: gpt-image, gpt-image-2, nano-banana, nano-banana-2, soul, grok_image, seedream, seedream_5_lite
  fields:
    model (required), productId (required), prompt (required), aspectRatio (1:1 | 16:9 | 9:16),
    enhance (bool, Claude-enhances prompt, +8 credits),
    nbGenerations 1-10 (SOUL only),
    projectId (optional),
    referenceImages[] (S3 file paths from upload; first = primary product source-of-truth).
  referenceImages MAX per model: gpt-image 5, gpt-image-2 5, nano-banana 14, nano-banana-2 14, soul 0, grok_image 1, seedream 4, seedream_5_lite 4.

VIDEO — POST /v2/videos/generate (async, same poll).
  video models: sora2, sora2-pro, veo31, kling-2.6, kling-3.0, grok-video, seedance, seedance-2.0, happy-horse
  fields:
    model (required), productId (required), prompt (required), aspectRatio, duration, resolution (480p|720p; grok-video REQUIRES it),
    referenceImages[], referenceVideos[], referenceAudios[] (seedance-2.0, max 3), audioEnabled (seedance-2.0),
    startFrame, endFrame (presigned paths; veo31/kling-2.6/kling-3.0/seedance), nbGenerations 1-10 (sora2/sora2-pro only), enhance, projectId.
  aspectRatio: 1:1 | 16:9 | 9:16 (grok-video also ''auto''; seedance-2.0 only 9:16|16:9).
  duration (sec): sora2/pro 4/8/12/16/20 ; kling-2.6 5/10 ; kling-3.0 3-15 ; grok-video 1-15 ; seedance 4-12 ; seedance-2.0 4-15 ; veo31 n/a.
  referenceImages MAX: sora2 1, sora2-pro 1, veo31 3, seedance 1, seedance-2.0 9, happy-horse 1.

PROMPT LENGTH: ArcAds does not document a hard max on the prompt field; ArcAds'' own example prompts run several hundred to ~1,000 words. Upstream image-model limits: OpenAI gpt-image ~32,000 chars, dall-e-3 ~4,000. Practical guidance: detailed but focused, generally under ~1,500 words. There is no published hard cap — do not claim a specific number as a limit.

REFERENCE IMAGES (how to remake a competitor ad): the user must send their PRODUCT photo. Upload it once with [ARCADS_UPLOAD]<image_url>|image/png[/ARCADS_UPLOAD] -> returns a filePath (external-api-temp-uploads/<id>). Use that filePath as the FIRST item in referenceImages (primary product source-of-truth); add the competitor ad as a second reference for style. http(s) reference URLs passed to [ARCADS_GENERATE]/[ARCADS_VIDEO_GENERATE] are auto-uploaded.

UPLOAD: POST /v1/file-upload/get-presigned-url {fileType} -> {presignedUrl, filePath, fileId}; then S3 PUT the bytes; pass filePath in referenceImages. fileType enum: image/jpeg, image/png, image/webp, image/heic, video/mp4, video/quicktime, audio/mp3, audio/wav, application/pdf, text/plain, text/csv, ...

PRESETS: /v1/presets types = camera-movement, fashion-tryon, gestures, product-showcase, showyourapp, unboxing-pov, gameplay-ad.
ACTORS/SITUATIONS/SCRIPTS: talking-actor video pipeline (/v1/actors, /v1/situations, /v1/scripts -> /v1/scripts/{id}/generate -> /v1/scripts/{id}/videos). Not yet wired as tools; ask if needed.

OTHER PROVIDERS the build can also use (not ArcAds):
  GROK_IMAGE (xAI grok-imagine-image-quality, text->image), GROK_IMAGE_EDIT (with reference), GROK_VIDEO_START/GROK_VIDEO_GET (xAI grok-imagine-video, async).
  OPENAI_IMAGE / OPENAI_IMAGE_EDIT (gpt-image-1.5). GEN_DUAL (OpenAI + Grok at once).
',datetime('now'));
INSERT OR REPLACE INTO docs (slug,title,body,updated_at) VALUES ('build-intent','How the owner wants the build to behave','HOW the owner WANTS THE BUILD TO BEHAVE (stored verbatim intent).

He wants to text the Blooio number and converse with an agent that understands him the same way Claude would if Claude had the API documentation in context and could converse. Specifically the ArcAds agent must:
- Know what image models and video models are available, and the prompt field limits.
- Know it needs reference images of HIS product if he wants it to remake a competitor ad — and ask him for them.
- Know how to refer to the documentation (stored in the build) to answer his literal questions.
- Let him enter a direct conversation with the ArcAds agent (by texting e.g. "arcads") and keep talking until he ends it.
- Take images from him, send images/videos back (not links, not router status lines), and iterate on prompts based on what it returns to get what he wants.
- Understand that emitting a tool tag routes to that provider/tool: e.g. one tag -> GPT image, another -> Grok image, another -> ArcAds image/video. It is Grok 4.3; it should reason about which tool fits and what fields the API call can include, and look up raw docs when asked.
- NOT behave like a JS router ("GPT IMAGE RECEIVED, RETURN FILE XYZ.PNG CREDITS USED 2"). Converse like a capable peer.
',datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,updated_at) VALUES
('DOCS_GET','fn','docsGet','','# Read a stored doc by slug (full body). Arg: slug (arcads | build-intent).
["$1"]','docs',6,datetime('now')),
('DOCS_SEARCH','fn','docsSearch','','# Search stored docs. Arg: query. Returns slugs + snippets.
["$1"]','docs',100,datetime('now'));
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,planner_rank,updated_at) VALUES ('ARCADS_AGENT','agent','grok-4.3','bearer:GROK_API_KEY','You are the ArcAds creative agent for the owner, running on Grok 4.3, talking to him over text message. You make ad images and videos and help him iterate to get what he wants. Converse like a sharp, fast creative partner — plain, brief, human. Never output router-style status lines.

THE USER ONLY SEES TEXT INSIDE [REPLY]...[/REPLY]. Everything else (tool tags, results, your reasoning) is invisible to him. Always talk to him via [REPLY]. End a turn that needs no tool with [DONE]<reason>[/DONE].

What you can do — emit a tag to call it (the result comes back to you; generated files are sent to him automatically):
- [ARCADS_GENERATE]model|prompt|aspectRatio|referenceImages|productId|enhance[/ARCADS_GENERATE] — ArcAds image. referenceImages = comma-separated URLs (his product photo first). Leave productId blank for the Loop product.
- [ARCADS_VIDEO_GENERATE]model|prompt|aspectRatio|referenceImages|duration|productId|resolution[/ARCADS_VIDEO_GENERATE] — ArcAds video.
- [ARCADS_UPLOAD]image_url|image/png[/ARCADS_UPLOAD] — store a reference image, returns its ArcAds filePath.
- [ARCADS_CREDITS][/ARCADS_CREDITS] — credits left this month. [ARCADS_PRODUCTS][/ARCADS_PRODUCTS] — product ids.
- [GROK_IMAGE]prompt[/GROK_IMAGE], [OPENAI_IMAGE]prompt[/OPENAI_IMAGE], [GEN_DUAL]prompt|reference_url[/GEN_DUAL] — other image engines.
- [DOCS_GET]arcads[/DOCS_GET] — read the full ArcAds API docs when he asks something specific you are not certain about. Answer from the docs, not from guesses.

Image models: gpt-image, gpt-image-2, nano-banana, nano-banana-2, soul, grok_image, seedream, seedream_5_lite. Default to nano-banana for ad remakes.
Video models: sora2, sora2-pro, veo31, kling-2.6, kling-3.0, grok-video, seedance, seedance-2.0, happy-horse. grok-video needs resolution 720p.

To remake a competitor ad you NEED his product photo. If he has not sent one, ask for it before generating. When he sends images, their URLs appear in the message; treat the first as his product unless he says otherwise, and pass it as the first referenceImages entry.

Credits: 80,440 per month; each image is ~24 credits, enhance adds 8, video more. When you make something, mention briefly what it cost. If he asks "how many left", call [ARCADS_CREDITS].

Prompt length: there is no published hard maximum on the ArcAds prompt field; keep prompts detailed but focused (a few hundred words is plenty). Do not invent a numeric limit.

Style: when you generate, the file goes to him automatically — in [REPLY] just say what you made (model, 1-line of the idea), note credits, and ask what to tweak. Then adjust the prompt on his feedback and regenerate. Ask clarifying questions when the brief is thin.

Available tools right now:
{{TOOLS:cat=arcads}}','llm','arcads,grok,openai,docs,asset',6,datetime('now'));
