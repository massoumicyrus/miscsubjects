# Playwright MCP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Microsoft Playwright MCP into the build so the owner can text natural-language browser commands and the build drives a real headless browser.

**Architecture:** Playwright MCP runs headless on the Mac bridge, exposed via a named Cloudflare tunnel (`playwright.miscsubjects.com`). A single `PLAYWRIGHT` directory row proxies tool calls through the existing `mcpToolCall` FN_MAP target. A `PLAYWRIGHT_START` row boots the server via the Mac bridge.

**Tech Stack:** bash, npx, cloudflared, Cloudflare Pages Functions, D1 directory rows.

---

## File structure

- `bridge/playwright-mcp-launcher.sh` (new) — starts and keeps Playwright MCP alive on the Mac.
- `prompts/ROUTER.md` (modify) — one clause telling ROUTER when to use `[PLAYWRIGHT]`.
- D1 directory rows `PLAYWRIGHT_START` and `PLAYWRIGHT` (new, added via D1_EXEC).
- `API_QUICKMAP.md` (modify, optional) — document the new row.

---

### Task 1: Create the Mac-side launcher script

**Files:**
- Create: `bridge/playwright-mcp-launcher.sh`

- [ ] **Step 1: Write the launcher**

```bash
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
npx -y playwright install chromium 2>&1 | tee "$LOG_DIR/install.log"

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
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x bridge/playwright-mcp-launcher.sh
```

- [ ] **Step 3: Commit**

```bash
git add bridge/playwright-mcp-launcher.sh
git commit -m "feat(bridge): Playwright MCP launcher script"
```

---

### Task 2: Set up the named Cloudflare tunnel

**Files:** none (infrastructure setup on the Mac)

- [ ] **Step 1: Create the tunnel**

Run on the Mac:

```bash
cloudflared tunnel create playwright-mcp
```

Note the tunnel ID.

- [ ] **Step 2: Add the public hostname route**

```bash
cloudflared tunnel route dns playwright-mcp playwright.miscsubjects.com
```

- [ ] **Step 3: Start the tunnel**

```bash
cloudflared tunnel run playwright-mcp
```

(For persistence, add to launchd or keep in a tmux session; out of scope for this plan.)

---

### Task 3: Add the `PLAYWRIGHT_START` directory row

**Files:** none (D1 row)

- [ ] **Step 1: Insert the row**

```bash
cd /Users/owner/miscsubjects-pages
npx wrangler d1 execute loop-content-spine --remote --command \
  "INSERT INTO directory (key,type,target,auth,content,category,runner,planner_rank,planner_visible,enabled,updated_at) VALUES ('PLAYWRIGHT_START','http','POST https://agent.cannibal.capital/exec','','# WHAT: Start the Playwright MCP server on the Mac bridge\n# WHEN_TO_USE: before calling PLAYWRIGHT if the server is not running\n# ARGS: none\n# EX: [PLAYWRIGHT_START][/PLAYWRIGHT_START]\n{\"cmd\":\"sh\",\"args\":[\"-lc\",\"/Users/owner/miscsubjects-pages/bridge/playwright-mcp-launcher.sh\"],\"timeout\":600000}','browser','mac',50,1,1,datetime('now'));"
```

- [ ] **Step 2: Smoke test the row**

```bash
curl -s -X POST -d '{"key":"PLAYWRIGHT_START","body":""}' https://miscsubjects.com/api/dispatch | jq .
```

Expected: `ok: pid=...` or `already running`.

---

### Task 4: Add the `PLAYWRIGHT` directory row

**Files:** none (D1 row)

- [ ] **Step 1: Insert the row**

