DELETE FROM directory_tests WHERE kind='e2e' AND note='floating tap go clears header';
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier) VALUES
('ROUTER','e2e','Where does the floating Owner Tap & Go sit, and what happens when its panel opens?','reply_ok','bottom-right|opens upward|viewport|top-right|clear','floating tap go clears header','The floating pill sits at the bottom-right. Its panel opens upward and scrolls inside the viewport. The top-right admin header and its controls remain clear.','8');
