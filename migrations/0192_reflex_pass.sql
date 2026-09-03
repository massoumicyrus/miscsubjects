-- Reflex pass — graph proves its own shape against vision claims
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'REFLEX_PASS',
  'fn',
  'protoReflex',
  '',
  '# WHAT: Live probes vs protocol vision claims — posts reflex conformance atoms with proves/responds_to edges.
# WHEN_TO_USE: after collaborate/audit, continuous self-proof loop, verify build topology matches vision.
# ARGS: slug (optional, default protocol)
# EX: [REFLEX_PASS]protocol[/REFLEX_PASS]
["$1"]',
  'content',
  45,
  1,
  1,
  datetime('now')
);