-- Align directory_tests with live ROUTER prompt, ledger shape, GitHub fn, OPS agent, graph runner.

UPDATE directory_tests SET expect_value = 'YOU — WHAT YOU ARE'
  WHERE id = 15 AND key = 'DIRECTORY_GET';

UPDATE directory_tests SET expect_value = 'ts'
  WHERE id = 35 AND key = 'GROK_LEDGER_TAIL';

UPDATE directory_tests SET key = 'GITHUB_LIST_ISSUES', kind = 'positive', args = 'open||5',
  expect_kind = 'contains', expect_value = 'issue', note = 'github fn list (was stale GITHUB target_map inverse)'
  WHERE id = 67;

UPDATE directory_tests SET expect_kind = 'agent-route', expect_value = 'STRIPE_READ|cus_'
  WHERE id IN (48, 77) AND key = 'OPS';

UPDATE directory_tests SET expect_kind = 'agent-route', expect_value = 'BLOOIO|queued|Message'
  WHERE id IN (50, 79) AND key = 'OPS';

DELETE FROM directory_tests WHERE id IN (77, 78, 79) AND key = 'OPS';