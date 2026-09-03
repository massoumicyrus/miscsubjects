-- Conversation router: model output → ledger append + asked-and-answered gate
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at)
VALUES (
  'PROTOCOL_ROUTER',
  'fn',
  'protoRouter',
  '',
  '# WHAT: Bridge model prose to protocol atoms — gate (asked&answered) or append [CLAIM]/[QUESTION]/[INGEST] blocks.
# WHEN_TO_USE: after model generates criticism/evidence; before re-asking same question.
# ARGS: gate|slug|question  OR  append|model_output  OR  turn|slug|question|model_output
# EX: [PROTOCOL_ROUTER]gate|bpc-157|What are criticisms of BPC-157?[/PROTOCOL_ROUTER]
# EX: [PROTOCOL_ROUTER]append|[CLAIM:challenge]
slug: bpc-157
tier: human
text: Source monoculture weakens epistemic foundation.
who_claims: kimi/moonshot-v1-8k
[/CLAIM][/PROTOCOL_ROUTER]
["$1+"]',
  'content',
  46,
  1,
  1,
  datetime('now')
);