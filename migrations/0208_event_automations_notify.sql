-- P1.1 event-triggered automations + P1.3 owner-notify primitive.
-- trigger: 'schedule' (fires on every_min elapsed, the default) or 'event:NAME' (fires when
-- AUTOMATE_FIRE is called with that event). This is the "when X happens → do Y" half.
ALTER TABLE automations ADD COLUMN trigger TEXT NOT NULL DEFAULT 'schedule';

INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES
('AUTOMATE_FIRE', 'fn', 'automateFire', '',
'# WHAT: Fire every enabled automation registered for an event (trigger=event:NAME). Any inbound hook (a customer text, an error, a webhook) calls this with the event name + payload; matching automations run and ledger a receipt.
# WHEN_TO_USE: an event source (webhook, hook, cron) signals something happened — "when a customer text arrives", "on error", "on new order".
# ARGS: event_name | payload (payload is passed to each automation whose body is empty)
# EX: [AUTOMATE_FIRE]customer_text|hi, is this still available?[/AUTOMATE_FIRE]
["$1","$2+"]', 'automation', 40, 1, 1, datetime('now')),
('NOTIFY_OWNER', 'fn', 'sendByChannel', '',
'# WHAT: Text the owner (the owner) a message — the "background daemon pings you when it needs a decision" primitive. Automations and event hooks call this to ask a question or report.
# WHEN_TO_USE: the AI needs the owner''s input or wants to surface something — "tell the owner", "ask the owner", "ping me when X".
# ARGS: message
# EX: [NOTIFY_OWNER]A customer asked something I have no automation for — how do you want me to reply?[/NOTIFY_OWNER]
["blooio","[OWNER_PHONE]","$1+"]', 'automation', 30, 1, 1, datetime('now'));
