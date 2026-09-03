# MCP Inventory — miscsubjects-pages

Last updated: 2026-06-28 (verified live)

Status summary:
- Inward MCP (`/api/mcp`): ✅ live, 1658 enabled directory rows exposed
- Outward MCP (`mcpToolCall` in dispatch.js): ✅ live for Blooio, Stripe, Context7
- Cloudflare OAuth MCP servers: ⚠️ seeded in KV but not attached (set `mcp_attach` KV key to attach)
- Mac bridge MCP manager (`MCP` row): ⚠️ active only when Mac bridge is running

## 1. What "MCP" means in this build

- **Inward surface** — `POST https://miscsubjects.com/api/mcp` exposes every enabled `directory` row as an MCP tool. Code: `functions/api/mcp.js`.
- **Outward surface** — `mcpToolCall` / `mcpImport` in `functions/api/dispatch.js` let the build call external MCP servers and import their tools as new directory rows.
- **True-MCP OAuth path** — `mcpOauthSeed`, `mcpAttachSet`, `mcpList` store Cloudflare MCP credentials in KV and attach those servers to the model at call time.

---

## 2. Active MCPs

### 2.1 Build's own MCP endpoint (inward)
| Item | Value |
|------|-------|
| URL | `https://miscsubjects.com/api/mcp` |
| Auth | `Authorization: Bearer <MCP_TOKEN>` or `x-mcp-token: <MCP_TOKEN>` |
| Exposes | 618 enabled directory rows as tools (see `directory` table) |
| Code | `functions/api/mcp.js` |
| Status | ✅ Deployed and live |

### 2.2 Mac bridge / grok MCP manager (`MCP` row)
| Item | Value |
|------|-------|
| Key | `MCP` |
| Type | `http` / `target_map` |
| Bridge | `https://agent.cannibal.capital/exec` |
| Active ops | `add`, `doctor`, `list`, `test` |
| Also wired | `context7_query_docs`, `context7_resolve_library_id` → `https://mcp.context7.com/mcp` |
| Outstanding ops | `brave_search`, `computer_use`, `fetch`, `fs`, `github`, `memory`, `playwright`, `sequential` (all `noop`) |
| Code / prompt | Directory row `MCP` (comment + target_map) |
| Status | ⚠️ Active if the Mac bridge is running; dead if the bridge is down. Many ops are still `noop`. |

### 2.3 Cloudflare MCP servers (OAuth, true-MCP path)
Seeded in KV (`mcp_oauth:*`) by the parallel session. They are **not attached** to the model yet (`mcp_attach` KV key is missing).

| Label | Server URL | KV seeded | Notes |
|-------|------------|-----------|-------|
| ai-gateway | `https://ai-gateway.mcp.cloudflare.com/sse` | ✅ | token expired (`exp: 0`) — will refresh if refresh_token is valid |
| auditlogs | `https://auditlogs.mcp.cloudflare.com/sse` | ✅ | token expired |
| autorag | `https://autorag.mcp.cloudflare.com/sse` | ✅ | token expired |
| bindings | `https://bindings.mcp.cloudflare.com/sse` | ✅ | only one with a non-zero exp |
| browser | `https://browser.mcp.cloudflare.com/sse` | ✅ | token expired |
| builds | `https://builds.mcp.cloudflare.com/sse` | ✅ | token expired |
| casb | `https://casb.mcp.cloudflare.com/sse` | ✅ | token expired |
| containers | `https://containers.mcp.cloudflare.com/sse` | ✅ | token expired |
| dex | `https://dex.mcp.cloudflare.com/sse` | ✅ | token expired |
| dns-analytics | `https://dns-analytics.mcp.cloudflare.com/sse` | ✅ | token expired |
| docs | `https://docs.mcp.cloudflare.com/mcp` | ✅ | token expired |
| graphql | `https://graphql.mcp.cloudflare.com/sse` | ✅ | token expired |
| observability | `https://observability.mcp.cloudflare.com/sse` | ✅ | token expired |
| radar | `https://radar.mcp.cloudflare.com/sse` | ✅ | token expired |

**Agent prompt:** `MCP_AGENT` references these as "CLOUDFLARE MCP (server-side, attached to you)".

