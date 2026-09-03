-- LOCAL_EXEC: dispatch splits body on | — shell || chains were truncated at first pipe (curl/afplay never ran).
UPDATE directory SET content = '# WHAT: Run a shell command on the owner Mac.
# WHEN_TO_USE: any file operation, git command, system check, or script execution.
# ARGS: $1+ = full shell command (pipes/OR/chains preserved).
# EX: [LOCAL_EXEC]ls -la ~/Desktop[/LOCAL_EXEC]
{"cmd":"sh","args":["-lc","$1+"],"timeout":600000}',
  auth = 'headers:{"x-terminal-key":"$TERMINAL_KEY"}', updated_at = datetime('now') WHERE key = 'LOCAL_EXEC';

-- Blooio MCP status tools: $1+ was raw chat|msg, not JSON — fix to {"chat_id","message_id"}.
UPDATE directory SET content = '# Lightweight delivery status. ARGS: chat_id|message_id
# MCP: https://mcp.blooio.com/v4
["https://mcp.blooio.com/v4","get_message_status","{\"chat_id\":\"$1\",\"message_id\":\"$2\"}","BLOOIO_API_KEY_PEPPERUP"]', updated_at = datetime('now') WHERE key = 'BLOOIO_GET_MESSAGE_STATUS';

UPDATE directory SET content = '# List message lifecycle events. ARGS: chat_id|message_id
# MCP: https://mcp.blooio.com/v4
["https://mcp.blooio.com/v4","list_message_events","{\"chat_id\":\"$1\",\"message_id\":\"$2\"}","BLOOIO_API_KEY_PEPPERUP"]', updated_at = datetime('now') WHERE key = 'BLOOIO_LIST_MESSAGE_EVENTS';