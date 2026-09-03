-- KLAVIYO_PROFILES is a stale agent stub that calls the wrong provider. ROUTER
-- already maps profile questions to the working KLAVIYO profiles operation.

UPDATE directory SET
  type = 'fn',
  target = 'noop',
  auth = '',
  enabled = 0,
  planner_visible = 0,
  content = 'DISABLED: stale provider stub. Use [KLAVIYO]profiles[/KLAVIYO] and report the returned page count/next-page state.',
  updated_at = datetime('now')
WHERE key = 'KLAVIYO_PROFILES';
