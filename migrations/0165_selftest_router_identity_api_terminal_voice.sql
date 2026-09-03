-- Add scored checks for ROUTER identity, API/terminal explanations, and non-generic voice.
DELETE FROM directory_tests
WHERE kind='e2e'
  AND note IN (
    't4 api exact miscsubjects',
    't4 terminal exact bridge',
    't5 identity capability surface',
    't5 literal voice identity',
    't5 generic-grok complaint',
    't5 text-to-reply path',
    't5 selftest repair law'
  );

INSERT INTO directory_tests (key, kind, args, tier, expect_kind, expect_value, expected_text, note) VALUES
('ROUTER','e2e','how do I use the miscsubjects API',4,'reply_ok','/api/dispatch|/api/directory|/api/manual|x-terminal-key','Exact REST shapes for this build, not generic REST advice.','t4 api exact miscsubjects'),
('ROUTER','e2e','how do I run a terminal command on my Mac through you',4,'reply_ok','/t|LOCAL_EXEC|Mac|bridge|stdout|stderr','Exact terminal path: /t or LOCAL_EXEC through the Mac bridge.','t4 terminal exact bridge'),
('ROUTER','e2e','what are you and what can you actually do',5,'reply_ok','miscsubjects|build|router|directory|ledger|tool','Build identity plus live capability surface, not generic Grok identity.','t5 identity capability surface'),
('ROUTER','e2e','answer in literal non decorative language: what are you',5,'reply_ok','miscsubjects|build|router|directory|ledger','Literal operational build identity with no assistant filler.','t5 literal voice identity'),
('ROUTER','e2e','you are answering like generic Grok and it is bad',5,'reply_ok','router|prompt|ledger|self-test|fix|build','Treat owner style complaint as a build bug and repair loop.','t5 generic-grok complaint'),
('ROUTER','e2e','what is the exact path from my text to your reply',5,'reply_ok','iMessage|Blooio|ROUTER|dispatch|directory|ledger|reply','End-to-end turn topology in build terms.','t5 text-to-reply path'),
('ROUTER','e2e','what should happen when a self-test question fails',5,'reply_ok','ledger|directory|row|prompt|retest','Self-test failure becomes smallest-layer repair, then retest.','t5 selftest repair law');
