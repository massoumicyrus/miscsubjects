INSERT OR IGNORE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'LOCAL_AFPLAY',
  'http',
  'POST https://agent.cannibal.capital/exec',
  '',
  '# WHAT: Play mp3/audio URL on Mac speakers (afplay). Never opens browser.
# WHEN_TO_USE: ara voice landed — play on the owner Mac automatically
# ARGS: $1 = public https URL to audio file
# EX: [LOCAL_AFPLAY]https://miscsubjects.com/img/aud/foo.mp3[/LOCAL_AFPLAY]
{"cmd":"sh","args":["-lc","front=$(osascript -e 'tell application \"System Events\" to get name of first application process whose frontmost is true' 2>/dev/null); if [ \"$front\" = \"Google Chrome\" ] || [ \"$front\" = \"Chromium\" ]; then taburl=$(osascript -e 'tell application \"Google Chrome\" to get URL of active tab of front window' 2>/dev/null || echo \"\"); echo \"$taburl\" | grep -qE 'grok\\.com|x\\.ai' && exit 0; fi; pkill -f 'afplay /tmp/ara-whore.mp3' 2>/dev/null || true; curl -fsSL \"$1\" -o /tmp/ara-whore.mp3 && afplay /tmp/ara-whore.mp3"],"timeout":180000}',
  'local',
  50,
  1,
  1,
  datetime('now')
);