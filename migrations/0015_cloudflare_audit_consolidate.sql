
DELETE FROM directory WHERE key IN ('BLOOIO_NUMBERS_LIST','SECRETS_AUDIT');

-- ─── Cloudflare API surface ─────────────────────────────────────────────────
-- All paths use $ACCT placeholder = env.CF_ACCOUNT_ID (set as a binding alongside CLOUDFLARE_API_TOKEN).

INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at, category, allowed_categories) VALUES

-- Account-level
('CF_USER',            'http', 'GET https://api.cloudflare.com/client/v4/user', 'bearer:CLOUDFLARE_API_TOKEN',
'# GET /user — the account that owns CLOUDFLARE_API_TOKEN. Use to confirm identity.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_ACCOUNTS_LIST',   'http', 'GET https://api.cloudflare.com/client/v4/accounts', 'bearer:CLOUDFLARE_API_TOKEN',
'# List accounts visible to the token. Use to enumerate where the token has access.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_TOKENS_VERIFY',   'http', 'GET https://api.cloudflare.com/client/v4/user/tokens/verify', 'bearer:CLOUDFLARE_API_TOKEN',
'# Verify the token is valid + return its id + status. Use after creating/rotating a token.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Zones + DNS
('CF_ZONES_LIST',      'http', 'GET https://api.cloudflare.com/client/v4/zones', 'bearer:CLOUDFLARE_API_TOKEN',
'# List zones (domains) in the account. Use before any DNS or SSL operation.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_ZONE_GET',        'http', 'GET https://api.cloudflare.com/client/v4/zones/$1', 'bearer:CLOUDFLARE_API_TOKEN',
'# GET one zone $1. Use to fetch name_servers, plan, settings_url.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_DNS_LIST',        'http', 'GET https://api.cloudflare.com/client/v4/zones/$1/dns_records?per_page=100', 'bearer:CLOUDFLARE_API_TOKEN',
'# List DNS records in zone $1. Use before adding/updating to dedupe by name+type.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_DNS_CREATE',      'http', 'POST https://api.cloudflare.com/client/v4/zones/$1/dns_records', 'bearer:CLOUDFLARE_API_TOKEN',
'# Create DNS record in zone $1. $2=type $3=name $4=content $5=ttl(120-86400 or 1 for auto) $6=proxied(true|false).
{"type":"$2","name":"$3","content":"$4","ttl":$5,"proxied":$6}', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_DNS_UPDATE',      'http', 'PUT https://api.cloudflare.com/client/v4/zones/$1/dns_records/$2', 'bearer:CLOUDFLARE_API_TOKEN',
'# Replace DNS record $2 in zone $1. Same body as CF_DNS_CREATE.
{"type":"$3","name":"$4","content":"$5","ttl":$6,"proxied":$7}', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_DNS_DELETE',      'http', 'DELETE https://api.cloudflare.com/client/v4/zones/$1/dns_records/$2', 'bearer:CLOUDFLARE_API_TOKEN',
'# Delete DNS record $2 in zone $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_CACHE_PURGE',     'http', 'POST https://api.cloudflare.com/client/v4/zones/$1/purge_cache', 'bearer:CLOUDFLARE_API_TOKEN',
'# Purge cache for zone $1. $2 is JSON: {"purge_everything":true} OR {"files":["url1",...]} OR {"tags":["tag1"]}.
$2', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Workers
('CF_WORKERS_LIST',    'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/workers/scripts', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Worker scripts in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_WORKER_GET',      'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/workers/scripts/$2', 'bearer:CLOUDFLARE_API_TOKEN',
'# Get Worker $2 in account $1 (metadata + source). Use to inspect a deployed Worker.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_WORKER_DELETE',   'http', 'DELETE https://api.cloudflare.com/client/v4/accounts/$1/workers/scripts/$2', 'bearer:CLOUDFLARE_API_TOKEN',
'# Delete Worker $2 in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_WORKER_ROUTES',   'http', 'GET https://api.cloudflare.com/client/v4/zones/$1/workers/routes', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Worker routes attached to zone $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_WORKER_DEPLOYMENTS','http','GET https://api.cloudflare.com/client/v4/accounts/$1/workers/scripts/$2/deployments', 'bearer:CLOUDFLARE_API_TOKEN',
'# List deployments for Worker $2. Use for rollback target IDs.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Pages
('CF_PAGES_LIST',      'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/pages/projects', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Pages projects in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_PAGES_GET',       'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/pages/projects/$2', 'bearer:CLOUDFLARE_API_TOKEN',
'# Get Pages project $2 (deployment_configs, bindings).', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_PAGES_PATCH',     'http', 'PATCH https://api.cloudflare.com/client/v4/accounts/$1/pages/projects/$2', 'bearer:CLOUDFLARE_API_TOKEN',
'# PATCH Pages project $2 (e.g. update bindings). $3 = JSON delta.
$3', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_PAGES_DEPLOYMENTS','http','GET https://api.cloudflare.com/client/v4/accounts/$1/pages/projects/$2/deployments', 'bearer:CLOUDFLARE_API_TOKEN',
'# List deployments for Pages project $2. Each has id, url, environment, latest_stage.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_PAGES_DEPLOY_RETRY','http','POST https://api.cloudflare.com/client/v4/accounts/$1/pages/projects/$2/deployments/$3/retry', 'bearer:CLOUDFLARE_API_TOKEN',
'# Retry a failed Pages deployment $3.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- KV namespaces
('CF_KV_LIST_NS',      'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/storage/kv/namespaces', 'bearer:CLOUDFLARE_API_TOKEN',
'# List KV namespaces in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_KV_CREATE_NS',    'http', 'POST https://api.cloudflare.com/client/v4/accounts/$1/storage/kv/namespaces', 'bearer:CLOUDFLARE_API_TOKEN',
'# Create KV namespace $2.
form:title=$2', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_KV_DELETE_NS',    'http', 'DELETE https://api.cloudflare.com/client/v4/accounts/$1/storage/kv/namespaces/$2', 'bearer:CLOUDFLARE_API_TOKEN',
'# Delete KV namespace $2.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_KV_LIST_KEYS',    'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/storage/kv/namespaces/$2/keys', 'bearer:CLOUDFLARE_API_TOKEN',
'# List keys in KV namespace $2. Prefer KV_LIST (in-binding) when bound to this Worker.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_KV_BULK_WRITE',   'http', 'PUT https://api.cloudflare.com/client/v4/accounts/$1/storage/kv/namespaces/$2/bulk', 'bearer:CLOUDFLARE_API_TOKEN',
'# Bulk write up to 10000 KV pairs to namespace $2. $3 = JSON array of {key,value,expiration_ttl?}.
$3', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- R2 buckets
('CF_R2_LIST_BUCKETS', 'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/r2/buckets', 'bearer:CLOUDFLARE_API_TOKEN',
'# List R2 buckets in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_R2_CREATE_BUCKET','http', 'POST https://api.cloudflare.com/client/v4/accounts/$1/r2/buckets', 'bearer:CLOUDFLARE_API_TOKEN',
'# Create R2 bucket $2. $3=location_hint (apac|eeur|enam|weur|wnam or empty).
{"name":"$2","locationHint":"$3"}', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_R2_DELETE_BUCKET','http', 'DELETE https://api.cloudflare.com/client/v4/accounts/$1/r2/buckets/$2', 'bearer:CLOUDFLARE_API_TOKEN',
'# Delete R2 bucket $2 (must be empty).', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- D1
('CF_D1_LIST',         'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/d1/database', 'bearer:CLOUDFLARE_API_TOKEN',
'# List D1 databases in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_D1_GET',          'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/d1/database/$2', 'bearer:CLOUDFLARE_API_TOKEN',
'# Get D1 database $2.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_D1_QUERY_REMOTE', 'http', 'POST https://api.cloudflare.com/client/v4/accounts/$1/d1/database/$2/query', 'bearer:CLOUDFLARE_API_TOKEN',
'# Run a SQL statement against remote D1 $2. $3=JSON {"sql":"...","params":[...]}. Use D1_QUERY (binding) when local; this is for cross-account queries.
$3', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Vectorize
('CF_VECTORIZE_LIST',  'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/vectorize/v2/indexes', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Vectorize indexes in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Workers AI (REST run)
('CF_AI_MODELS',       'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/ai/models/search?per_page=100', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Workers AI models. Use to discover @cf/* model IDs.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_AI_RUN',          'http', 'POST https://api.cloudflare.com/client/v4/accounts/$1/ai/run/$2', 'bearer:CLOUDFLARE_API_TOKEN',
'# Run Workers AI model $2 (e.g. @cf/meta/llama-3.1-8b-instruct). $3=JSON input. Use AI binding when running from inside this Worker.
$3', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Queues
('CF_QUEUES_LIST',     'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/queues', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Queues in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Email Routing
('CF_EMAIL_ROUTING',   'http', 'GET https://api.cloudflare.com/client/v4/zones/$1/email/routing/rules', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Email Routing rules in zone $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Access / Zero Trust
('CF_ACCESS_APPS',     'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/access/apps', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Access (Zero Trust) applications in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Tunnel (cloudflared)
('CF_TUNNELS_LIST',    'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/cfd_tunnel', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Cloudflare Tunnels in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Stream
('CF_STREAM_LIST',     'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/stream', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Cloudflare Stream videos in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Images
('CF_IMAGES_LIST',     'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/images/v1', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Cloudflare Images in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Secrets Store (matches the central store this build uses)
('CF_SECRETS_STORES',  'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/secrets_store/stores', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Secrets Store stores in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_SECRETS_LIST',    'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/secrets_store/stores/$2/secrets?per_page=100', 'bearer:CLOUDFLARE_API_TOKEN',
'# List secrets in store $2 (names + ids; values never returned). Use to map binding names.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),
('CF_SECRETS_CREATE',  'http', 'POST https://api.cloudflare.com/client/v4/accounts/$1/secrets_store/stores/$2/secrets', 'bearer:CLOUDFLARE_API_TOKEN',
'# Create secret in store $2. $3 = JSON array of {"name":"...","value":"...","scopes":["workers"],"comment":"..."}. ONLY USE when explicitly told to.
$3', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Hyperdrive
('CF_HYPERDRIVE_LIST', 'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/hyperdrive/configs', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Hyperdrive configs in account $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Logpush
('CF_LOGPUSH_JOBS',    'http', 'GET https://api.cloudflare.com/client/v4/zones/$1/logpush/jobs', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Logpush jobs in zone $1.', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

-- Analytics (zone-level GraphQL alternative; REST endpoints kept simple here)
('CF_ANALYTICS_DASH',  'http', 'GET https://api.cloudflare.com/client/v4/zones/$1/analytics/dashboard', 'bearer:CLOUDFLARE_API_TOKEN',
'# Zone $1 traffic analytics summary (requests, bandwidth, threats, top URIs).', '2026-06-09T20:00:00Z', 'cloudflare', NULL),

('BUILDER', 'agent', 'grok-4.3', 'bearer:GROK_API_KEY',
'# Second agent row. Advanced Grok 4.3 with access to the whole directory. Capable of reading, testing, editing, and upgrading the build. the owner owns this prompt — overwrite at /admin/directory/BUILDER.
You are connected to the miscsubjects.com build. Every row below is a callable tool. Reference a row by emitting [KEY]body[/KEY] in your reply; multiple args separate with `|`.

Available tools:
{{TOOLS}}',
'2026-06-09T20:00:00Z', 'llm', '*');

UPDATE directory SET allowed_categories='*' WHERE key='BUILDER';
