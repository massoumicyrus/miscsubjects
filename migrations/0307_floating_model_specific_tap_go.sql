-- Owner correction 2026-07-21: floating token Tap & Go visibly exposes all five model variants.
DELETE FROM directory_tests WHERE kind='e2e' AND note='owner correction 2026-07-21: floating token tap go model specific';
INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier) VALUES
('ROUTER','e2e','Which model-specific token Tap & Go controls appear in the floating admin panel?','reply_ok','ChatGPT|Claude|Grok|Gemini|Kimi|read|edit|model=','owner correction 2026-07-21: floating token tap go model specific','The floating panel has explicit ChatGPT, Claude, Grok, Gemini, and Kimi buttons for both read and edit token DROPs. Each control passes model=MODEL into that model owner-profile slot. The build-audit DROP remains generic.','8');
