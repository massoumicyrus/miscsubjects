-- Self-explaining fix: the discovery layer was surfacing capabilities with placeholder
-- examples (arg1|arg2|arg3) so a model could not learn how to actually call them.
-- Give the rows a model reaches for real, copy-pasteable examples + canonical guidance.

-- Texting: SEND_BY_CHANNEL is THE way to text the owner. BLOOIO_SEND_MESSAGE is the wrong door
-- (it needs a channel_id) and kept getting grabbed first.
UPDATE directory SET content =
'# WHAT: Text the owner (or anyone) — the ONE way to send a message. $1=channel (use "blooio" to text the owner), $2=recipient ([OWNER_PHONE] is the owner), $3=the message text.
# WHEN_TO_USE: ANY "text me / send a text / message the owner / notify me / sms / dm me" request. This is the canonical texting row. Do NOT use BLOOIO_SEND_MESSAGE for this.
# ARGS: channel | recipient | text   (pipe-delimited, exactly three)
# EX: [SEND_BY_CHANNEL]blooio|[OWNER_PHONE]|Woof woof.[/SEND_BY_CHANNEL]
["$1","$2","$3"]', updated_at = datetime('now') WHERE key = 'SEND_BY_CHANNEL';

UPDATE directory SET content =
'# WHAT: Low-level Blooio send. ADVANCED — needs a channel_id (ch_..., from list_channels) plus to/text.
# WHEN_TO_USE: only when you ALREADY have a channel_id. To just text the owner, use SEND_BY_CHANNEL instead.
# ARGS: full MCP args (channel_id required)
# EX: to text the owner use SEND_BY_CHANNEL — [SEND_BY_CHANNEL]blooio|[OWNER_PHONE]|hi[/SEND_BY_CHANNEL]
# MCP: https://mcp.blooio.com/v4
["https://mcp.blooio.com/v4","send_message","$1+","BLOOIO_API_KEY_PEPPERUP"]', updated_at = datetime('now') WHERE key = 'BLOOIO_SEND_MESSAGE';

UPDATE directory SET content =
'# WHAT: Generate an image from a text prompt. Returns a JSON url (grok-imagine-image-quality, $0.05/image).
# WHEN_TO_USE: any "make/generate/create an image, picture, photo, or art" request. The whole body is the prompt.
# ARGS: prompt (free text)
# EX: [GROK_IMAGE]a golden retriever in an astronaut suit, studio lighting[/GROK_IMAGE]
{"model":"grok-imagine-image-quality","prompt":"$1"}', updated_at = datetime('now') WHERE key = 'GROK_IMAGE';

-- ARTICLES is a target_map row with a good docstring; only its EX line is a placeholder.
UPDATE directory SET content = REPLACE(content, '# EX: [ARTICLES][/ARTICLES]', '# EX: [ARTICLES]list[/ARTICLES]'), updated_at = datetime('now') WHERE key = 'ARTICLES';
