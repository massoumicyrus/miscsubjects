#!/bin/zsh
set -euo pipefail
source "${HOME}/.config/grok-bridge.env"
SEC="${1:-12}"
F="/tmp/build-voice-$(date +%s).m4a"
ffmpeg -y -loglevel error -f avfoundation -i ":0" -t "${SEC}" -c:a aac "${F}"
KEY="img/aud/inbound-$(date +%s).m4a"
curl -fsS -X PUT "https://miscsubjects.com/api/r2/${KEY}" \
  -H "x-terminal-key: ${TERMINAL_KEY}" \
  -H "Content-Type: audio/mp4" \
  --data-binary @"${F}" >/dev/null
URL="https://miscsubjects.com/${KEY}"
curl -fsS "https://miscsubjects.com/api/dispatch?invoke=BUILD_VOICE_IN&body=${URL}&terminal_key=${TERMINAL_KEY}" >/dev/null