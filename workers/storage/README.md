# miscsubjects-storage — the storage agent

Holds reference sprawl (vendored API docs, the old build, any bulk reference) in **R2**,
with a queryable **D1** index, so the kernel's deploy artifact stays lean. It has **no
public route** — the Pages project reaches it via the `STORE` service binding behind
`/api/store` (TERMINAL_KEY-gated). Directory rows: `STORE_GET`, `STORE_SEARCH`
(`migrations/0100_store_rows.sql`).

## One-time setup (run from the repo dir on the Mac)

```bash
# 1. create the stores
npx wrangler r2 bucket create miscsubjects-store
npx wrangler d1 create loop-storage-index      # paste the id into workers/storage/wrangler.toml

# 2. pick a shared secret, set it on BOTH the Worker and the Pages project
STORE_KEY=$(openssl rand -hex 24)
( cd workers/storage && echo "$STORE_KEY" | npx wrangler secret put STORE_KEY )
npx wrangler pages secret put STORE_KEY --project-name miscsubjects-miscsubjects   # paste same value

# 3. deploy the Worker FIRST (the Pages STORE binding errors if the script doesn't exist)
( cd workers/storage && npx wrangler deploy )

# 4. redeploy Pages so the STORE binding + /api/store + the rows are live
npx wrangler pages deploy public --project-name miscsubjects-miscsubjects --commit-dirty=true
```

## Load content into the store (content first — before any repo strip)

```bash
# push every vendored doc into R2 + index, keyed by its repo-relative path
find docs/api -type f | while read -r f; do
  curl -s -X PUT "https://miscsubjects.com/api/store/f?path=$f" \
    -H "x-terminal-key: $TERMINAL_KEY" --data-binary @"$f" >/dev/null && echo "stored $f"
done
# (point the same loop at apps-script-osxx if you want the old build in the store too)
```

## Verify

```bash
curl -s "https://miscsubjects.com/api/store/search?q=openai" -H "x-terminal-key: $TERMINAL_KEY" | jq '.count'
curl -s "https://miscsubjects.com/api/store/f?path=docs/api/arcads/openapi-spec.json" -H "x-terminal-key: $TERMINAL_KEY" | head -c 200
# through the kernel:
curl -s -X POST -d '{"key":"STORE_SEARCH","body":"openai"}' https://miscsubjects.com/api/dispatch | jq
```

## Strip the repo — ONLY after the store holds + verifies the content

```bash
git rm -r docs/api/openai docs/api/grok apps-script-osxx
git rm migrations/0069_seed_phone_builder_threads_cli.sql.bak
# (docs/api/arcads is referenced by functions/admin/map.js:142 — move it too and update
#  that catalog string, or leave it in the repo. Your call.)
git commit -m "move reference docs into miscsubjects-storage; drop from repo"
```

Backups: the content is in Sheets, in git history, and now in the store before deletion.
