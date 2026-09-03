-- 0077: directory row for the bound Durable Object worker (DirectoryDO,
-- script loop-safe-directory-do). Reached at the production hostname via the Pages
-- front door functions/api/durable/[[path]].js. type=http; $1 = the read op.
INSERT OR REPLACE INTO directory
  (key, type, target, auth, content, category, allowed_categories, seq, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'DURABLE_WORKER',
  'http',
  'GET https://miscsubjects.com/api/durable/$1',
  '',
  '# Durable Worker — the bound Durable Object (class DirectoryDO, script loop-safe-directory-do). One strongly-consistent instance ("main") that owns the SLUG REGISTRY (every declared internal position: slug -> kind+target) and an append-only MUTATION-INTENT LOG.
# INVOKE (read ops, $1 = op):
#   [DURABLE_WORKER]ping[/DURABLE_WORKER]        -> {ok, do, id, ts}
#   [DURABLE_WORKER]slug.list[/DURABLE_WORKER]   -> every declared slug
#   [DURABLE_WORKER]intents[/DURABLE_WORKER]     -> last 200 mutation intents (chronological)
# RESOLVE one slug (REST):  GET  https://miscsubjects.com/api/durable/slug.resolve?slug=<slug>
# REGISTER a slug (REST):   POST https://miscsubjects.com/api/durable/slug.register  {"slug":"<slug>","kind":"row|page|tool|agent","target":"<target>"}
# Bound two ways: this Worker self-binds DIRECTORY_DO; the Pages project also binds it via script_name. Deploy the Worker before the Pages deploy.
{"op":"$1"}',
  'cloudflare',
  '*',
  100,
  1,
  1,
  100,
  datetime('now')
);
