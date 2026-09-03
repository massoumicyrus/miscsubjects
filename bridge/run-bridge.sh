#!/bin/bash
# Wrapper sourced by launchd. Loads ~/.config/grok-bridge.env (NOT in repo;
# contains TERMINAL_KEY, MISC_INGEST_URL, PATH, ALLOW_SHELL_TRUE) and exec's node.

set -e

ENV_FILE="${HOME}/.config/grok-bridge.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

# Make sure brew + user-installed CLIs are on PATH for spawned children.
# nvm bin carries claude/codex/gemini; the Python user-base bin carries aider/interpreter.
NVM_BIN="$(ls -d "${HOME}/.nvm/versions/node/"*/bin 2>/dev/null | sort -V | tail -1)"
export PATH="${HOME}/.local/bin:${HOME}/.grok/bin:${HOME}/.superagent-grok/bin:${NVM_BIN:+$NVM_BIN:}${HOME}/Library/Python/3.9/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

cd "$(dirname "$0")"

exec /opt/homebrew/bin/node server.js
