
-- ── moved to the cloud now: tool present, body carries no Mac path ───────────
UPDATE directory SET execution='cloud_preferred' WHERE key IN ('CLI_JQ','BROWSER_FETCH');

UPDATE directory SET execution='either' WHERE key IN ('BASH','LOCAL_EXEC');

-- ── cloud-capable, image does not carry the tool ─────────────────────────────
UPDATE directory SET execution='cloud_pending:image' WHERE key IN (
  'CLI_PYTHON','CLI_DENO','CLI_PNPM','CLI_RG','CLI_FD','CLI_SQLITE','CLI_HTTPIE',
  'CLI_PANDOC','CLI_TYPST','CLI_GRAPHVIZ','CLI_MAGICK','CLI_FFMPEG','CLI_YT_DLP');

-- ── cloud-capable, row body hard-codes a path on the Mac ─────────────────────
UPDATE directory SET execution='cloud_pending:body' WHERE key IN (
  'CLI_NODE','CLI_NPM','CLI_GIT','CLI_BUN','NPM');

-- ── needs that machine ───────────────────────────────────────────────────────
-- its screen, keyboard, clipboard, speakers, camera, notifications, GUI apps
UPDATE directory SET execution='edge_required' WHERE key IN (
  'DESKTOP_CLICK','DESKTOP_SHOT','DESKTOP_TYPE','EAGLE_IMSG','OPEN_URL',
  'LOCAL_ACTIVATE','LOCAL_AFPLAY','LOCAL_AIRDROP','LOCAL_APPS','LOCAL_BATTERY',
  'LOCAL_CAFFEINATE','LOCAL_CLIPBOARD_GET','LOCAL_CLIPBOARD_SET','LOCAL_DICTATE_TO_PHONE',
  'LOCAL_DOWNLOAD','LOCAL_EDIT','LOCAL_FOCUS','LOCAL_FRONTMOST','LOCAL_GREP','LOCAL_HEALTH',
  'LOCAL_HELP','LOCAL_KEYCODE','LOCAL_KEYSTROKE','LOCAL_LAUNCHD','LOCAL_LIST','LOCAL_NETWORK',
  'LOCAL_NOTIFY','LOCAL_OCR','LOCAL_OPEN','LOCAL_OPEN_APP','LOCAL_OPEN_URL','LOCAL_OSASCRIPT',
  'LOCAL_PASTEBOARD_PUSH_PHONE','LOCAL_PORTS','LOCAL_PS','LOCAL_READ','LOCAL_SAY',
  'LOCAL_SCREENSHOT','LOCAL_SHORTCUTS_LIST','LOCAL_SHORTCUTS_RUN','LOCAL_UI_CLICK',
  'LOCAL_UI_SNAPSHOT','LOCAL_VOICE_RECORD','LOCAL_WINDOWS','LOCAL_WRITE');

-- credentials that live on that Mac: keychain, gh auth, cloud CLI logins, colima
UPDATE directory SET execution='edge_required' WHERE key IN (
  'CLI_CURL_LOCAL','CLI_BREW','CLI_CLASP','CLI_GH','CLI_GH_COPILOT','CLI_AWS','CLI_GCLOUD',
  'CLI_KUBECTL','CLI_TERRAFORM','CLI_WRANGLER','CLI_DOCKER','CLI_PSQL','CLI_OPENAI');

UPDATE directory SET execution='edge_required' WHERE key IN (
  'CLI_AIDER','CLI_CLAUDE_CODE','CLI_CODEX','CLI_GEMINI','CLI_GOOSE','CLI_GROK_SA',
  'CLI_GROK_XAI','CLI_INTERPRETER','CLI_KIMI','CLI_OPENHANDS','CLI_PLANDEX','CLI_SPAWN','CLI_GROUP');

-- the browser lane on the Mac: a real profile with real logged-in sessions.
-- Cloud browser work is a DIFFERENT substrate (Browser Rendering), not this one.
UPDATE directory SET execution='edge_required' WHERE key IN (
  'BROWSER_PLAYWRIGHT','BROWSER_USE','PLAYWRIGHT_START','MCP');
