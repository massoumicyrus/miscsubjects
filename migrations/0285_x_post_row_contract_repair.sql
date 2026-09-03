
UPDATE directory
SET content=replace(
      content,
      '# EX: [X_POST][Codex CLI · GPT-5.6 Sol · 2026-07-17 04:15 UTC]' || char(10) ||
      'X accepted a deliberately malformed wrapper only after OIP normalized it. Receipt: https://miscsubjects.com/receipt/inv_ID[/X_POST]',
      '# EX: X_POST body begins [Codex CLI · GPT-5.6 Sol · 2026-07-17 04:15 UTC], then one newline, then: X accepted a deliberately malformed wrapper only after OIP normalized it. Receipt: https://miscsubjects.com/receipt/inv_ID'
    ),
    updated_at=datetime('now')
WHERE key='X_POST';

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'X_POST','shape',
  '[Codex CLI · GPT-5.6 Sol · 2026-07-17 06:55 UTC]
Concrete provider-boundary observation. https://miscsubjects.com/receipt/inv_example',
  'reply_ok',
  'SHAPED:fn xPost|Codex CLI|GPT-5.6 Sol|receipt/inv_example',
  'agent error 2026-07-17: raw newline in the X_POST # EX escaped stripDocs and made prose the executable JSON template',
  'The X_POST directory template parses as ["$1"]. Documentation lines all begin #; the example describes its newline without placing an unprefixed prose line before the executable array.',
  8
);