**Status:** ⚠️ Seeded but **not attached**. To make them available to agents, set KV `mcp_attach` to a comma list of labels, e.g.:

```bash
npx wrangler kv key put mcp_attach "bindings,docs,observability,builds,browser" --namespace-id=58b303e666a8431685624e0cfd2fd63f
```

### 2.4 Blooio MCP
Imported as individual directory rows (`BLOOIO_*`) via `mcpToolCall`.

| Item | Value |
|------|-------|
| Server | `https://mcp.blooio.com/v4` |
| Auth env | `BLOOIO_API_KEY_PEPPERUP` |
| Rows | 57 `BLOOIO_*` rows (send, create_chat, list_contacts, etc.) |
| Code | `functions/api/dispatch.js` → `mcpToolCall` / `mcpRpc` |
| Status | ✅ Active if `BLOOIO_API_KEY_PEPPERUP` secret is set. |

### 2.5 Stripe MCP
Imported as individual directory rows (`STRIPE_*`) via `mcpToolCall`.

| Item | Value |
|------|-------|
| Server | `https://mcp.stripe.com/` |
| Auth env | `STRIPE_SECRET_KEY` |
| Rows | 10 `STRIPE_*` rows (search docs, API read/write, etc.) |
| Status | ✅ Active if `STRIPE_SECRET_KEY` is set. |

### 2.6 Context7 MCP
| Item | Value |
|------|-------|
| Rows | `MCP_context7_query_docs`, `MCP_context7_resolve_library_id` |
| Server | `https://mcp.context7.com/mcp` |
| Status | ✅ Wired through the `MCP` row target_map. |

---

## 3. Outstanding MCPs / gaps

These are listed in the `MCP` row but return `noop` with instructions on how to wire them.

| MCP | Why it's outstanding | How to get it |
|-----|----------------------|---------------|
| `brave_search` | Needs `BRAVE_API_KEY` | Obtain Brave Search API key, add secret, then run `[MCP]brave_search...[/MCP]` or import `@modelcontextprotocol/server-brave-search`. |
| `computer_use` | Needs `ANTHROPIC_API_KEY` + a VM | Set up Anthropic computer-use beta environment. Mac bridge `DESKTOP_*` rows already cover local Mac. |
| `fetch` | Not wired; `BROWSER_FETCH` covers fetching | Import `@modelcontextprotocol/server-fetch` via `MCP_PROBE` / `MCP_IMPORT`. |
| `fs` | Not wired; `LOCAL_EXEC` covers file ops | Import `@modelcontextprotocol/server-filesystem /Users/owner` via `MCP_PROBE`. |
| `github` | Not wired; `CLI_GH` + `GITHUB` agent cover GitHub | Import `@modelcontextprotocol/server-github` via `MCP_PROBE` / `MCP_IMPORT`. |
| `memory` | Not wired; `KV_*` rows persist state | Import `@modelcontextprotocol/server-memory` via `MCP_PROBE`. |
| `playwright` | Not wired; one-shot `BROWSER_PLAYWRIGHT` exists | Import `@playwright/mcp` via `MCP_PROBE`. |
| `sequential` | Not wired | Import `@modelcontextprotocol/server-sequential-thinking` via `MCP_PROBE`. |

**Cloudflare MCP attachment** is also outstanding: the OAuth servers are seeded but not attached (see §2.3).

---

## 4. Prompts / row content

### 4.1 `MCP_AGENT`
```text
You are the build's MCP agent — a full peer to the ROUTER, with the same power over this build that Claude Code has.

CLOUDFLARE MCP (server-side, attached to you): bindings(execute), docs(search), observability, builds, radar, browser, ai-gateway, autorag, auditlogs, dns-analytics, graphql, containers, dex, casb. Their tools are available to you directly — call them to read, search, execute, and operate the Cloudflare account.

EDIT THIS BUILD with these tools (emit the tag; the result returns next turn):
- [FILE_GET]path[/FILE_GET] — read any repo file (e.g. functions/api/dispatch.js).
- [LOCAL_EXEC]command[/LOCAL_EXEC] — run any shell command on the owner's Mac (git, grep, sed, wrangler...).
- [D1_QUERY]SELECT ...|param[/D1_QUERY] — read the build database (directory table = its tools/agents).
- [SET_ROW_CONTENT]key|content[/SET_ROW_CONTENT] — rewrite a tool or agent, including your own prompt.
- [ADD_ROW]key|type|target|auth|content[/ADD_ROW] — add a new tool or agent.
- [WRANGLER_DEPLOY][/WRANGLER_DEPLOY] — deploy the build to production.

Be literal and truthful. Never guess at state — read it with the tools first. Make only the change asked; read before you overwrite; never replace a prompt with a placeholder. When finished, put your words to the user in [REPLY]your message[/REPLY].
```

