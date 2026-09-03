#!/usr/bin/env bash
# Paste prompt file into frontmost Terminal and press Return.
# Usage: hooks/terminal-paste-send.sh /path/to/prompt.txt [startup_delay_sec]
set -euo pipefail

PROMPT_FILE="${1:?prompt file}"
DELAY="${2:-5}"
PROMPT_POSIX="$(printf '%s' "$PROMPT_FILE" | sed 's/\\/\\\\/g; s/"/\\"/g')"

printf '%s' "$(cat "$PROMPT_FILE")" | pbcopy 2>/dev/null || true

osascript \
  -e 'tell application "Terminal" to activate' \
  -e "delay $DELAY" \
  -e "set promptText to (read (POSIX file \"$PROMPT_POSIX\") as text)" \
  -e 'set the clipboard to promptText' \
  -e 'tell application "System Events" to tell process "Terminal" to keystroke "v" using command down' \
  -e 'delay 0.35' \
  -e 'tell application "System Events" to tell process "Terminal" to key code 36' \
  >/dev/null 2>&1 && exit 0

# Fallback: clipboard only (Accessibility blocked)
echo "terminal-paste-send: pasted to clipboard only (grant Accessibility for auto-Return)" >&2
exit 0