-- Kimi collaborator #1 — multi-model ledger writeback
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'KIMI_COLLABORATE',
  'fn',
  'protoCollaborate',
  '',
  '# WHAT: Kimi reads article topology and posts tier-honest claims + optional adversary challenge — collaborator #1 (not Grok).
# WHEN_TO_USE: multi-model enrichment, explicit gaps, first external model writeback to ledger.
# ARGS: slug   e.g. bpc-157
# EX: [KIMI_COLLABORATE]bpc-157[/KIMI_COLLABORATE]
["$1"]',
  'content',
  43,
  1,
  1,
  datetime('now')
);