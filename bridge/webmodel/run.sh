#!/bin/bash
# The launchd entry point for the browser-model worker. It execs node in the FOREGROUND so launchd
# supervises the real process: a crash is a non-zero exit, KeepAlive restarts it, and `launchctl
# kickstart -k gui/$UID/com.owner.webmodel-worker` is the restart. restart.sh stays for a human at a
# terminal; this file is what the machine runs.
set -e
PORT="${WEBMODEL_PORT:-3011}"
if [ -f "$HOME/.build-vault.env" ]; then set -a; . "$HOME/.build-vault.env"; set +a; fi
mkdir -p "$HOME/.miscsubjects/webmodel"
# A worker left behind by a manual restart.sh would hold the port; take it over, by port only.
PIDS=$(/usr/sbin/lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)
if [ -n "$PIDS" ] && [ "$PIDS" != "$$" ]; then kill $PIDS 2>/dev/null || true; sleep 1; fi
cd "$(dirname "$0")"
exec env TERMINAL_KEY="$TERMINAL_KEY" WEBMODEL_PORT="$PORT" /opt/homebrew/bin/node worker.mjs >> "$HOME/.miscsubjects/webmodel/worker.log" 2>&1
