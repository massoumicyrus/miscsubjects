INSERT OR IGNORE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'BUILD_VOICE_IN',
  'fn',
  'buildVoiceIn',
  '',
  '# WHAT: Mac/iOS voice URL → STT → Grok Build → ara reply (not ROUTER).
# WHEN_TO_USE: build_voice action on /api/phone/in, or Mac hotkey after R2 upload
# ARGS: public audio URL
# EX: [BUILD_VOICE_IN]https://miscsubjects.com/img/aud/foo.m4a[/BUILD_VOICE_IN]
["$1"]',
  'voice',
  50,
  1,
  1,
  datetime('now')
);