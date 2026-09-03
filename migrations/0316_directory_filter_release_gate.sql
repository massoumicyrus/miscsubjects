DELETE FROM directory_tests WHERE note='directory filters remain usable';
INSERT INTO directory_tests
  (key, kind, args, expect_kind, expect_value, note, expected_text, tier)
VALUES
  (
    'ROUTER',
    'e2e',
    'What protects the Directory filters from breaking again?',
    'reply_ok',
    'newest|time|search|type|category|usage|200|page|release gate',
    'directory filters remain usable',
    'The protected Directory defaults to newest-added with visible date and time, searches name, target, category, type, and href, applies type/category/usage/sort together, and renders 200 matching rows per page. The deterministic release checker blocks regressions.',
    8
  );
