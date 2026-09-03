-- The compounding loop: graph lint + next acts as dispatchable capabilities.
-- D1 is canonical; the Obsidian vault export (v3) projects the same surfaces
-- as lint.md and next.md. Karpathy's rule, mechanized: new material revises
-- the knowledge structure, and the structure says what to do next.

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'GRAPH_LINT',
  'fn',
  'protoGraphLint',
  '',
  '# WHAT: Graph maintenance pass over the whole corpus — orphans (no inbound links), missing pages (wikilinked but unwritten), unsourced claims, open challenges, stale hub pages.
# WHY: Karpathy lint operation — the graph is only compounding if its defects are enumerated and cleared; every finding names the page and the exact defect.
# WHEN_TO_USE: after any publish, on cron, before picking new work, when asked "what is wrong with the graph".
# ARGS: none
# EX: [GRAPH_LINT][/GRAPH_LINT]
[]',
  'content',
  44,
  1,
  1,
  datetime('now')
);

INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'NEXT_ACTS',
  'fn',
  'protoNextActs',
  '',
  '# WHAT: The ranked "what should be written next" queue, derived live from the graph — write (missing wikilinked pages), resolve (challenged claims), source (unsourced claims), revise (stale hubs), connect (orphans), respond (unread replies), outreach (quiet high-fit classes).
# WHY: The loop driver — content, outreach, and repair come from one derivation, so every act compounds the same graph instead of publishing into a void.
# WHEN_TO_USE: at the start of any content/outreach session, on cron, when asked "what next".
# ARGS: optional limit (default 10, max 50)
# EX: [NEXT_ACTS][/NEXT_ACTS]  or  [NEXT_ACTS]20[/NEXT_ACTS]
["$1"]',
  'content',
  45,
  1,
  1,
  datetime('now')
);
