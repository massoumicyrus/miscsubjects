-- 0339: inbound replies. Owner plan item 1, 2026-07-30.
--
-- Cause: 58 letters sent, 39 opened, 180 clicks, and zero replies anywhere in the database.
-- build@ routed to a worker with no email handler and loop@ (the reply-to actually printed in
-- every letter) forwarded only to a personal inbox, so the build could not see a single answer.
-- Every statement about outreach quality was unfalsifiable, including the ones a model made
-- about its own drafts.
--
-- A reply is stored whole, classified, and linked to the exact send it answers. A bounce and an
-- out-of-office are recorded as what they are and never counted as a human answering.

CREATE TABLE IF NOT EXISTS lead_replies (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at  TEXT NOT NULL,
  from_email   TEXT NOT NULL,
  to_email     TEXT,
  subject      TEXT,
  kind         TEXT NOT NULL DEFAULT 'reply',   -- reply | auto | bounce | bulk
  reply_text   TEXT,                            -- what they typed, above the quoted thread
  full_text    TEXT,                            -- the whole first text part, quotes included
  message_id   TEXT,
  in_reply_to  TEXT,
  lead_id      INTEGER,                         -- null when the sender matches no lead
  send_id      TEXT,                            -- email_sends.id this answers, when matched
  raw_bytes    INTEGER,
  status       TEXT NOT NULL DEFAULT 'new',     -- new | read | answered | ignored
  owner_note   TEXT,
  answered_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_replies_lead ON lead_replies(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_replies_kind_ts ON lead_replies(kind, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_replies_from ON lead_replies(from_email);

INSERT INTO laws (key, level, category, rule, rationale, binding_on, added_by, added_at, enabled)
VALUES (
  'REPLY_CIRCUIT_LAW',
  'immutable',
  'outreach',
  'Every address the build sends from routes inbound mail into the build itself and is recorded in lead_replies before it is forwarded anywhere. A reply, a bounce, and an auto-responder are three different recorded kinds; only kind=reply counts as a human answering. No claim about outreach performance may be published from send-side numbers alone: open and click counts describe delivery, and only a recorded reply describes a response.',
  'On 2026-07-30 the build had sent 58 letters, observed 39 opens and 180 clicks, and held zero reply records: build@ pointed at a worker with no email handler and loop@ forwarded to a personal inbox only. Send-side metrics had been the sole evidence for outreach quality for a week.',
  '["all"]',
  'owner',
  '2026-07-30T00:00:00.000Z',
  1
)
ON CONFLICT(key) DO UPDATE SET rule=excluded.rule, rationale=excluded.rationale, enabled=1;
