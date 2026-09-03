-- Selftest: fix broken questions, add emoji/prompt-blocks/reflex coverage, tighten CLI_SPAWN tier-7.

-- Tier 2: force tool use on questions ROUTER keeps answering with tool-count spam
UPDATE directory_tests SET
  args = 'use DIR_LIST or DIR_GET and name the model agent rows you can call (ASK_CLAUDE, ASK_GPT, ASK_GEMINI, ASK_KIMI, etc)',
  expect_value = 'ASK_|claude|gpt|gemini|kimi|agent',
  expected_text = 'Name real agent rows / models from directory, not a tool count.'
WHERE kind = 'e2e' AND id = 132;

UPDATE directory_tests SET
  args = 'use DIR_GET on the ARTICLES row and quote its target and args template',
  expect_value = 'ARTICLES|article|get|list|http|target|fn',
  expected_text = 'DIR_GET ARTICLES row definition.'
WHERE kind = 'e2e' AND id = 166;

UPDATE directory_tests SET
  args = 'read the ledger for today and summarize what changed on the build',
  expect_value = 'ledger|event|deploy|commit|today|trace|router',
  expected_text = 'Ledger-based summary of today''s build activity.'
WHERE kind = 'e2e' AND id = 136;

UPDATE directory_tests SET
  args = 'what is the directory table and why does this build use it instead of hardcoding tools',
  expect_value = 'directory|syscall|tool|row|registry|capabilit|anti|sprawl',
  expected_text = 'Directory = syscall table / capability registry; not just a count.'
WHERE kind = 'e2e' AND id = 142;

-- Tier 3
UPDATE directory_tests SET
  args = 'use the R2 list tool and tell me what objects exist (or that the bucket is empty)',
  expect_value = 'r2|object|bucket|key|none|empty|list',
  expected_text = 'Real R2 inventory.'
WHERE kind = 'e2e' AND id = 174;

UPDATE directory_tests SET
  args = 'KV_PUT selftest_ping to ok then KV_GET selftest_ping and report the value',
  expect_value = 'ok|selftest_ping|kv',
  expected_text = 'KV round-trip returns ok.'
WHERE kind = 'e2e' AND id = 175;

UPDATE directory_tests SET
  args = 'run gh repo list on my Mac via LOCAL_EXEC and list my github repos',
  expect_value = 'repo|github|miscsubjects|[OWNER_SURNAME]',
  expected_text = 'Real gh repo list output.'
WHERE kind = 'e2e' AND id = 176;

UPDATE directory_tests SET
  args = 'what was the last pages deploy — check ledger or wrangler pages deployment list',
  expect_value = 'deploy|deployment|pages|commit|wrangler|loop-safe',
  expected_text = 'Real last deploy info.'
WHERE kind = 'e2e' AND id = 181;

UPDATE directory_tests SET
  args = 'explain how one iMessage turn flows from blooio webhook through ROUTER dispatch to reply',
  expect_value = 'blooio|webhook|router|dispatch|tool|reply|trace',
  expected_text = 'End-to-end turn pipeline in build terms.'
WHERE kind = 'e2e' AND id = 158;

UPDATE directory_tests SET
  args = 'explain the difference between raw ledger events and an assembled state card for one turn',
  expect_value = 'ledger|event|card|state|turn|trace|assemble',
  expected_text = 'Events=firehose; state card=one turn assembled.'
WHERE kind = 'e2e' AND id = 159;

UPDATE directory_tests SET
  args = 'list the Cloudflare bindings this Pages project has (D1, KV, R2, AI, etc)',
  expect_value = 'd1|kv|r2|ai|binding|pages|worker',
  expected_text = 'Real bindings list from inventory or wrangler.'
WHERE kind = 'e2e' AND id = 184;

-- Tier 4
UPDATE directory_tests SET
  args = 'use LOCAL_SAY to speak the word hello out loud on my Mac',
  expect_value = 'hello|said|spoke|LOCAL_SAY|audio|osascript',
  expected_text = 'LOCAL_SAY or audio output confirmed.'
WHERE kind = 'e2e' AND id = 180;

UPDATE directory_tests SET
  args = 'look up customer by email test@example.com using the customer lookup tool',
  expect_value = 'customer|email|test@example|lookup|not found|none',
  expected_text = 'Customer lookup result for test@example.com.'
WHERE kind = 'e2e' AND id = 187;

-- Tier 6
UPDATE directory_tests SET
  args = 'fetch https://miscsubjects.com/admin/selftest and tell me if the page loads (status and title)',
  expect_value = 'self|test|200|admin|html|render|load',
  expected_text = 'Real fetch of /admin/selftest.'
WHERE kind = 'e2e' AND id = 145;

-- Tier 7: CLI_SPAWN mode contract
UPDATE directory_tests SET
  args = 'spawn a readonly kimi agent via CLI_SPAWN to audit the lowest-scoring self-test failure — mode must be readonly',
  expect_value = 'CLI_SPAWN|kimi|readonly|spawn|agent',
  expected_text = 'CLI_SPAWN with mode=readonly, not invalid mode.'
WHERE kind = 'e2e' AND id = 146;

UPDATE directory_tests SET
  args = 'spawn readonly kimi via CLI_SPAWN to audit functions/api/dispatch.js for floating promises',
  expect_value = 'CLI_SPAWN|kimi|readonly|dispatch',
  expected_text = 'CLI_SPAWN readonly audit of dispatch.js.'
WHERE kind = 'e2e' AND id = 147;

UPDATE directory_tests SET
  args = 'spawn readonly kimi via CLI_SPAWN to list the three biggest risks in functions/blooio.js',
  expect_value = 'CLI_SPAWN|kimi|readonly|blooio',
  expected_text = 'CLI_SPAWN readonly audit of blooio.js.'
WHERE kind = 'e2e' AND id = 148;

-- New feature coverage: emoji blocks, reactions, reflex
INSERT INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note) VALUES
('ROUTER','e2e','what does a dislike tapback on your prior message mean I want you to do',3,'reply_ok','dislike|reject|ledger|diagnose|fix|BLOCK_EMOJI|reflex','Thumbs-down = reject; read ledger, diagnose, fix or escalate.','t3 emoji dislike signal'),
('ROUTER','e2e','what should BLOCK_EMOJI teach you about like and question tapbacks',3,'reply_ok','emoji|tapback|like|question|approve|explain|BLOCK_EMOJI','BLOCK_EMOJI covers tapback vocabulary.','t3 BLOCK_EMOJI knowledge'),
('ROUTER','e2e','how do blooio emoji reactions reach the build webhook',4,'reply_ok','reaction|webhook|message.reaction|blooio|emoji|reacted','Reaction webhook path into ROUTER.','t4 reaction intake'),
('ROUTER','e2e','when I thumbs-down a bad answer what reflex path should run',4,'reply_ok','reflex|CLI_REFLEX|dislike|reject|diagnose|kimi','Reject triggers issue reflex / CLI diagnosis.','t4 reflex on reject'),
('ROUTER','e2e','route terminal infra work only do not execute: wrangler deploy from repo',4,'route_ok','TERMINUS','Route heavy terminal to TERMINUS.','t4 route terminus');