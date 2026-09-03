-- Gemini collaborator #2 — cheap pass after Kimi
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'GEMINI_COLLABORATE',
  'fn',
  'protoGeminiCollaborate',
  '',
  '# WHAT: Cheap Gemini reads article topology and posts tier-honest claims — collaborator #2 (after Kimi).
# WHEN_TO_USE: second-model enrichment, gap-filling, adversary challenge after Kimi pass.
# ARGS: slug   e.g. bpc-157
# EX: [GEMINI_COLLABORATE]bpc-157[/GEMINI_COLLABORATE]
["$1"]',
  'content',
  44,
  1,
  1,
  datetime('now')
);