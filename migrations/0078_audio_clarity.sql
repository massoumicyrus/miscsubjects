-- 0078: Grok audio tools — make invocation unambiguous; kill the phantom "READ" tool.
-- No real-time speech anywhere. STT/TTS in and out are spelled out per-row: exact tag,
-- exact args, exact return, exact when_to_use.

-- GROK_STT was dispatched by functions/blooio.js but NO migration ever created the row,
-- so the audio-IN path resolved to ERR:dispatch:unknown_key:GROK_STT. Create it explicitly.
INSERT OR REPLACE INTO directory
  (key, type, target, auth, content, category, allowed_categories, seq, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'GROK_STT',
  'fn',
  'grokStt',
  '',
  '# Speech-to-TEXT (Grok). INVOKE: [GROK_STT]<public_audio_url>[/GROK_STT]
# $1 = a public https URL to an audio file (mp3|m4a|aac|wav|ogg|flac|webm). Returns the transcript text.
# Mechanism: POSTs the audio bytes as multipart/form-data to https://api.x.ai/v1/stt (Bearer GROK_API_KEY).
# when_to_use: an inbound Blooio voice message — transcribe it, then route the transcript. READ move: emit the tag ALONE, the transcript returns next turn.
["$1"]',
  'grok', '*', 100, 1, 1, 100, datetime('now')
);

-- GROK_TTS already exists (0025). Rewrite the doc so the invocation is unambiguous.
UPDATE directory SET content =
  '# Text-to-SPEECH (Grok). INVOKE: [GROK_TTS]<text>|<voice_id>[/GROK_TTS]
# $1 = the words to speak; $2 = voice_id (eve|ara|rex|sal|leo). Returns mp3 audio BYTES (binary, not JSON) from https://api.x.ai/v1/tts; ~$15 per 1M characters.
# To DELIVER spoken audio into a chat in ONE call, use [VOICE_SEND] instead (it synthesizes + attaches).
{"text":"$1","voice_id":"$2","language":"en"}',
  updated_at = datetime('now')
WHERE key = 'GROK_TTS';

-- VOICE_SEND: the recommended audio-out path (synthesize + post in one call).
UPDATE directory SET content =
  '# Speak a reply INTO a chat (recommended audio-out). INVOKE: [VOICE_SEND]<chat>|<words to speak>|<voice>[/VOICE_SEND]
# $1 = chat id (from the [channel ...] header); $2 = the words to speak; $3 = voice (optional, default alloy).
# One call: synthesizes an mp3 and posts it to the Blooio chat as an attachment. ACTION. Pair with a short [REPLY] text fallback.
["$1","$2","$3"]',
  updated_at = datetime('now')
WHERE key = 'VOICE_SEND';

-- VOICE_SAY: make an audio file, return its URL (does NOT send).
UPDATE directory SET content =
  '# Make a spoken-audio FILE and return its public URL (does NOT send it). INVOKE: [VOICE_SAY]<text>|<voice>[/VOICE_SAY]
# $1 = words; $2 = voice (default alloy). Returns {engine,url,filename}. To send audio to a chat in one step, use [VOICE_SEND].
["$1","$2"]',
  updated_at = datetime('now')
WHERE key = 'VOICE_SAY';

-- VOICE_TRANSCRIBE: inbound audio -> text (OpenAI whisper-1 path; Grok STT is [GROK_STT]).
UPDATE directory SET content =
  '# Transcribe inbound audio to TEXT (OpenAI whisper-1). INVOKE: [VOICE_TRANSCRIBE]<public_audio_url>[/VOICE_TRANSCRIBE]
# $1 = public https URL of the audio. Returns the transcript text. READ move: emit ALONE, result returns next turn. (For Grok STT instead, use [GROK_STT].)
["$1"]',
  updated_at = datetime('now')
WHERE key = 'VOICE_TRANSCRIBE';

-- Kill the phantom "READ" tool inside the VOICE agent prompt (V4a). There is no tool
-- named READ — name the actual data tool to emit. Surgical REPLACE: no-op if absent.
UPDATE directory SET content = REPLACE(content,
  'V4a: WHEN voice-only request that needs data → emit READ tool first (per S5b), wait, then [VOICE_SEND] next turn with the result.',
  'V4a: WHEN a voice request needs data first → emit the SPECIFIC data tool that holds the answer (e.g. [BLOOIO]list_messages|<chat>|<n>[/BLOOIO] to read messages, [DOCS_GET]<slug>[/DOCS_GET] to read a doc) ALONE this turn, wait for its result, then NEXT turn emit [VOICE_SEND] with the answer. There is no tool named READ; always name the real tool.'),
  updated_at = datetime('now')
WHERE key = 'VOICE';
