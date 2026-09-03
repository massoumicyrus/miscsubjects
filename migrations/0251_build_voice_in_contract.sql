INSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'BUILD_VOICE_IN',
  'fn',
  'buildVoiceIn',
  '',
  '# WHAT: Mac/iOS voice URL -> STT -> Grok Build -> ara voice reply plus same-word carbon-copy text (not ROUTER).
# WHEN_TO_USE: build_voice action on /api/phone/in, or Mac hotkey after R2 upload.
# ARGS: public audio URL
# RETURNS: JSON with audio_url plus carbon_copy result; voice-only is incomplete.
# EX: [BUILD_VOICE_IN]https://miscsubjects.com/img/aud/foo.m4a[/BUILD_VOICE_IN]
["$1"]',
  'voice',
  50,
  1,
  1,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type = excluded.type,
  target = excluded.target,
  auth = excluded.auth,
  content = excluded.content,
  category = excluded.category,
  planner_rank = excluded.planner_rank,
  planner_visible = excluded.planner_visible,
  enabled = excluded.enabled,
  updated_at = excluded.updated_at;
