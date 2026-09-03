-- 0030: OpenAI image surface + dual-engine (OpenAI + Grok Imagine) generation.

INSERT OR REPLACE INTO directory
 (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES

('OPENAI_IMAGE', 'fn', 'openaiImage', '',
 '# OpenAI gpt-image-1.5 text-to-image. Stores to R2, returns a stable https://miscsubjects.com/img/ link. Args: prompt|size(1024x1024|1536x1024|1024x1536).
["$1","$2"]',
 'openai', 100, datetime('now')),

('OPENAI_IMAGE_EDIT', 'fn', 'openaiImageEdit', '',
 '# OpenAI gpt-image-1.5 edit from a reference image URL. Stores to R2. Args: prompt|reference_url|size.
["$1","$2","$3"]',
 'openai', 100, datetime('now')),

('STORE_REF_IMAGE', 'fn', 'storeRefImage', '',
 '# Save a reference image (e.g. one sent via Blooio) to R2 and return {filename,key,url}. Arg: source_url.
["$1"]',
 'openai', 100, datetime('now')),

('GEN_DUAL', 'fn', 'genDual', '',
 '# Generate with BOTH OpenAI gpt-image-1.5 and Grok Imagine; store both to R2; return both links. If reference_url is given, both EDIT it. Args: prompt|reference_url.
["$1","$2"]',
 'openai', 6, datetime('now')),

('OPENAI_MODELS', 'http', 'GET https://api.openai.com/v1/models', 'bearer:OPENAI_API_KEY',
 '# List OpenAI models. No args.',
 'openai', 100, datetime('now')),

('SEND_IMAGE_BLOOIO', 'http', 'POST https://backend.blooio.com/v2/api/chats/$1/messages', 'bearer:BLOOIO_API_KEY',
 '# Send a message (e.g. image links) to a phone via Blooio. Args: phone|text.
{"text":"$2"}',
 'blooio', 100, datetime('now'));
