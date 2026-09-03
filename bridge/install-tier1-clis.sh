#!/bin/bash
# Phase D consolidated — install the Tier-1 CLI worker agents that show up as
# CLI_* directory rows. Safe to re-run; each step skips if already installed.
#
# Runs in two layers:
#   1. brew / npm / pip installs (binaries the CLI_* rows will spawn)
#   2. superagent grok-cli built from source into a NON-COLLIDING path
#      (~/.superagent-grok/bin/grok) so it never overwrites xAI's grok at
#      ~/.grok/bin/grok
#
# After this script, `bridge /health` should report installed_cli with
# claude / codex / gemini / aider / plandex / interpreter as non-null paths.

set -euo pipefail

echo "[clis] 1/8 verify brew tier (already installed for most; install if missing)"
for bin in gh jq rg fd ffmpeg pandoc sqlite3 tesseract bun; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "[clis]    brew install $bin"
    brew install "$bin" || echo "[clis]    WARN: brew install $bin failed (continue)"
  fi
done

echo "[clis] 2/8 Claude Code"
if ! command -v claude >/dev/null 2>&1; then
  npm i -g @anthropic-ai/claude-code || echo "[clis]    WARN: claude install failed"
fi

echo "[clis] 3/8 Codex CLI"
if ! command -v codex >/dev/null 2>&1; then
  npm i -g @openai/codex || echo "[clis]    WARN: codex install failed"
fi

echo "[clis] 4/8 Gemini CLI"
if ! command -v gemini >/dev/null 2>&1; then
  npm i -g @google/gemini-cli || echo "[clis]    WARN: gemini install failed"
fi

echo "[clis] 5/8 Aider"
if ! command -v aider >/dev/null 2>&1; then
  pip3 install --user aider-chat || echo "[clis]    WARN: aider install failed"
fi

echo "[clis] 6/8 OpenInterpreter"
if ! command -v interpreter >/dev/null 2>&1; then
  pip3 install --user open-interpreter || echo "[clis]    WARN: open-interpreter install failed"
fi

echo "[clis] 7/8 Plandex"
if ! command -v plandex >/dev/null 2>&1; then
  curl -sSL https://plandex.ai/install.sh | bash || echo "[clis]    WARN: plandex install failed"
fi

echo "[clis] 8/9 browser-use (Python 3.12 venv)"
VENV_BU="${HOME}/miscsubjects-pages/bridge/.venv-browser-use"
if ! "${VENV_BU}/bin/python" -c "import browser_use" 2>/dev/null; then
  if command -v uv >/dev/null 2>&1; then
    (cd "${HOME}/miscsubjects-pages/bridge" && uv venv .venv-browser-use --python 3.12 && uv pip install --python .venv-browser-use/bin/python browser-use playwright)
    .venv-browser-use/bin/playwright install chromium || echo "[clis]    WARN: playwright chromium install failed"
  else
    echo "[clis]    WARN: uv not found — install uv then re-run"
  fi
fi

echo "[clis] 9/9 superagent grok-cli (parallel path)"
SRC="${HOME}/superagent-grok"
BIN_DIR="${HOME}/.superagent-grok/bin"
mkdir -p "$BIN_DIR"
if [ ! -d "$SRC/.git" ]; then
  git clone https://github.com/superagent-ai/grok-cli "$SRC"
fi
(cd "$SRC" && git pull --ff-only --quiet || true)
(cd "$SRC" && bun install --no-progress)
(cd "$SRC" && bun run build)
# Symlink to the most plausible dist path. Adjust if upstream renames.
if [ -f "$SRC/dist/index.js" ]; then
  ln -sf "$SRC/dist/index.js" "$BIN_DIR/grok"
elif [ -f "$SRC/dist/cli.js" ]; then
  ln -sf "$SRC/dist/cli.js" "$BIN_DIR/grok"
elif [ -f "$SRC/build/index.js" ]; then
  ln -sf "$SRC/build/index.js" "$BIN_DIR/grok"
else
  echo "[clis]    WARN: superagent dist not where expected — symlink not created. Inspect $SRC and adjust."
fi

echo "[clis] done. Asking the bridge what is installed now:"
KEY="$(grep '^TERMINAL_KEY=' "${HOME}/.config/grok-bridge.env" | cut -d= -f2-)"
curl -sS https://agent.<bridge-domain>/health -H "x-terminal-key: $KEY" \
  | jq -c '{installed: (.installed_cli | with_entries(select(.value != null)) | keys), missing: (.installed_cli | with_entries(select(.value == null)) | keys)}'
