import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

type Env = {
  DB: D1Database;
  KV: KVNamespace;
  TERMINAL_KEY: string;
  BUILD_URL: string;
  MCP_OBJECT: DurableObjectNamespace;
};

// Real Cloudflare Dynamic-Worker MCP server: McpAgent running on a Durable Object.
// Exposes the miscsubjects build to any MCP client (Claude Desktop, Cursor, ChatGPT).
export class MiscsubjectsMCP extends McpAgent<Env> {
  server = new McpServer({ name: "miscsubjects", version: "1.0.0" });

  async init() {
    this.server.tool(
      "d1_query",
      { sql: z.string().describe("A read-only SQL SELECT against the build database (miscsubjects-content).") },
      async ({ sql }) => {
        const r = await this.env.DB.prepare(sql).all();
        return { content: [{ type: "text", text: JSON.stringify(r.results ?? r) }] };
      }
    );

    this.server.tool(
      "kv_get",
      { key: z.string().describe("A KV key on the build (e.g. ROUTER_mcp, grok_reasoning_effort).") },
      async ({ key }) => {
        const v = await this.env.KV.get(key);
        return { content: [{ type: "text", text: v ?? "(null)" }] };
      }
    );

    this.server.tool(
      "kv_put",
      { key: z.string(), value: z.string() },
      async ({ key, value }) => {
        await this.env.KV.put(key, value);
        return { content: [{ type: "text", text: "OK" }] };
      }
    );

    this.server.tool(
      "list_directory",
      { type: z.string().optional().describe("Filter by type: agent | fn | http | flow. Omit for all.") },
      async ({ type }) => {
        const stmt = type
          ? this.env.DB.prepare("SELECT key,type,target FROM directory WHERE type = ? ORDER BY key").bind(type)
          : this.env.DB.prepare("SELECT key,type,target FROM directory ORDER BY key");
        const r = await stmt.all();
        return { content: [{ type: "text", text: JSON.stringify(r.results) }] };
      }
    );

    this.server.tool(
      "dispatch",
      {
        key: z.string().describe("Any build tool or agent key — e.g. ROUTER, ARTICLES, FILE_GET, WRANGLER_DEPLOY."),
        body: z.string().default("").describe("Pipe-joined arguments for that tool (empty if none)."),
      },
      async ({ key, body }) => {
        const r = await fetch(this.env.BUILD_URL + "/api/dispatch", {
          method: "POST",
          headers: { "content-type": "application/json", "x-terminal-key": this.env.TERMINAL_KEY },
          body: JSON.stringify({ key, body: body || "" }),
        });
        const text = await r.text();
        return { content: [{ type: "text", text }] };
      }
    );

    this.server.tool(
      "oip_registry",
      { category: z.string().optional().describe("Optional directory category filter.") },
      async ({ category }) => {
        const u = this.env.BUILD_URL + "/api/dispatch?registry=1" +
          (category ? "&category=" + encodeURIComponent(category) : "");
        const r = await fetch(u);
        const text = await r.text();
        return { content: [{ type: "text", text }] };
      }
    );

    this.server.tool(
      "oip_invocations",
      {
        slug: z.string().optional(),
        waste: z.boolean().optional(),
        limit: z.number().optional(),
      },
      async ({ slug, waste, limit }) => {
        const qs = new URLSearchParams();
        if (slug) qs.set("slug", slug);
        if (waste) qs.set("waste", "1");
        if (limit) qs.set("limit", String(limit));
        const r = await fetch(this.env.BUILD_URL + "/api/invocations?" + qs.toString(), {
          headers: { "x-terminal-key": this.env.TERMINAL_KEY },
        });
        const text = await r.text();
        return { content: [{ type: "text", text }] };
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return new Response("miscsubjects MCP server (Dynamic Worker / McpAgent). Connect with Authorization: Bearer <TERMINAL_KEY> at /sse or /mcp.", {
        headers: { "content-type": "text/plain" },
      });
    }
    // Lock everything else behind the terminal key.
    const auth = request.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!env.TERMINAL_KEY || token !== env.TERMINAL_KEY) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { "content-type": "application/json" },
      });
    }
    if (url.pathname === "/sse" || url.pathname === "/sse/message") {
      return MiscsubjectsMCP.serveSSE("/sse").fetch(request, env, ctx);
    }
    if (url.pathname === "/mcp") {
      return MiscsubjectsMCP.serve("/mcp").fetch(request, env, ctx);
    }
    if (url.pathname === "/") {
      return new Response("miscsubjects MCP server (Dynamic Worker / McpAgent). Connect an MCP client to /sse or /mcp.", {
        headers: { "content-type": "text/plain" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
};
