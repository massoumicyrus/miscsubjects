-- Self-test scoreboard honesty: partial runs are progress, not build scores.
DELETE FROM directory_tests WHERE kind='e2e' AND note='t5 selftest scoreboard honesty';
INSERT INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note) VALUES
('ROUTER', 'e2e', 'when the self-test page shows a batched run at 100 percent, is that the build score', 5, 'reply_ok', 'no|batched|complete|build score|progress', 'The build says no: only note=complete is a build score; batched rows are progress and must be labeled separately.', 't5 selftest scoreboard honesty');
