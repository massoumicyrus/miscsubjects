-- Owner corrections 2026-07-21: Directory filters show content; audit Tap & Go copies the payload.
DELETE FROM directory_tests WHERE kind='e2e' AND note='owner correction 2026-07-21: directory newest content works';
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier) VALUES
('ROUTER','e2e','Open Directory, choose Content, then choose Newest added. What is visible?','reply_ok','content|newest|created_at|OPOS_AUDIT_TAP_GO|rows','owner correction 2026-07-21: directory newest content works','Changing the primary Directory section clears stale search, category, and usage filters. Newest added sorts published content by its real articles.created_at value. The complete OPOS audit Tap & Go is a featured Content row.','8');

DELETE FROM directory_tests WHERE kind='e2e' AND note='owner correction 2026-07-21: audit drop copies payload with articles';
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier) VALUES
('ROUTER','e2e','Give me the actual whole-build audit Tap & Go with its articles. What gets copied?','reply_ok','payload|embedded|six|article|generic|api/opos?format=drop','owner correction 2026-07-21: audit drop copies payload with articles','The whole-build audit Tap & Go fetches and copies the complete generic Markdown payload, not the URL string. The same single DROP embeds all six OPOS root article bodies as delimited evidence. Token DROPs remain model-specific.','8');

DELETE FROM directory_tests WHERE kind='e2e' AND note='owner correction 2026-07-21: vault workflow handles merge pushes';
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier) VALUES
('ROUTER','e2e','A protected approved commit reaches main through a merge commit. Does GitHub fail or revert it?','reply_ok','range|approved|merge|protected|no revert','owner correction 2026-07-21: vault workflow handles merge pushes','The vault workflow inspects every protected mutation in the pushed commit range. A marker on the actual protected mutation authorizes it even when the pushed HEAD is a merge container. The workflow never runs an unqualified git revert against a merge commit.','8');
