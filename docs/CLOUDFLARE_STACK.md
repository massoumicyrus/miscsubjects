# CLOUDFLARE_STACK — agent building blocks, MCP servers, skills, CLIs (survey 2026-06-13)

Everything Cloudflare ships that a Cloudflare-native dispatch build (D1 directory + /api/dispatch + resident DO loop + ledger + MCP import) can adopt. Summaries + repo links.

## A. Agent / AI building blocks (ranked)
| # | name | repo / pkg | what | how this build uses it |
|---|---|---|---|---|
| 1 | Agents SDK | github.com/cloudflare/agents · npm `agents` | stateful agent = a Durable Object (state, scheduling, WebSocket/RPC, MCP client+server, email/voice, idle-free) | the resident loop IS an `Agent` subclass; /api/dispatch becomes a Worker route calling its methods. Kills the sibling-Worker hack. |
| 2 | Project Think (fibers) | cloudflare/agents → packages/think · npm `@cloudflare/think` | agentic-loop base class: durable fibers (checkpoint/crash-recover), sub-agents, sessions, DO-SQLite message store | replaces hand-rolled loop; fibers harden /api/dispatch against restarts; SQLite sessions = a ready ledger w/ branching + FTS |
| 3 | Code Mode | cloudflare/agents → packages/codemode · npm `@cloudflare/codemode` | turns tools into a typed TS API; model writes ONE program; runs in isolated Dynamic Worker; secrets stay server-side | the 331-row directory becomes the typed API; one program chains many dispatch calls. 2500 tools in ~1k tokens. |
| 4 | Code Mode MCP wrapper | `@cloudflare/codemode/mcp` · server mcp.cloudflare.com | wraps any MCP server behind a single code tool | route MCP_IMPORT through it so imported tools land in the directory + run in-sandbox |
| 5 | Durable Objects | platform · workers-sdk | single-threaded stateful actors + co-located SQLite + alarms | substrate for the agent (one DO/session) + the SQLite ledger |
| 6 | Sandbox SDK | github.com/cloudflare/sandbox-sdk · npm `@cloudflare/sandbox` | sandboxed shell/files/code-interpreter/preview URLs on the edge | heavier exec tier when a tool needs a real shell/fs or untrusted long-running code |
| 7 | Workflows | platform · workers-sdk | durable multi-step engine, per-step retry/state | long multi-step dispatches that must survive restarts |
| 8 | Agent Memory | developers.cloudflare.com/agent-memory (binding+REST, no public repo) | managed long-term memory: ingest/recall/forget, topic-keyed supersede chains | cross-session memory without bloating context |
| 9 | Queues | platform · workers-sdk | message queue + consumers | buffer/fan-out dispatched jobs |
| 10 | agents-starter | github.com/cloudflare/agents-starter | starter: chat agent, Workers AI, tools-with-approval, scheduling | copy its tool-with-approval + scheduling wiring |
| 11 | Workers AI | developers.cloudflare.com/workers-ai · `env.AI` | edge GPU inference, no key | default model backend for the loop + Code Mode codegen |
| 12 | AI Gateway | developers.cloudflare.com/ai-gateway | cache/rate-limit/retries/fallback/observability for AI calls | sits in front of every model call → cost/latency telemetry + provider fallback |
| 13 | Vectorize | developers.cloudflare.com/vectorize | vector DB | semantic NL→right-tool routing over the directory; retrieval memory |
| 14 | AutoRAG | developers.cloudflare.com/autorag | managed RAG over R2 docs | grounded answers tool; each AutoRAG instance is also queryable as an MCP tool |
| 15 | Browser Run | developers.cloudflare.com/browser-rendering · `@cloudflare/think/tools/browser` | headless browser, Live View, human-in-loop, CDP, recording | dispatchable browser automation (server-side complement to the AdsPower/local CDP path) |

Also in the cloudflare/agents monorepo: `@cloudflare/shell`, `@cloudflare/voice`, `@cloudflare/worker-bundler`, `hono-agents`.

## B. Cloudflare MCP servers (remote, OAuth-gated; import via MCP_IMPORT)
Repo: github.com/cloudflare/mcp-server-cloudflare. All speak streamable-http at `/mcp`.

| server | endpoint | exposes |
|---|---|---|
| Documentation | docs.mcp.cloudflare.com/mcp | semantic search over CF docs (no auth) |
| Workers Bindings | bindings.mcp.cloudflare.com/mcp | create/list D1, R2, KV, DO, secrets, Workers AI; scaffold Workers |
| Workers Builds | builds.mcp.cloudflare.com/mcp | build/deploy insights, logs, status |
| Observability | observability.mcp.cloudflare.com/mcp | invocation logs + errors + stats |
| Container | containers.mcp.cloudflare.com/mcp | isolated sandbox to run/test code |
| Browser Rendering | browser.mcp.cloudflare.com/mcp | page → screenshot / HTML / markdown |
| Radar | radar.mcp.cloudflare.com/mcp | internet traffic trends, AS/IP, outages, URL scans |
| Logpush | logs.mcp.cloudflare.com/mcp | logpush job health |
| AI Gateway | ai-gateway.mcp.cloudflare.com/mcp | AI-call logs: prompt/response/tokens/latency |
| Audit Logs | auditlogs.mcp.cloudflare.com/mcp | account activity + reports |
| DNS Analytics | dns-analytics.mcp.cloudflare.com/mcp | DNS perf + config review |
| DEX | dex.mcp.cloudflare.com/mcp | app perf/availability (Cloudflare One) |
| CASB | casb.mcp.cloudflare.com/mcp | security misconfig scan (Cloudflare One) |
| GraphQL | graphql.mcp.cloudflare.com/mcp | arbitrary analytics queries |

Top 3 to import first: **Workers Bindings** (build provisions its own D1/R2/KV/secrets = self-management), **Observability** (reads its own logs/errors = act→inspect→fix loop), **AI Gateway** (full token/cost trail = satisfies the logging + credit-accounting laws). No-auth freebie: **Documentation**.

## C. Skills (github.com/cloudflare/skills — SKILL.md packs, shoplistable)
cloudflare (umbrella platform), agents-sdk, durable-objects, sandbox-sdk, wrangler, web-perf, building-mcp-server-on-cloudflare, building-ai-agent-on-cloudflare, workers-best-practices, cloudflare-email-service. RFC: github.com/cloudflare/agent-skills-discovery-rfc (.well-known skill discovery).

## D. CLIs
- wrangler (npm i -g wrangler): d1, r2, kv, vectorize, queues, secret, tail, pages (run from repo dir so Functions ship), ai, hyperdrive, containers, workflows, pipelines.
- c3 / create-cloudflare (npm create cloudflare@latest): scaffolds Workers/Pages/agents.
- cloudflared (github.com/cloudflare/cloudflared): tunnel daemon — already used for the Mac bridge (agent.cannibal.capital).

## E. The "free of Claude Code" path
Rebuild the loop on **Agents SDK + Project Think** (durable resident agent + SQLite ledger), turn the directory into a **Code Mode** typed API (cheap combinatorial chains), and import **Workers-Bindings + Observability + AI Gateway** MCP servers so the build provisions, monitors, and audits **itself**. That makes it self-hosting + self-managing — a small model on top can run it.
