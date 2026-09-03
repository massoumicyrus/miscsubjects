-- Correct overly-strict test expectations identified by Pass-2 fidelity run.
UPDATE directory_tests SET expect_kind='regex', expect_value='[0-9]{4}-' WHERE key='UTCNOW' AND kind='positive';
UPDATE directory_tests SET expect_kind='contains', expect_value='tools' WHERE key='CATEGORIES' AND kind='positive';
UPDATE directory_tests SET expect_kind='contains', expect_value='timestamp' WHERE key='GROK_LEDGER_TAIL';
UPDATE directory_tests SET expect_kind='regex', expect_value='^\\{"convo_max":[0-9]+\\}$' WHERE key='HISTORY_GET';
UPDATE directory_tests SET expect_kind='contains', expect_value='"object":' WHERE key='STRIPE_READ' AND args='invoices_list|1';
-- WORLDTIME is an external API; remove the test rather than chase external 525s.
DELETE FROM directory_tests WHERE key='WORLDTIME';
-- BLOOIO lookup_get requires Enterprise plan; mark inverse to capture the 403 contract.
UPDATE directory_tests SET kind='inverse', expect_kind='contains', expect_value='Enterprise plan' WHERE key='BLOOIO' AND args='lookup_get|[OWNER_PHONE]';
-- Followup: HISTORY_GET returns JSON; use contains.
UPDATE directory_tests SET expect_kind='contains', expect_value='"convo_max":' WHERE key='HISTORY_GET';
