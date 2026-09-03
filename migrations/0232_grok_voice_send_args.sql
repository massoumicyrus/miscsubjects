-- GROK_VOICE_SEND: fn arg template was missing ["$1","$2","$3"] → text reached x.ai empty.
UPDATE directory SET content = '# WHAT: Grok TTS ara voice into Blooio chat. INVOKE: [GROK_VOICE_SEND]<chat>|<words>|<voice_id>[/GROK_VOICE_SEND]
# WHEN_TO_USE: audio mode — speak into the owner iMessage via x.ai ara
# ARGS: chat|text|voice_id (default ara). chat = E.164 phone ([OWNER_PHONE]) or chat_* id
# EX: [GROK_VOICE_SEND][OWNER_PHONE]|hey the owner|ara[/GROK_VOICE_SEND]
["$1","$2","$3"]', updated_at = datetime('now') WHERE key = 'GROK_VOICE_SEND';