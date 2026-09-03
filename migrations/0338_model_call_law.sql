
INSERT INTO laws (key, level, category, rule, rationale, binding_on, added_by, added_at, enabled)
VALUES (
  'MODEL_CALL_LAW',
  'immutable',
  'model_calls',
  'A system prompt is a directory row, never a string in code. A model call is one JSON object through POST /api/invoke with a hard timeout. Batches run in parallel in one round trip. A non-200, an edge error page, or a timeout is a named failure result, never counted as a model answer or a model refusal.',
  'Prompts in JavaScript forced a deploy per wording change: ~40 minutes of polling bought ~18 seconds of model time, and 6 of 18 calls in the triggering run were Cloudflare error pages logged as model silence.',
  '["all"]',
  'owner',
  '2026-07-30T00:00:00.000Z',
  1
)
ON CONFLICT(key) DO UPDATE SET rule=excluded.rule, rationale=excluded.rationale, enabled=1;

INSERT INTO laws (key, level, category, rule, rationale, binding_on, added_by, added_at, enabled)
VALUES (
  'SYSTEM_PROMPT_FORM_LAW',
  'immutable',
  'model_calls',
  'A system prompt is written as numbered clauses in a Boolean precedence tree, lower numbers winning, with the precedence stated inside the prompt. No decorative language. Every clause must be testable — a clause no output can violate is deleted. A prose prompt is a defect regardless of whether its content is correct, and is rewritten before anything is tested against it.',
  'A prose constitution with ambiguous tokens produced a measurement run whose results were not publishable and not citable.',
  '["all"]',
  'owner',
  '2026-07-30T00:00:00.000Z',
  1
)
ON CONFLICT(key) DO UPDATE SET rule=excluded.rule, rationale=excluded.rationale, enabled=1;

-- Router tests: the law has to be answerable, not just stored.
DELETE FROM directory_tests WHERE note IN (
  'model call law 2026-07-30: prompts live in the directory',
  'model call law 2026-07-30: batches run in parallel, never polled'
);

INSERT INTO directory_tests (key, kind, args, expect_kind, expect_value, note, expected_text, tier)
VALUES (
  'ROUTER', 'e2e',
  'Where does a system prompt live, and how do you change its wording?',
  'reply_ok', 'directory|row|/api/directory|/admin/prompts|not in code',
  'model call law 2026-07-30: prompts live in the directory',
  'In the directory table, as a row. Change it with PATCH /api/directory/<key> or at /admin/prompts/<key>. Never by editing code and deploying.',
  9
);

INSERT INTO directory_tests (key, kind, args, expect_kind, expect_value, note, expected_text, tier)
VALUES (
  'ROUTER', 'e2e',
  'You need 100 model replies over 100 rows of a spreadsheet. What do you run?',
  'reply_ok', 'invoke|parallel|one request|inputs|batch',
  'model call law 2026-07-30: batches run in parallel, never polled',
  'One POST /api/invoke with {"key":"<row>","inputs":[...100 rows...]}. Every call is in flight at once — one round trip, about a second. No loop, no polling, no waiting on a job.',
  9
);
