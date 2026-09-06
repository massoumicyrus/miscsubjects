#!/bin/bash
# Restart the browser-model worker. Kills by LISTENING PORT, never by matching the process
# command line: a pkill pattern like "webmodel/worker.mjs" also matches the shell running the
# restart, so the old worker survives, the new one dies on EADDRINUSE, and every later test
# silently exercises stale code. That happened once; it does not happen again.
set -e
PORT="${WEBMODEL_PORT:-3011}"
PIDS=$(/usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
if [ -n "$PIDS" ]; then kill $PIDS 2>/dev/null || true; sleep 1; fi
cd "$(dirname "$0")"
if [ -f "$HOME/.build-vault.env" ]; then set -a; . "$HOME/.build-vault.env"; set +a; fi
mkdir -p "$HOME/.miscsubjects/webmodel"
nohup env TERMINAL_KEY="$TERMINAL_KEY" WEBMODEL_PORT="$PORT" /opt/homebrew/bin/node worker.mjs \
  >> "$HOME/.miscsubjects/webmodel/worker.log" 2>&1 &
sleep 2
curl -sS "http://127.0.0.1:$PORT/webmodel/health"
