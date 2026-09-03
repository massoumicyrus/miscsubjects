-- Model growth queue — automated populate/collaborate/repair/reflex
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'GRAPH_GROW',
  'fn',
  'protoGraphGrow',
  '',
  '# WHAT: Run one model growth queue tick — populate sources, Kimi, Gemini, repair, reflex.
# WHY: Models continuously add articles, sources, features without manual orchestration.
# WHEN_TO_USE: cron, after deploy, proactive graph enrichment.
# ARGS: optional slug|step   e.g. bpc-157|kimi_collaborate
# EX: [GRAPH_GROW][/GRAPH_GROW]  or  [GRAPH_GROW]tb-500[/GRAPH_GROW]
["$1"]',
  'content',
  46,
  1,
  1,
  datetime('now')
);

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'OBSIDIAN_PULL',
  'fn',
  'protoObsidianPull',
  '',
  '# WHAT: Pull Obsidian vault export to local folder (via LOCAL_EXEC).
# ARGS: optional slugs comma-separated
# EX: [OBSIDIAN_PULL]protocol,bpc-157[/OBSIDIAN_PULL]
["$1"]',
  'content',
  47,
  1,
  1,
  datetime('now')
);