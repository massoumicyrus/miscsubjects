# Playwright MCP integration — 2026-07-01

Goal: give the build a real, interactive browser it can drive via natural-language iMessage. the owner can text "go to example.com and click Sign up" or "screenshot Hacker News" and the build returns the result.

## Decision

Use Microsoft Playwright MCP (`@playwright/mcp`) running headless on the Mac bridge, exposed through the existing cloudflared tunnel via a new `/mcp` proxy route on the bridge, and invoked through a single `PLAYWRIGHT` directory row that proxies to the MCP server. This closes the existing unwired `playwright` slot in the `MCP` row.

## Why this over alternatives

- The build already has read-only Cloudflare Browser Rendering rows (`BROWSER_MARKDOWN`, `BROWSER_SCREENSHOT`, etc.). Playwright MCP adds interactive control: click, type, fill forms, drag, evaluate JS, manage tabs.
- Browserbase/Steel are paid and need a new API key; Playwright MCP is free and runs on hardware we already pay for.
- The Mac already has a cloudflared tunnel (`grok-agent`) exposing the bridge at `https://agent.cannibal.capital`. Adding a `/mcp` proxy route reuses that tunnel instead of creating a new one or requiring cloudflared re-authentication.

## Components

1. `bridge/playwright-mcp-launcher.sh`
   - Ensures `npx @playwright/mcp install-browser chrome-for-testing` has run.
   - Starts Playwright MCP on `localhost:8931` with `--headless --browser chrome`.
   - Restarts on crash; writes pid/output logs to `~/.miscsubjects/playwright-mcp/`.

2. `bridge/server.js` `/mcp` proxy
   - Auth-gated by `x-terminal-key`.
   - Proxies all methods and paths under `/mcp` to `http://localhost:8931`.
   - Forwards `content-type`, `accept`, `mcp-session-id`, and `host: localhost:8931` headers.
   - Mounted before `express.json()` so raw MCP request bodies stream through unchanged.

3. Directory row `PLAYWRIGHT_START`
   - Type: `http`, runner: `mac`.
   - Calls the Mac bridge to run `bridge/playwright-mcp-launcher.sh`.

4. Directory row `PLAYWRIGHT`
   - Type: `fn`, target: `mcpToolCall`.
   - Content: `["https://agent.cannibal.capital/mcp","$1","$2+","headers:{\"x-terminal-key\":\"$TERMINAL_KEY\"}"]`.
   - `$1` = tool name (e.g. `browser_navigate`), `$2+` = JSON arguments.

5. `functions/api/dispatch.js` MCP handshake/auth updates
   - `mcpRpc` now sends an `initialize` request first and reuses the returned `mcp-session-id` for the actual method call, satisfying Streamable HTTP MCP servers.
   - `mcpAuthHeaders` now supports a `headers:{...}` spec so the bridge's `x-terminal-key` can be forwarded.

6. ROUTER prompt patch
   - One clause added to `prompts/ROUTER.md` telling ROUTER to emit `[PLAYWRIGHT]tool|args_json[/PLAYWRIGHT]` for interactive browser tasks.

## Data flow

1. the owner texts "playwright browser_navigate https://example.com".
2. ROUTER emits `[PLAYWRIGHT]browser_navigate|{"url":"https://example.com"}[/PLAYWRIGHT]`.
3. `PLAYWRIGHT` proxies via `mcpToolCall` → `mcpRpc` → `https://agent.cannibal.capital/mcp`.
4. The bridge `/mcp` route forwards to `localhost:8931`.
5. Playwright MCP drives the headless browser on the Mac.
6. Result returns through the ledger and the iMessage reply.

## Error handling

- If Playwright MCP is not running, the proxy returns a 502. the owner can text "start playwright" to run `PLAYWRIGHT_START`.
- If the browser is not installed, the launcher installs `chrome-for-testing` on startup.
- Large outputs (screenshots, PDFs) go to `~/.miscsubjects/playwright-output/` and the tool returns a file path.

## Testing / proof

- API smoke: `curl -X POST -d '{"key":"PLAYWRIGHT","body":"browser_navigate|{\"url\":\"https://example.com\"}"}' https://miscsubjects.com/api/dispatch` returns page title/snapshot.
- Build-law proof: iMessage from `[OWNER_PHONE]` to `[BUILD_PHONE]`: `playwright browser_navigate https://example.com` → ledger reply contains `Page Title: Example Domain`.

## Files touched

- `bridge/playwright-mcp-launcher.sh` (new)
- `bridge/server.js` (modify — add `/mcp` proxy)
- `functions/api/dispatch.js` (modify — MCP initialize handshake + custom header auth)
- `prompts/ROUTER.md` (patch)
- Directory rows `PLAYWRIGHT_START` and `PLAYWRIGHT` (added via D1_EXEC, not committed to repo)

## Rollback

- Delete directory rows `PLAYWRIGHT_START` and `PLAYWRIGHT`.
- Remove `/mcp` proxy from `bridge/server.js` and restart the bridge.
- Stop the launcher script.
- Revert `prompts/ROUTER.md`.
