#!/bin/bash
set -euo pipefail

LOG_DIR="$HOME/.miscsubjects/playwright-mcp"
OUT_DIR="$HOME/.miscsubjects/playwright-output"
mkdir -p "$LOG_DIR" "$OUT_DIR"

PIDFILE="$LOG_DIR/playwright-mcp.pid"
PORT="${PLAYWRIGHT_MCP_PORT:-8931}"

# If already running on the port, exit cleanly.
if [ -f "$PIDFILE" ]; then
  OLD_PID="$(cat "$PIDFILE" 2>/dev/null || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Playwright MCP already running pid=$OLD_PID"
    exit 0
  fi
fi

# Ensure browsers are installed.
npx -y @playwright/mcp@latest install-browser chrome-for-testing 2>&1 | tee "$LOG_DIR/install.log"

npx -y @playwright/mcp@latest \
  --port "$PORT" \
  --headless \
  --browser chromium \
  --output-dir "$OUT_DIR" \
  --caps=core \
  >> "$LOG_DIR/server.log" 2>&1 &
PID=$!
echo "$PID" > "$PIDFILE"
echo "started pid=$PID port=$PORT"

# Wait briefly and report health.
sleep 3
if kill -0 "$PID" 2>/dev/null; then
  echo "ok: pid=$PID port=$PORT log=$LOG_DIR/server.log"
else
  echo "failed to start; see $LOG_DIR/server.log"
  exit 1
fi
