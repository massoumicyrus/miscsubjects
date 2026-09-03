INSERT OR IGNORE INTO directory_tests
  (id, key, kind, args, expect_kind, expect_value, note, tier)
VALUES
  (
    373,
    'ROUTER',
    'e2e',
    'When creating a directory capability, may POST skip the hygiene checks that PUT and PATCH use, or validate sensitive/runner and then drop those fields?',
    'reply_ok',
    'No|same hygiene gate|description|schema|example|persist|sensitive|runner',
    'rule: every directory creation/update path shares one hygiene gate and persists the fields it validates.',
    8
  );
