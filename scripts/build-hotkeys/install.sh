#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
BIN="${HOME}/bin"
mkdir -p "${BIN}"
install -m 755 "${ROOT}/build-talk.sh" "${BIN}/build-talk"
install -m 755 "${ROOT}/build-messages.sh" "${BIN}/build-messages"
cat > "${HOME}/.skhdrc" <<'EOF'
# Flycut owns Command+Shift+V — never bind that here.
# Command+Shift+A — talk to Grok Build (12s mic, any app, browser OK)
cmd + shift - a : /Users/owner/bin/build-talk
# Command+Shift+M — jump iMessage thread
cmd + shift - m : /Users/owner/bin/build-messages
EOF
if ! command -v skhd >/dev/null 2>&1; then
  brew install koekeishiya/formulae/skhd
fi
skhd --stop-service 2>/dev/null || true
skhd --start-service
echo "Installed: Command+Shift+A = talk to Build, Command+Shift+M = Messages"
echo "Scripts: ${BIN}/build-talk, ${BIN}/build-messages"