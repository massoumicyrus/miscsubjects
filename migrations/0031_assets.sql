-- 0031: asset library. Every inbound/generated image is filed here by category so the
-- operator can refer to a fixed set: product vial, current best ad, competitor ad, etc.
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  category TEXT NOT NULL,          -- product_vial | best_ad | competitor_ad | reference | generated
  label TEXT,
  r2_key TEXT,                     -- stored copy in R2 (img/...)
  url TEXT,                        -- https://miscsubjects.com/img/...
  source_url TEXT,                 -- original inbound URL (e.g. bucket.blooio.com/...)
  engine TEXT,                     -- openai | grok | null
  prompt TEXT,
  sender TEXT,                     -- who sent it
  chat TEXT,                       -- chat/group id it came from
  protocol TEXT,                   -- imessage | whatsapp | ...
  is_group INTEGER DEFAULT 0,
  parent_id TEXT,                  -- generated assets point back to the source asset
  notes TEXT
);
CREATE INDEX IF NOT EXISTS assets_cat_idx ON assets(category, created_at);
CREATE INDEX IF NOT EXISTS assets_chat_idx ON assets(chat, created_at);

-- Send a message WITH images via Blooio (media array). Args: chat|text|media_url.
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES ('SEND_IMAGE_BLOOIO', 'http', 'POST https://backend.blooio.com/v2/api/chats/$1/messages', 'bearer:BLOOIO_API_KEY',
 '# Send a message with an image to a Blooio chat (phone or group id). Args: chat|text|media_url.
{"text":"$2","media":["$3"]}',
 'blooio', 100, datetime('now'));
