-- OIP_TREE: canonical row for the recursive object-invocation documentation tree.

INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'OIP_TREE',
  'http',
  'GET https://miscsubjects.com/api/dispatch?map=1&format=markdown',
  'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
  '# WHAT: Return the recursive Object Invocation Protocol tree: root documents, API/CLI/MCP/device/model/core shelves, generated system articles, generated capability articles, ledgers, receipts, replay, repair, and token explanation surfaces.
# WHEN_TO_USE: the owner or a model asks for the OIP tree, object invocation protocol docs, capability map, machine-native API tree, API/CLI/MCP documentation, or how to start from one self-explaining root and discover the whole action surface.
# ARGS: none
# EX: [OIP_TREE][/OIP_TREE]',
  'oip',
  1,
  1,
  5,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type,
  target=excluded.target,
  auth=excluded.auth,
  content=excluded.content,
  category=excluded.category,
  enabled=excluded.enabled,
  planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank,
  updated_at=excluded.updated_at;

INSERT OR IGNORE INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note)
VALUES
('ROUTER','e2e','show me the object invocation protocol tree',2,'route_ok','OIP_TREE','Routes OIP tree/doc requests to OIP_TREE.','oip tree route'),
('ROUTER','e2e','where are the api cli mcp docs',2,'route_ok','OIP_TREE','Routes API/CLI/MCP documentation tree requests to OIP_TREE.','oip tree api cli mcp route');
