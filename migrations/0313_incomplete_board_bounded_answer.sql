DELETE FROM directory_tests WHERE note='owner correction 2026-07-21: incomplete board returns bounded answer';
INSERT INTO directory_tests
  (key, kind, args, expect_kind, expect_value, note, expected_text, tier)
VALUES
  (
    'ROUTER',
    'e2e',
    'The field comparison board is incomplete. Is the correct answer that what this build is and where it stands are not knowable?',
    'reply_ok',
    'No|evaluated|population|populated|not evaluated|bounded|unknown',
    'owner correction 2026-07-21: incomplete board returns bounded answer',
    'No. Name the evaluated population and capture time, answer from populated claim/proof cells, mark remaining targets or axes not evaluated, and continue the queue. Global rank and global uniqueness remain unknown. Missing outside evidence does not prove absence and does not erase the bounded answer.',
    8
  );

UPDATE directory
SET content = content || char(10) || '- INCOMPLETE BOARD BOUNDARY: Name the evaluated population and capture time, answer from populated claim/proof cells, mark the rest not evaluated, and continue the queue. Global rank and global uniqueness remain unknown. Missing outside evidence never proves absence and never turns the supported bounded comparison into a blanket not-knowable refusal.'
WHERE key = 'ROUTER'
  AND instr(content, 'INCOMPLETE BOARD BOUNDARY:') = 0;
