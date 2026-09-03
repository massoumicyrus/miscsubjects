#!/usr/bin/env bash
# Install agent turn capture: Gemini AfterAgent hook + launchd backfill (codex/kimi/grok history).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_SRC="$REPO/bridge/launchd/com.the owner.agent-turn-backfill.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.the owner.agent-turn-backfill.plist"

echo "== Gemini hooks (project) =="
if command -v gemini >/dev/null 2>&1; then
  (cd "$REPO" && gemini hooks migrate --from-claude 2>/dev/null || true)
  node -e "
    const fs=require('fs'), p='$REPO/.gemini/settings.json';
    const s=JSON.parse(fs.readFileSync(p,'utf8'));
    const cmd='node \"\$GEMINI_PROJECT_DIR/hooks/gemini-turn-log.js\"';
    for (const k of ['AfterAgent']) {
      if (!s.hooks[k]) s.hooks[k]=[];
      const row=s.hooks[k].find(x=>x.hooks);
      if (row) row.hooks=[{type:'command',command:cmd}];
      else s.hooks[k]=[{hooks:[{type:'command',command:cmd}]}];
    }
    fs.writeFileSync(p, JSON.stringify(s,null,2)+'\n');
  "
  echo "  .gemini/settings.json → gemini-turn-log.js"
else
  echo "  gemini CLI not found — skip"
fi

echo "== Kimi Stop hook (per-turn → agent_turns) =="
mkdir -p "$HOME/.kimi-code/hooks/_lib"
cp "$REPO/hooks/kimi-turn-log.js" "$HOME/.kimi-code/hooks/kimi-turn-log.js"
cp "$REPO/hooks/_lib/agent-turn-common.js" "$HOME/.kimi-code/hooks/_lib/agent-turn-common.js"
node "$REPO/hooks/kimi-install-hook.js"
kimi doctor config 2>/dev/null || echo "  (kimi doctor skipped — validate config.toml manually)"

echo "== Codex Stop hook (per-turn → agent_turns) =="
mkdir -p "$HOME/.codex/hooks/_lib"
cp "$REPO/hooks/codex-turn-log.js" "$HOME/.codex/hooks/codex-turn-log.js"
cp "$REPO/hooks/_lib/agent-turn-common.js" "$HOME/.codex/hooks/_lib/agent-turn-common.js"
node -e '
const fs=require("fs"), path=require("path");
const repo=process.argv[1];
const hook={hooks:{Stop:[{matcher:".*",hooks:[{type:"command",command:`node "${path.join(repo,"hooks/codex-turn-log.js")}"`,timeout:30,statusMessage:"miscsubjects turn log"}]}]}};
const json=JSON.stringify(hook,null,2)+"\n";
fs.mkdirSync(path.join(process.env.HOME,".codex"),{recursive:true});
fs.writeFileSync(path.join(process.env.HOME,".codex","hooks.json"),json);
fs.mkdirSync(path.join(repo,".codex"),{recursive:true});
fs.writeFileSync(path.join(repo,".codex","hooks.json"),json);
' "$REPO"
echo "  ~/.codex/hooks.json + $REPO/.codex/hooks.json → codex-turn-log.js (Stop)"

echo "== Grok global Stop hook =="
mkdir -p "$HOME/.grok/hooks"
cp "$REPO/hooks/grok-turn-log.js" "$HOME/.grok/hooks/grok-turn-log.js"
mkdir -p "$HOME/.grok/hooks/_lib"
cp "$REPO/hooks/_lib/agent-turn-common.js" "$HOME/.grok/hooks/_lib/agent-turn-common.js"
GROK_HOOK="node \"$REPO/hooks/grok-turn-log.js\""
cat > "$HOME/.grok/hooks/agent-turn-log.json" <<JSON
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$GROK_HOOK",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
JSON
cp "$REPO/.grok/hooks/agent-turn-log.json" "$REPO/.grok/hooks/agent-turn-log.json" 2>/dev/null || true

echo "== Backfill launchd (every 5 min) =="
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.miscsubjects"
cp "$PLIST_SRC" "$PLIST_DST"
launchctl bootout "gui/$(id -u)/com.the owner.agent-turn-backfill" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DST"
launchctl enable "gui/$(id -u)/com.the owner.agent-turn-backfill"
echo "  loaded $PLIST_DST"

echo "== Initial backfill =="
node "$REPO/hooks/agent-turn-backfill.js"

echo "Done."