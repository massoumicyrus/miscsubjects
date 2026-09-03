-- OIP v0.1 directory rows (loop-content-spine).

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, runner, updated_at)
VALUES (
  'OIP_PROTOCOL',
  'fn',
  'oipProtocol',
  '',
  '# WHAT: Object Invocation Protocol index — endpoints, schema, invariant loop.
# WHEN_TO_USE: cold bootstrap for any client; what is OIP and how to invoke objects.
# ARGS: none
# EX: [OIP_PROTOCOL][/OIP_PROTOCOL]
[" "]',
  'directory',
  44,
  1,
  1,
  'edge',
  datetime('now')
);

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, runner, updated_at)
VALUES (
  'OIP_REGISTRY',
  'fn',
  'oipRegistry',
  '',
  '# WHAT: Full OIP object registry from directory rows (type, runner, read/write paths, schemas).
# WHEN_TO_USE: list invokable objects; category filter optional.
# ARGS: category (optional)
# EX: [OIP_REGISTRY][/OIP_REGISTRY] or [OIP_REGISTRY]protocol[/OIP_REGISTRY]
["$1"]',
  'directory',
  44,
  1,
  1,
  'edge',
  datetime('now')
);