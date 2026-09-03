-- Owner corrections 2026-07-21: build audit is a bounded token DROP and uses mechanism language.
UPDATE directory
SET target='GET https://miscsubjects.com/api/dispatch?tap_go=1&drop=audit',
    auth='owner',
    content='# WHAT: Mint one bounded self-explaining whole-build audit token DROP from the floating Owner Tap & Go.\n# ARGS: None. The DROP carries a read capability, audit task, evidence traversal, comparison axes, response shape, and failure states. Evidence remains retrievable instead of embedded.\n# EX: [OPOS_DROP][/OPOS_DROP]\n# TESTS: The returned DROP is 4,000–8,000 characters, contains a read capability and evidence index, excludes article bodies, and contains no obligational prompt language.',
    updated_at=datetime('now')
WHERE key='OPOS_DROP';

DELETE FROM directory_tests WHERE kind='e2e' AND note IN (
  'owner correction 2026-07-21: audit drop copies payload with articles',
  'owner correction 2026-07-21: floating admin audit copies complete payload',
  'owner correction 2026-07-21: bounded self-explaining audit token drop',
  'owner correction 2026-07-21: audit drop has no obligational language'
);
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier) VALUES
('ROUTER','e2e','In the floating Owner Tap & Go, press Audit this build. What kind of object gets copied?','reply_ok','bounded|token DROP|read capability|evidence|retriev|not embedded','owner correction 2026-07-21: bounded self-explaining audit token drop','The floating control mints and copies a bounded self-explaining read-token DROP. The DROP carries the audit task, evidence traversal, comparison method, response shape, and failure states. Article bodies and the full evidence archive remain retrievable outside the model context.','8'),
('ROUTER','e2e','What writing register does the build-audit token DROP use?','reply_ok','mechanism|state|RESPONSE SHAPE|no|required|must|need|should','owner correction 2026-07-21: audit drop has no obligational language','The audit DROP uses mechanism and acceptance-state language. Its headings include RESPONSE SHAPE, EVIDENCE FLOW, and FAILURE STATES. It contains no REQUIRED ANSWER, must, need, should, ensure, or audience-directed compliance commands.','8');
