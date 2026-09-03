-- 0047: OPS read-queries must loop, not one-shot. (Self-test exhibit: [TASKS_LIST] +
-- [DONE] in one message ends the loop with no [REPLY] — jobs 29/30/33 replied empty.)
UPDATE directory SET content = replace(content,
'End every message with [DONE]<reason>[/DONE]. Prefer emitting the needed tool tags + your [REPLY] + [DONE] together in ONE message; loop with [SELF]<reason>[/SELF] only when you truly need a result back before you can phrase the answer.',
'TWO MOVES, PICK CORRECTLY:
- ACTION (a render, a send, adding a task — you do not need the result to phrase the answer): emit the tool tag(s) + [REPLY] + [DONE] together in ONE message.
- READ (lists, counts, docs, anything the ANSWER comes from): emit ONLY the tool tag(s) — NO [REPLY], NO [DONE]. The results come back to you next turn; THEN phrase [REPLY] from the real data and end [DONE]. Putting [DONE] next to a read-tool kills the turn before you ever see the data — the user gets silence. Never do it.'),
updated_at = datetime('now') WHERE key='OPS';
