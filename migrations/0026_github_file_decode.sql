-- 0026: GITHUB_GET_FILE returns decoded plain text (fn githubFile) instead of base64,
-- so CODER reads real source. Arg in content template is the file path.
UPDATE directory
SET type='fn', target='githubFile', auth='',
    content='# Full decoded contents of one repo file (plain text). Arg: path relative to repo root, e.g. functions/api/dispatch.js.
["$1"]',
    updated_at=datetime('now')
WHERE key='GITHUB_GET_FILE';
