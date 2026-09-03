-- 0082: the one audio tag the owner asked for — [AUDIO]words[/AUDIO].
-- Words between the tags are spoken aloud and sent to the chat as an audio message.
-- No second arg required, no text message sent alongside. In a conversation the chat is
-- supplied by the Blooio delivery layer (functions/blooio.js, which treats [AUDIO] like
-- [REPLY]); over REST pass an optional 2nd arg = chat id to actually send, else it
-- returns the mp3 url. Backed by FN_MAP.audioSpeak in functions/api/dispatch.js.

INSERT OR REPLACE INTO directory
  (key, type, target, auth, content, category, allowed_categories, seq, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'AUDIO',
  'fn',
  'audioSpeak',
  '',
  '# Speak words aloud. INVOKE: [AUDIO]the words to speak[/AUDIO]
# $1 = the words to speak. Everything between the tags is spoken and sent to THIS chat as an audio message. No other args needed. No text message is sent alongside the audio.
# In a conversation the audio just arrives in the chat. Over REST, pass an optional 2nd arg = chat id to send it; with no chat it returns {audio_url}.
# Returns {audio_url} (plus sent_to + blooio_status when a chat is given).
["$1","$2"]',
  'voice', '*', 100, 1, 1, 60, datetime('now')
);
