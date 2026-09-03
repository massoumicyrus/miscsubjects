DELETE FROM directory_tests WHERE note='owner correction 2026-07-21: one comparison axis registry';
INSERT INTO directory_tests
  (key, kind, args, expect_kind, expect_value, note, expected_text, tier)
VALUES
  (
    'ROUTER',
    'e2e',
    'Do the build audit, article rules, comparison table, and queued outside research use different comparison axes?',
    'reply_ok',
    'same|shared|axis|article|audit|comparison|queue',
    'owner correction 2026-07-21: one comparison axis registry',
    'No. They read one shared software comparison axis registry. Legacy axis names normalize to the shared names so existing source-backed claims remain visible.',
    8
  );
