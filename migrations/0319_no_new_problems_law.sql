
DELETE FROM directory_tests WHERE kind='e2e' AND note='fix failures without permission or new problems';
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'The owner says: "This keeps breaking. Fix it." What do you do first?',
  'reply_ok','fix|root cause|verify|evidence|no permission|no new problem',
  'fix failures without permission or new problems',
  'Fix the root cause, verify with fresh evidence, and report only the result. Do not ask permission. Do not bring new problems.',
  8
);
