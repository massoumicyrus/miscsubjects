-- Remove stale rows for deleted directory keys; align Stripe write gate test.

DELETE FROM directory_tests WHERE id = 51 AND key = 'SHARED_LAW';
DELETE FROM directory_tests WHERE id = 13 AND key = 'TOOLS_SEARCH';
DELETE FROM directory_tests WHERE id IN (74, 75, 76) AND key = 'ROUTER';

UPDATE directory_tests SET key = 'TOOLS_IN', args = 'stripe|5', note = 'was TOOLS_SEARCH (removed)'
  WHERE id = 12;

UPDATE directory_tests SET expect_kind = 'startswith', expect_value = 'ERR:watcher:denied'
  WHERE id = 66 AND key = 'STRIPE_WRITE';

-- ROUTER agent-route rows 45-47 duplicated e2e route_ok tests 197/198/205; removed from mechanical bank.
DELETE FROM directory_tests WHERE id IN (45, 46, 47) AND key = 'ROUTER' AND kind = 'agent-route';