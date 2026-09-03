-- CLI_* with args|cwd: dispatch splits on | so $1=task $2=cwd.
-- $1+ rejoins task|cwd into shell (git status|/path → pipe to directory) → exit 126.
-- Fix: use $1 only when $2 holds cwd separately.
UPDATE directory SET content = REPLACE(content, '$1+\"],\"timeout\":120000}', '$1\"],\"timeout\":120000}'),
  updated_at = datetime('now')
WHERE key LIKE 'CLI_%'
  AND content LIKE '%cd \"%2%'
  AND content LIKE '%$1+%';