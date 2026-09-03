
DELETE FROM directory_tests WHERE kind='e2e' AND note='agents must use available access instead of claiming ignorance';
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'The agent says "I don\'t have access to previous sessions." What is wrong with this statement?',
  'reply_ok','ledger|session logs|MCP|D1|KV|R2|LOCAL_EXEC|full access|violation',
  'agents must use available access instead of claiming ignorance',
  'The agent has full access to the ledger, session logs, D1, KV, R2, GitHub, and the local computer. Claiming lack of access is an ACCESS AWARENESS LAW violation.',
  8
);
