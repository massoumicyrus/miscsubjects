# bridge — Mac-side terminal annex for miscsubjects

One process, one route (`/exec`), one auth header (`x-terminal-key`), one global deny-glob, full HTTP request+response logged back to `miscsubjects.com/api/event_log_ingest` per the standing-order shape.

Every new CLI absorbed = one `ADD_ROW` from iMessage. No code change. See `../TERMINAL_ANNEX.md` for the full spec, executor directives, and the row catalog.

## One-time install on the Mac

```
# 1. Ensure the repo is checked out at ~/miscsubjects-pages (already true on the owner's Mac).
cd ~/miscsubjects-pages/bridge

# 2. Install the express dep.
npm install

# 3. Generate a shared secret and stash it locally.
mkdir -p ~/.config
cp .env.example ~/.config/grok-bridge.env
sed -i '' "s|replace-with-32-byte-hex-from-openssl-rand|$(openssl rand -hex 32)|" ~/.config/grok-bridge.env

# 4. Mirror the same secret into miscsubjects as a Pages secret.
TERMINAL_KEY=$(grep '^TERMINAL_KEY=' ~/.config/grok-bridge.env | cut -d= -f2-)
cd ~/miscsubjects-pages
echo "$TERMINAL_KEY" | npx wrangler pages secret put TERMINAL_KEY --project-name loop-safe-miscsubjects
cd bridge

# 5. Stop the old bare-node bridge if it is running.
pkill -f "node /Users/owner/grok-agent/server.js" || true

# 6. Load launchd plists for both bridge + cloudflared tunnel.
cp launchd/com.owner.grok-bridge.plist     ~/Library/LaunchAgents/
cp launchd/com.owner.cloudflared-grok.plist ~/Library/LaunchAgents/
launchctl unload ~/Library/LaunchAgents/com.owner.grok-bridge.plist     2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.owner.cloudflared-grok.plist 2>/dev/null || true
launchctl load   ~/Library/LaunchAgents/com.owner.grok-bridge.plist
launchctl load   ~/Library/LaunchAgents/com.owner.cloudflared-grok.plist

# 7. Health check from the public side (must come back 200 with key_set=true).
curl -sS https://agent.cannibal.capital/health -H "x-terminal-key: $TERMINAL_KEY" | jq .

# 8. Smoke test from miscsubjects' side.
curl -sS https://agent.cannibal.capital/exec \
  -H "x-terminal-key: $TERMINAL_KEY" -H "Content-Type: application/json" \
  -d '{"cmd":"echo","args":["hello from bridge"]}' | jq .
```

## Headless permissions to grant once

Some `LOCAL_*` / `DESKTOP_*` rows need macOS permissions the OS only prompts for once. Grant proactively before the first call:

- **Accessibility** — System Settings → Privacy & Security → Accessibility → add `Terminal` (or whatever shell the bridge runs under). Required for `osascript` keystroke / clicks via the `computer` sub-agent.
- **Screen Recording** — same panel → Screen Recording → add the same shell. Required for `screencapture` to actually capture the screen.
- **Automation** — first time `osascript` controls Notes/Messages/Music/Safari, macOS will pop a one-time approval. Approve.

Without these, the `DESKTOP_*` rows will silently fail or return empty screenshots.

## Headers and shape

| Header | Required | Notes |
|---|---|---|
| `x-terminal-key` | yes | 32-byte hex shared with miscsubjects |
| `x-trace-id` | optional | echoed into ingest payload — let dispatch.js thread its trace through |
| `Content-Type` | required | `application/json` |

### POST `/exec` body

```json
{
  "cmd": "claude",
  "args": ["-p", "review the diff", "--output-format", "json", "--dangerously-skip-permissions"],
  "cwd": "/Users/owner/miscsubjects-pages",
  "stdin": "",
  "env": { "ANTHROPIC_API_KEY": "..." },
  "timeout": 600000,
  "shell": false,
  "stream": false
}
```

`shell: true` is rejected unless `ALLOW_SHELL_TRUE=1` is set in the Mac env file. Even then, the global deny-glob still applies.

### Response

```json
{
  "ok": true,
  "exit": 0,
  "signal": null,
  "killed_by_timeout": false,
  "stdout": "...",
  "stderr": "",
  "duration_ms": 1247,
  "cmd": "claude",
  "args": ["-p", "..."],
  "cwd": "/Users/owner/miscsubjects-pages",
  "shell": false
}
```

## Global deny-glob

Hard floor enforced server-side, independent of per-row `permission_tier`:

```
rm -rf /            sudo                   dd if=
mkfs                fork-bomb pattern      shutdown / halt / reboot
> /dev/sd*          > /dev/disk*
```

This is the last line of defense if a row template, a model hallucination, and the miscsubjects-side tier gate all fail simultaneously. Tune by editing `DENY_GLOBS` in `server.js`.

## What this replaces

| Component | Status after this annex lands |
|---|---|
| `~/grok-agent/server.js` (the old 23-line `/message` bridge) | **DEPRECATED.** Same path on disk; same port (3000); same tunnel terminating at it. Stop the old `node server.js` PID, launchd takes over with this file. |
| `~/grok-router/` (Cloudflare Worker `api.cannibal.capital`) | **RETIRE.** Blooio webhooks now hit `miscsubjects.com/blooio`. The `/sms`, `/wa`, `/llm`, `/terminal` routes in `grok-router/src/index.js` are dead code — keep one release as fallback, then `wrangler delete grok-router`. |
| Cloudflare Tunnel `grok-agent` (UUID `e22569fd-8186-4099-a2ed-e554fcd0dcab`) | **KEEP.** Same ingress: `agent.cannibal.capital → localhost:3000`. Now managed by launchd plist for reboot survival instead of bare `cloudflared` PID. |

## What this enables

Once the bridge is live and a `LOCAL_EXEC` directory row exists pointing at `https://agent.cannibal.capital/exec`, every CLI on the Mac is one `ADD_ROW` away from being a tool the ROUTER can call.

See `../TERMINAL_ANNEX.md` for the row catalog, the 10 capability domains, the executor directives (web search, GitHub absorption, MCP registry scour), and the smoke test plan.
