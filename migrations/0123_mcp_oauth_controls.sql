-- True-MCP path: OAuth-protected remote MCP servers attached to the model (xAI runs the loop).
-- Controls are visible/editable directory rows; the MCP agent attaches CF MCP via per-agent KV.

INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,input_schema,planner_rank,planner_visible,enabled,updated_at) VALUES
('MCP_OAUTH_SEED','fn','mcpOauthSeed','',
'# WHAT: Store/replace one MCP server''s OAuth credentials in KV (mcp_oauth:<label>). The build refreshes the short-lived token itself.
# WHEN_TO_USE: registering a Cloudflare (or any OAuth) MCP server so agents can use it
# ARGS: label|json   json={"server_url","token_endpoint","client_id","refresh_token"}
# EX: [MCP_OAUTH_SEED]bindings|{"server_url":"https://bindings.mcp.cloudflare.com/sse",...}[/MCP_OAUTH_SEED]
["$1","$2"]','mcp',NULL,50,0,1,datetime('now')),

('MCP_ATTACH','fn','mcpAttachSet','',
'# WHAT: Set which MCP servers attach to the model globally (KV mcp_attach). Per-agent override = SET <KEY>_mcp.
# WHEN_TO_USE: turn Cloudflare MCP tools on/off for the agents
# ARGS: comma list of labels (empty clears). EX: [MCP_ATTACH]bindings,docs,observability[/MCP_ATTACH]
["$1+"]','mcp',NULL,50,1,1,datetime('now')),

('MCP_STATUS','fn','mcpList','',
'# WHAT: List every seeded MCP server, its token freshness (seconds left), and the current attach list.
# WHEN_TO_USE: check what MCP servers are wired and whether tokens are valid
# ARGS: none. EX: [MCP_STATUS][/MCP_STATUS]
[]','mcp',NULL,50,1,1,datetime('now'));

-- The MCP agent: a grok-4.3 agent that uses whatever MCP servers are attached to it (per-agent KV MCP_AGENT_mcp).
-- Kept separate from ROUTER so the build''s native [KEY] path is preserved untouched.
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,input_schema,planner_rank,planner_visible,enabled,updated_at) VALUES
('MCP_AGENT','agent','grok-4.3','bearer:GROK_API_KEY',
'You are the MCP agent for this build. You are connected to live Cloudflare MCP servers (and any other MCP servers attached to you). Their tools are available to you directly — call them to read, search, execute, and operate on the user''s Cloudflare account and resources, exactly as a first-class MCP client would.

Be literal and truthful. Use the tools to get real answers; never guess at account state. When you have the answer, reply to the user in plain English. If this is a chat turn, put your final words inside [REPLY]your message[/REPLY].','mcp',NULL,60,0,1,datetime('now'));
