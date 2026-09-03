-- 0111: Fix broken rows — WRANGLER_* target/content swapped, FILE_PUT/PATCH body templates broken

-- 1. Fix WRANGLER_DEPLOY: target was JSON body, content was docs-only. Restore proper URL target + JSON body in content.
UPDATE directory SET
  target = 'POST https://agent.<bridge-domain>/exec',
  content = '# WHAT: Deploy the build to Cloudflare Pages production from the Mac bridge. No args. Returns the wrangler output (production URL on success)
# WHEN_TO_USE: "deploy the build" or "push the build to production"
# ARGS: $1 = flags/args after wrangler deploy (e.g. --help, --dry-run)
# EX: [WRANGLER_DEPLOY]--help[/WRANGLER_DEPLOY]
{"cmd":"sh","args":["-lc","cd /Users/owner/miscsubjects-pages && npx wrangler pages deploy public --project-name miscsubjects-pages --commit-dirty=true $1+"],"timeout":600000}'
WHERE key = 'WRANGLER_DEPLOY';

-- 2. Fix WRANGLER_D1_EXPORT: same swap issue
UPDATE directory SET
  target = 'POST https://agent.<bridge-domain>/exec',
  content = '# WHAT: Export the production D1 (miscsubjects-content) to a timestamped .sql file on the Mac for backup. Returns the file path and size of the latest dump
# WHEN_TO_USE: "back up the d1" or "dump the database to disk"
# ARGS: $1 = flags/args after wrangler d1 export (e.g. --remote, --output path)
# EX: [WRANGLER_D1_EXPORT]--help[/WRANGLER_D1_EXPORT]
{"cmd":"sh","args":["-lc","cd /Users/owner/miscsubjects-pages && npx wrangler d1 export miscsubjects-content --remote --output /tmp/d1-backup-$(date +%s).sql $1+ && ls -la /tmp/d1-backup-*.sql | tail -1"],"timeout":300000}'
WHERE key = 'WRANGLER_D1_EXPORT';

-- 3. Fix WRANGLER_TAIL: same swap issue
UPDATE directory SET
  target = 'POST https://agent.<bridge-domain>/exec',
  content = '# WHAT: Stream 30s of live tail logs from production Pages deployment, capped at 200 lines. Returns the pretty-formatted log buffer
# WHEN_TO_USE: "tail the build" or "what is the build logging right now"
# ARGS: $1 = flags/args after wrangler pages deployment tail (e.g. --format=json)
# EX: [WRANGLER_TAIL]--help[/WRANGLER_TAIL]
{"cmd":"sh","args":["-lc","cd /Users/owner/miscsubjects-pages && timeout 30 npx wrangler pages deployment tail --project-name miscsubjects-pages --format=pretty $1+ 2>&1 | head -200"],"timeout":40000}'
WHERE key = 'WRANGLER_TAIL';

-- 4. Fix FILE_PUT: body was raw $2+ (not JSON), causing no Content-Type header. Make it a proper JSON template.
UPDATE directory SET
  content = '# WHAT: Write a repo file via GitHub Contents API. Creates or overwrites.
# WHEN_TO_USE: you need to file put
# ARGS: $1 = path (e.g. functions/api/dispatch.js), $2 = file content (raw text), $3 = commit message (optional), $4 = sha (optional, auto-resolved if omitted), $5 = ref (optional, default main)
# EX: [FILE_PUT]functions/api/dispatch.js|const X = 1;|fix dispatch[/FILE_PUT]
{"content":"$2","message":"$3","sha":"$4","ref":"$5"}'
WHERE key = 'FILE_PUT';

-- 5. Fix FILE_PATCH: body was raw $1|$2|$3 (not JSON), and $1 duplicated the URL path. Make it a proper JSON template.
UPDATE directory SET
  content = '# WHAT: Patch a repo file — replace one string with another. Safer than FILE_PUT for small edits
# WHEN_TO_USE: you need to file patch
# ARGS: $1 = path (e.g. functions/api/dispatch.js), $2 = old_string, $3 = new_string, $4 = commit message (optional), $5 = ref (optional, default main)
# EX: [FILE_PATCH]functions/api/dispatch.js|const ITER_CAP = 8;|const ITER_CAP = 20;|bump cap[/FILE_PATCH]
{"old_string":"$2","new_string":"$3","message":"$4","ref":"$5"}'
WHERE key = 'FILE_PATCH';
