-- MCP_TOOL_CALL arg template had $3/$4 swapped → JSON.parse(auth_env_var) → ERR:fn:bad_args_json on chat_* sends.
UPDATE directory SET content = '# WHAT: Proxy one tool call into an external MCP server (Streamable HTTP JSON-RPC)
# WHEN_TO_USE: you need to mcp tool call
# ARGS: server_url|tool_name|args_json|auth_env_var
# EX: [MCP_TOOL_CALL]https://mcp.blooio.com/v4|send_chat_message|{"chat_id":"chat_x","text":"hi"}|BLOOIO_API_KEY_PEPPERUP[/MCP_TOOL_CALL]
["$1","$2","$3","$4"]', updated_at = datetime('now') WHERE key = 'MCP_TOOL_CALL';