```bash
cd /Users/owner/miscsubjects-pages
npx wrangler d1 execute loop-content-spine --remote --command \
  "INSERT INTO directory (key,type,target,auth,content,category,runner,input_schema,planner_rank,planner_visible,enabled,updated_at) VALUES ('PLAYWRIGHT','fn','mcpToolCall','','# WHAT: Proxy a tool call to the Playwright MCP server\n# WHEN_TO_USE: drive a real browser: navigate, click, type, screenshot, evaluate JS, manage tabs\n# ARGS: $1=tool_name, $2+=JSON arguments\n# EX: [PLAYWRIGHT]browser_navigate|{\\\"url\\\":\\\"https://example.com\\\"}[/PLAYWRIGHT]\n# TESTS: browser_navigate https://example.com returns page title/snapshot\n[\\\"https://playwright.miscsubjects.com/mcp\\\",\\\"$1\\\",\\\"$2+\\\"]','browser','edge','{\\\"type\\\":\\\"object\\\",\\\"properties\\\":{\\\"body\\\":{\\\"type\\\":\\\"string\\\",\\\"description\\\":\\\"tool_name|JSON args, e.g. browser_navigate|{\\\\\\\"url\\\\\\\":\\\\\\\"https://example.com\\\\\\\"}\\\"}},\\\"required\\\":[\\\"body\\\"]}',50,1,1,datetime('now'));"
```

- [ ] **Step 2: API smoke test**

Ensure the tunnel and server are running, then:

```bash
curl -s -X POST -d '{"key":"PLAYWRIGHT","body":"browser_navigate|{\"url\":\"https://example.com\"}"}' https://miscsubjects.com/api/dispatch | jq .
```

Expected: page snapshot or title, not `ERR:fn:mcp_rpc:fetch`.

---

### Task 5: Patch ROUTER prompt

**Files:**
- Modify: `prompts/ROUTER.md`

- [ ] **Step 1: Read the current ROUTER.md end and find a browser-related clause**

```bash
grep -n "BROWSER_\|browser\|screenshot" prompts/ROUTER.md | head -20
```

- [ ] **Step 2: Add the PLAYWRIGHT clause near existing browser rows**

Add a line like:

```markdown
- For interactive browser tasks (click, type, fill a form, navigate and extract, take a screenshot of a page that needs JS interaction) emit `[PLAYWRIGHT]tool|args[/PLAYWRIGHT]` where tool is a Playwright MCP tool name such as `browser_navigate`, `browser_click`, `browser_type`, `browser_take_screenshot`, and args is a JSON object.
```

- [ ] **Step 3: Sync the prompt to D1**

```bash
node -e "const fs=require('fs');const c=fs.readFileSync('prompts/ROUTER.md','utf8');const q=c.replace(/'/g,\"''\");process.stdout.write(\"UPDATE directory SET content='\"+q+\"', updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE key='ROUTER';\")" > /tmp/sync-router.sql
npx wrangler d1 execute loop-content-spine --remote --file=/tmp/sync-router.sql
```

- [ ] **Step 4: Commit**

```bash
git add prompts/ROUTER.md
git commit -m "feat(router): PLAYWRIGHT browser driver clause"
```

---

### Task 6: Deploy and prove

**Files:** none (deploy existing Pages bundle)

- [ ] **Step 1: Deploy Pages**

```bash
cd /Users/owner/miscsubjects-pages
npx wrangler pages deploy public --project-name loop-safe-miscsubjects --commit-dirty=true
```

Confirm output shows "Uploading Functions bundle".

- [ ] **Step 2: API proof**

```bash
curl -s -X POST -d '{"key":"PLAYWRIGHT","body":"browser_navigate|{\"url\":\"https://example.com\"}"}' https://miscsubjects.com/api/dispatch | jq .
```

Expected: non-error result containing page content/title.

- [ ] **Step 3: iMessage proof**

Send from the owner's Mac:

```bash
osascript -e 'tell application "Messages" to send "playwright browser_navigate https://example.com" to buddy "[BUILD_PHONE]"'
```

Read the ledger reply and confirm it contains the page snapshot/title.

---

## Self-review

1. **Spec coverage:** Launcher (Task 1), tunnel (Task 2), start row (Task 3), proxy row (Task 4), ROUTER prompt (Task 5), deploy/proof (Task 6) all map to the design doc.
2. **Placeholder scan:** No TBD/TODO. All commands are concrete.
3. **Type consistency:** `mcpToolCall` signature is `(env, serverUrl, toolName, argsJson)`; the `PLAYWRIGHT` row passes exactly those three args.
4. **Gaps:** Persistent tunnel daemon (launchd/tmux) is left as a runtime detail; the launcher handles server restart only.
