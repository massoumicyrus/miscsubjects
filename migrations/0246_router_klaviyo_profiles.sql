-- Klaviyo profile count questions must use the live Klaviyo row.
UPDATE directory
SET content = replace(
  content,
  '- my arcads credit balance → [ARCADS_CREDITS][/ARCADS_CREDITS]',
  '- my arcads credit balance → [ARCADS_CREDITS][/ARCADS_CREDITS]' || char(10) ||
  '- Klaviyo profile count / how many Klaviyo profiles → [KLAVIYO]profiles[/KLAVIYO], then count the returned data array or report the API total if present. Never say no access before checking this row.'
),
updated_at = datetime('now')
WHERE key = 'ROUTER'
  AND instr(content, 'Klaviyo profile count / how many Klaviyo profiles') = 0
  AND instr(content, '- my arcads credit balance → [ARCADS_CREDITS][/ARCADS_CREDITS]') > 0;
