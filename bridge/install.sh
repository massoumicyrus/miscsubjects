#!/bin/bash

set -euo pipefail

REPO="${HOME}/miscsubjects-pages"
BRIDGE="${REPO}/bridge"
ENV_FILE="${HOME}/.config/grok-bridge.env"
LAUNCHD="${HOME}/Library/LaunchAgents"
PROJECT="miscsubjects-miscsubjects"

cd "$BRIDGE"

echo "[install] 1/7 npm install"
npm install --no-audit --no-fund

echo "[install] 2/7 secret + env file"
mkdir -p "$(dirname "$ENV_FILE")"
if [ ! -f "$ENV_FILE" ]; then
  cp .env.example "$ENV_FILE"
fi
if grep -q "replace-with-32-byte-hex-from-openssl-rand" "$ENV_FILE"; then
  KEY="$(openssl rand -hex 32)"
  /usr/bin/sed -i '' "s|replace-with-32-byte-hex-from-openssl-rand|${KEY}|" "$ENV_FILE"
  echo "[install]     generated new TERMINAL_KEY"
else
  KEY="$(grep '^TERMINAL_KEY=' "$ENV_FILE" | cut -d= -f2-)"
  echo "[install]     reusing existing TERMINAL_KEY"
fi
chmod 600 "$ENV_FILE"

echo "[install] 3/7 mirror TERMINAL_KEY to miscsubjects as a Pages secret"
(cd "$REPO" && printf '%s' "$KEY" | npx wrangler pages secret put TERMINAL_KEY --project-name "$PROJECT" >/dev/null)

echo "[install] 4/7 stop old bare-node bridge if any"
pkill -f "node ${HOME}/grok-agent/server.js" 2>/dev/null || true
pkill -f "node ${BRIDGE}/server.js"           2>/dev/null || true

echo "[install] 5/7 copy + reload launchd plists"
mkdir -p "$LAUNCHD"
cp launchd/com.owner.grok-bridge.plist     "$LAUNCHD/"
cp launchd/com.owner.cloudflared-grok.plist "$LAUNCHD/"
launchctl unload "$LAUNCHD/com.owner.grok-bridge.plist"     2>/dev/null || true
launchctl unload "$LAUNCHD/com.owner.cloudflared-grok.plist" 2>/dev/null || true
# kill bare cloudflared too, launchd takes over
pkill -x cloudflared 2>/dev/null || true
sleep 1
launchctl load "$LAUNCHD/com.owner.grok-bridge.plist"
launchctl load "$LAUNCHD/com.owner.cloudflared-grok.plist"

echo "[install] 6/7 wait for bridge to come up"
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:3000/ -m 2 >/dev/null 2>&1; then
    echo "[install]     bridge :3000 is up"
    break
  fi
  sleep 1
done

echo "[install] 7/7 end-to-end smoke through the tunnel"
HEALTH="$(curl -sS https://agent.<bridge-domain>/health -m 8 -H "x-terminal-key: $KEY")"
echo "[install]     /health → $(echo "$HEALTH" | jq -c '{key_set, ingest_set, shell_true_allowed, installed_cli: (.installed_cli | with_entries(select(.value != null)) | keys)}')"
EXEC="$(curl -sS https://agent.<bridge-domain>/exec -m 8 \
  -H "x-terminal-key: $KEY" -H "Content-Type: application/json" \
  -d '{"cmd":"echo","args":["bridge alive"]}')"
echo "[install]     /exec  → $(echo "$EXEC" | jq -c '{ok, exit, stdout: (.stdout|gsub("\\n"; ""))}')"

cat <<EOF
[install] done.
  env file:        $ENV_FILE
  launchd bridge:  $LAUNCHD/com.owner.grok-bridge.plist
  launchd tunnel:  $LAUNCHD/com.owner.cloudflared-grok.plist
  Pages secret:    TERMINAL_KEY set on $PROJECT

ONE manual macOS step remaining (the OS will pop dialogs on first call —
grant proactively to avoid silent failures on DESKTOP_* / LOCAL_OSASCRIPT rows):
  - System Settings → Privacy & Security → Accessibility       → add Terminal (or whichever shell launchd uses)
  - System Settings → Privacy & Security → Screen Recording    → add the same
EOF
