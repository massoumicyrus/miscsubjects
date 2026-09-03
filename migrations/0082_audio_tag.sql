
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
