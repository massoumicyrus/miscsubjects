-- Owner correction: recurring article generation/editing and self-testing remain off.
DELETE FROM directory_tests
WHERE kind = 'e2e' AND note = 't5 owner automation shutdown lock';

INSERT INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note)
VALUES (
  'ROUTER',
  'e2e',
  'Are automatic background article writing, editing, and self-testing enabled?',
  5,
  'reply_ok',
  'off|disabled|locked|not enabled',
  'They are off and locked; no background article writer, editor, or self-test run may restart itself.',
  't5 owner automation shutdown lock'
);
