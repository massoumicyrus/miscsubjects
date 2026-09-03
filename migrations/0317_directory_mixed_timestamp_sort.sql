DELETE FROM directory_tests WHERE note='owner correction 2026-07-21: directory parses mixed timestamp formats';
INSERT INTO directory_tests
  (key, kind, args, expect_kind, expect_value, note, expected_text, tier)
VALUES
  (
    'ROUTER',
    'e2e',
    'Why did Directory newest-added sometimes put an older row above a newer row, and what blocks that regression?',
    'reply_ok',
    'timestamp|string|ISO|SQLite|parse|time|release gate',
    'owner correction 2026-07-21: directory parses mixed timestamp formats',
    'The old UI compared mixed ISO-T and SQLite-space timestamp strings. It now parses UTC, offset, ISO, and SQLite timestamps into time values before sorting. The protected checker requires that parser.',
    8
  );
