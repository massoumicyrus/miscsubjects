-- 0227 — DB. PROSECUTOR_RUN: a machine runs the operator loop itself — reads thread-state
-- + drop, contributes only new load, posts to the bus. Machines govern machines.
INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'PROSECUTOR_RUN',
  'fn',
  'prosecutorRun',
  '',
  '# WHAT: One machine turn of the operator loop, end to end: fetch the drop + current accepted thread-state, ask a model for ONE materially new point (inheriting all accepted state, never repeating it), and post the result to the thread bus as a proposed update. Replies NOTHING NEW when the state already covers everything it sees.
# WHEN_TO_USE: the owner says "prosecute the protocol", "run the loop", "have a machine critique it" — or the governor wants fresh adversarial load without any human transport.
# ARGS: model key (optional; default ASK_CLAUDE — also ASK_GPT / ASK_GEMINI / ASK_KIMI)
# EX: [PROSECUTOR_RUN]ASK_KIMI[/PROSECUTOR_RUN]
["$1"]',
  'governance', 1, 1, 25, datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth, content=excluded.content,
  category=excluded.category, enabled=excluded.enabled, planner_visible=excluded.planner_visible,
  planner_rank=excluded.planner_rank, updated_at=excluded.updated_at;