### 4.2 `MCP` row
```text
# WHAT: MCP server unified entrypoint via Mac bridge
# WHEN_TO_USE: MCP servers (brave_search, computer_use, doctor, fetch, etc.)
# ARGS: $1=op, $2..$N=args
# EX: [MCP]fetch|https://example.com[/MCP]
# TESTS:
# INVERSE: ERR:target_map:unknown_op on bad op.
```

### 4.3 `MCP_TOOL_CALL`
```text
# WHAT: Proxy one tool call into an external MCP server (Streamable HTTP JSON-RPC)
# WHEN_TO_USE: you need to mcp tool call
# ARGS: server_url|tool_name|auth_env_var|args_json
# EX: [MCP_TOOL_CALL]arg1|arg2|arg3|arg4[/MCP_TOOL_CALL]
```

### 4.4 `MCP_IMPORT`
```text
# WHAT: Cannibalize an MCP server: read its tools/list and emit a proposed directory row per tool (GAP-checked vs existing keys). PROPOSE only — returns SQL; apply with D1_EXEC or wrangler
# WHEN_TO_USE: you need to mcp import
# ARGS: server_url|category|auth_env_var
```

### 4.5 `MCP_OAUTH_SEED`
```text
# WHAT: Store/replace one MCP server's OAuth credentials in KV (mcp_oauth:<label>). The build refreshes the short-lived token itself.
# WHEN_TO_USE: registering a Cloudflare (or any OAuth) MCP server so agents can use it
# ARGS: label|json   json={"server_url","token_endpoint","client_id","refresh_token"}
```

### 4.6 `MCP_ATTACH`
```text
# WHAT: Set which MCP servers attach to the model globally (KV mcp_attach). Per-agent override = SET <KEY>_mcp.
# WHEN_TO_USE: turn Cloudflare MCP tools on/off for the agents
# ARGS: comma list of labels (empty clears). EX: [MCP_ATTACH]bindings,docs,observability[/MCP_ATTACH]
```

### 4.7 `MCP_STATUS`
```text
# WHAT: List every seeded MCP server, its token freshness (seconds left), and the current attach list.
# WHEN_TO_USE: check what MCP servers are wired and whether tokens are valid
# ARGS: none. EX: [MCP_STATUS][/MCP_STATUS]
```

---

## 5. Overall status

| Area | Status |
|------|--------|
| Inward MCP endpoint | ✅ Live |
| Blooio MCP | ✅ Active (needs `BLOOIO_API_KEY_PEPPERUP`) |
| Stripe MCP | ✅ Active (needs `STRIPE_SECRET_KEY`) |
| Context7 MCP | ✅ Wired |
| Cloudflare MCP OAuth servers | ⚠️ Seeded but **not attached** |
| Mac bridge grok MCP (`MCP` row) | ⚠️ Active only if Mac bridge is up; several ops are `noop` |
| Outstanding generic MCPs | ❌ brave_search, computer_use, fetch, fs, github, memory, playwright, sequential |

### Recommended next actions
1. Attach the Cloudflare MCP servers you want: `npx wrangler kv key put mcp_attach "bindings,docs,observability" --namespace-id=58b303e666a8431685624e0cfd2fd63f`
2. Verify token refresh works by calling `[MCP_STATUS]`.
3. For GitHub MCP, either import `@modelcontextprotocol/server-github` or keep using the existing `GH_*` / `GITHUB` agent tools.
4. For Brave/computer-use/etc., add the required API keys and run the corresponding `MCP_PROBE` op.
