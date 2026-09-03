-- Model-row questions should use bounded row reads, not full directory dumps.
UPDATE directory
SET content = replace(
  content,
  '- what models can you call → [DIR_LIST][/DIR_LIST] and read the agent rows',
  '- what models can you call / model agent rows → [DIR_GET]ASK_CLAUDE[/DIR_GET] [DIR_GET]ASK_GPT[/DIR_GET] [DIR_GET]ASK_GEMINI[/DIR_GET] [DIR_GET]ASK_KIMI[/DIR_GET], then reply with those row keys and targets. Do not dump full DIR_LIST for this.'
),
updated_at = datetime('now')
WHERE key = 'ROUTER'
  AND instr(content, '- what models can you call → [DIR_LIST][/DIR_LIST] and read the agent rows') > 0;

UPDATE directory_tests
SET args = 'what models can you call',
    expected_text = 'Names real model-call rows ASK_CLAUDE, ASK_GPT, ASK_GEMINI, and ASK_KIMI with their targets; does not dump the full directory.'
WHERE kind = 'e2e'
  AND key = 'ROUTER'
  AND note = 't2 models'
  AND args = 'use DIR_LIST or DIR_GET and name the model agent rows you can call (ASK_CLAUDE, ASK_GPT, ASK_GEMINI, ASK_KIMI, etc)';
