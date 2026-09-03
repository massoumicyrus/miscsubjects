-- GitHub: GitHub's REST API requires a User-Agent header. The kernel's `bearer:`
-- auth prefix doesn't add other headers. Switch to `headers:{...}` with all three.
UPDATE directory
SET auth = 'headers:{"Authorization":"Bearer $GITHUB_TOKEN","User-Agent":"miscsubjects-build","Accept":"application/vnd.github+json"}',
    updated_at = '2026-06-09T22:30:00Z'
WHERE key IN ('GITHUB_USER','GITHUB_REPO_GET','GITHUB_REPO_DISPATCH');

-- Gemini: previous body template `{"contents":$1}` required the caller to pass a
-- pre-shaped JSON array. Make the row friendlier: caller passes plain text as $1
-- and the row wraps it in the Gemini contents shape.
UPDATE directory
SET content = '# Generate text via Gemini 2.5 Flash. $1=plain text prompt. Use as a cheaper alternative to Grok for batch summarization.
{"contents":[{"parts":[{"text":"$1"}]}]}',
    updated_at = '2026-06-09T22:30:00Z'
WHERE key = 'GEMINI_GENERATE';
