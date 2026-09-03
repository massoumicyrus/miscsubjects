-- 0043: durable delivery for renders that outlive a single invocation window,
-- and fix ARCADS tag-arg format (positional values, never field names).

CREATE TABLE IF NOT EXISTS pending_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_id TEXT NOT NULL,       -- ArcAds asset id
  kind TEXT DEFAULT 'image',    -- image | video
  model TEXT,
  chat TEXT NOT NULL,           -- where to deliver
  channel TEXT DEFAULT 'blooio',-- blooio | 2chat
  trace_id TEXT,
  status TEXT DEFAULT 'pending',-- pending | delivered | failed
  attempts INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS pending_deliveries_status_idx ON pending_deliveries(status);

-- ARCADS emitted key|value style args (model|nano-banana|prompt|...) — the kernel splits
-- positionally on |. Replace the signature lines with worked positional examples.
UPDATE directory SET content = replace(content,
'- [ARCADS_GENERATE]model|prompt|aspectRatio|referenceImages|productId|enhance[/ARCADS_GENERATE]  (referenceImages = comma URLs, product first; blank productId = Loop)
- [ARCADS_VIDEO_GENERATE]model|prompt|aspectRatio|referenceImages|duration|productId|resolution[/ARCADS_VIDEO_GENERATE]  (grok-video needs resolution 720p)',
'- ARGS ARE POSITIONAL, SPLIT ON | — write VALUES ONLY in order, NEVER field names, and never use | inside a prompt (use commas). Leave a position empty to skip it.
- [ARCADS_GENERATE]nano-banana|elegant gold vial on white marble, headline "Higher Quality", soft studio light|9:16|||[/ARCADS_GENERATE]   ← model|prompt|aspectRatio|referenceImages|productId|enhance (referenceImages = comma URLs, product first; blank productId = Loop)
- [ARCADS_VIDEO_GENERATE]grok-video|slow pan across the gold vial on marble|9:16||5||720p[/ARCADS_VIDEO_GENERATE]   ← model|prompt|aspectRatio|referenceImages|duration|productId|resolution (grok-video needs resolution 720p)'),
updated_at = datetime('now') WHERE key='ARCADS';

-- Generation is delivered asynchronously now: the fn starts the render and returns
-- {arcads_id, status:pending}; the build delivers the file to the chat when it is ready.
UPDATE directory SET content = content || '

DELIVERY IS ASYNC: when a generate tool returns status pending with an arcads_id, the render started fine — the build watches it and texts him the file automatically when it is ready (usually under a minute). Phrase your [REPLY] accordingly ("rendering now — landing in a minute") and never call the result failed just because it is pending.',
updated_at = datetime('now') WHERE key='ARCADS';
