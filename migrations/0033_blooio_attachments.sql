-- 0033: Blooio sends images via `attachments` (array of URLs), not `media`. Fix SEND_IMAGE_BLOOIO.
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, updated_at)
VALUES ('SEND_IMAGE_BLOOIO', 'http', 'POST https://backend.blooio.com/v2/api/chats/$1/messages', 'bearer:BLOOIO_API_KEY',
 '# Send a message with an image to a Blooio chat (phone or group id). Args: chat|text|attachment_url.
{"text":"$2","attachments":["$3"]}',
 'blooio', 100, datetime('now'));
