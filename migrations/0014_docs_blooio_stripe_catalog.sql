-- 0014_docs_blooio_stripe_catalog.sql
-- 1. Documentation lives in `content` as leading `#` comment lines. Kernel strips them before execution.
--    Agent rows are NOT touched (user owns those prompts).
-- 2. Full Blooio API surface (per docs.blooio.com): account, numbers, contacts, groups, group members, messages,
--    chats, webhooks, webhook logs, reactions, typing, read receipts, polls, location, phone-numbers, contact card.
-- 3. Stripe catalog cache table (stripe_catalog: products + prices snapshot) + sync fn row.
-- 4. Slot rows for Cloudflare Secrets Store secrets that this build does not yet use directly
--    (GITHUB_TOKEN, CF_ACCOUNT_ID, KLAVIYO_KEY, BIGCOMMERCE_TOKEN, TRIPLEWHALE_API_KEY, META_ACCESS_TOKEN, GEMINI_KEY, TWOCHAT_API_KEY).

-- ─── Stripe catalog cache ───
CREATE TABLE IF NOT EXISTS stripe_catalog (
  product_id   TEXT PRIMARY KEY,
  name         TEXT,
  brand        TEXT,
  opaque_id    TEXT,
  active       INTEGER,
  prices_json  TEXT,
  updated_at   TEXT NOT NULL
);

-- ─── Populate docs for every existing fn/http/flow row (CONTENT prepended with `#` lines) ───

-- Utility fns
UPDATE directory SET content =
'# Current ISO timestamp. Use when stamping rows, naming files, or proving the build is live.
'||COALESCE(content,'[]') WHERE key='NOW' AND type='fn';

UPDATE directory SET content =
'# Uppercase a string. Use only for cosmetic transforms; not for user-visible reply text.
'||COALESCE(content,'["$1"]') WHERE key='UPPER' AND type='fn';

UPDATE directory SET content =
'# Lowercase a string. Use before SHA256 hashing of emails or other case-insensitive identifiers.
'||COALESCE(content,'["$1"]') WHERE key='LOWER' AND type='fn';

UPDATE directory SET content =
'# SHA-256 hex of lowercased trimmed input. Use to hash em/ph/external_id for Meta CAPI or any PII hashing.
'||COALESCE(content,'["$1"]') WHERE key='SHA256_LOWER' AND type='fn';

UPDATE directory SET content =
'# Insert message_id into blooio_dedup. Use ONLY from the inbound webhook handler before replying.
'||COALESCE(content,'["$1"]') WHERE key='DEDUP_INSERT' AND type='fn';

-- KV
UPDATE directory SET content =
'# KV get by key. Use for small text values that change rarely (system_prompt mirror, feature flags).
'||COALESCE(content,'["$1"]') WHERE key='KV_GET' AND type='fn';

UPDATE directory SET content =
'# KV put $1=key $2=value. Overwrite is OK. Use for the same things KV_GET reads.
'||COALESCE(content,'["$1","$2"]') WHERE key='KV_PUT' AND type='fn';

UPDATE directory SET content =
'# KV delete by key. Use to invalidate a cached value (e.g. directory:snapshot).
'||COALESCE(content,'["$1"]') WHERE key='KV_DEL' AND type='fn';

UPDATE directory SET content =
'# List KV keys with $1 prefix. Use to enumerate a namespace before bulk-reading.
'||COALESCE(content,'["$1"]') WHERE key='KV_LIST' AND type='fn';

UPDATE directory SET content =
'# KV get and parse as JSON. Returns "null" if missing. Use when value is structured.
'||COALESCE(content,'["$1"]') WHERE key='KV_GET_JSON' AND type='fn';

UPDATE directory SET content =
'# KV put with JSON-stringify pass-through. $1=key $2=value (string or JSON). Use to store structured config.
'||COALESCE(content,'["$1","$2"]') WHERE key='KV_PUT_JSON' AND type='fn';

UPDATE directory SET content =
'# KV append: read array at $1, push $2, write back. Use as an append-only log inside KV (small N).
'||COALESCE(content,'["$1","$2"]') WHERE key='KV_APPEND' AND type='fn';

-- R2
UPDATE directory SET content =
'# R2 put $1=object_key $2=value (string). Use for large payloads exceeding D1 cell limits.
'||COALESCE(content,'["$1","$2"]') WHERE key='R2_PUT' AND type='fn';

UPDATE directory SET content =
'# R2 get object at $1=key. Returns string. Use to read back a payload mirrored from the kernel log.
'||COALESCE(content,'["$1"]') WHERE key='R2_GET' AND type='fn';

UPDATE directory SET content =
'# R2 delete object at $1=key. Use to clean up demo or expired payloads.
'||COALESCE(content,'["$1"]') WHERE key='R2_DEL' AND type='fn';

UPDATE directory SET content =
'# R2 list objects under $1=prefix. Use to enumerate ledger overflow files for a given trace.
'||COALESCE(content,'["$1"]') WHERE key='R2_LIST' AND type='fn';

-- D1
UPDATE directory SET content =
'# Run a SELECT and return the rows as JSON. Use for any read query against D1.
'||COALESCE(content,'["$1"]') WHERE key='D1_QUERY' AND type='fn';

UPDATE directory SET content =
'# Run a non-SELECT (INSERT/UPDATE/DELETE) and return {changes, last_row_id}. Use for writes.
'||COALESCE(content,'["$1"]') WHERE key='D1_EXEC' AND type='fn';

-- Self-mod
UPDATE directory SET content =
'# Insert a directory row. Args: key|type|target|auth|content. Use when the router needs a new tool live.
'||COALESCE(content,'["$1","$2","$3","$4","$5"]') WHERE key='ADD_ROW' AND type='fn';

UPDATE directory SET content =
'# Upsert a directory row. Same args as ADD_ROW. Use to edit a tool you already named.
'||COALESCE(content,'["$1","$2","$3","$4","$5"]') WHERE key='EDIT_ROW' AND type='fn';

UPDATE directory SET content =
'# Delete a directory row by key. Use to remove a tool the router has been hallucinating.
'||COALESCE(content,'["$1"]') WHERE key='DEL_ROW' AND type='fn';

-- Tasks
UPDATE directory SET content =
'# Append a row to the tasks table with body=$1, source="ADDTASK". Use when the model needs to remember a TODO it cannot execute now.
'||COALESCE(content,'["$1","ADDTASK"]') WHERE key='ADDTASK' AND type='fn';

UPDATE directory SET content =
'# Regex parse $1 against /\[KEY\]body[/KEY](?: as bind)?/. Returns {count, tags[]}. Use to dry-run tag extraction before live dispatch.
'||COALESCE(content,'["$1"]') WHERE key='REGEX_PARSE' AND type='fn';

-- Secrets helpers
UPDATE directory SET content =
'# Return env var by name. Use ONLY for publishable values (e.g. STRIPE_PUBLIC_KEY). Never for secret keys.
'||COALESCE(content,'["STRIPE_PUBLIC_KEY"]') WHERE key='STRIPE_PUBLIC_KEY_GET' AND type='fn';

UPDATE directory SET content =
'# HMAC-SHA256 hex of $1=body using env.BLOOIO_WEBHOOK_SECRET. Use to verify Blooio inbound signatures.
'||COALESCE(content,'["BLOOIO_WEBHOOK_SECRET","$1"]') WHERE key='VERIFY_BLOOIO_SIG' AND type='fn';

-- Flow rows (read-only queries)
UPDATE directory SET content =
'# List the directory: D1_QUERY: SELECT key, type, target, updated_at FROM directory ORDER BY key. Use to enumerate every tool.
'||COALESCE(content,'') WHERE key='DIRECTORY_LIST' AND type='flow';

UPDATE directory SET content =
'# Read one directory row by $1=key. Use to inspect a specific tool definition.
'||COALESCE(content,'') WHERE key='DIRECTORY_GET' AND type='flow';

UPDATE directory SET content =
'# List all settings. Use to enumerate keys that are read by code paths outside the directory.
'||COALESCE(content,'') WHERE key='SETTINGS_LIST' AND type='flow';

UPDATE directory SET content =
'# Read one setting by $1=key. Use when reading a config value (e.g. grok_model).
'||COALESCE(content,'') WHERE key='SETTINGS_GET' AND type='flow';

UPDATE directory SET content =
'# Last 50 kernel log rows. Use to inspect recent dispatch activity (trace + step tree).
'||COALESCE(content,'') WHERE key='LOG_TAIL' AND type='flow';

UPDATE directory SET content =
'# Last 20 grok_ledger rows (id, ts, source). Use to find a recent LLM call to inspect.
'||COALESCE(content,'') WHERE key='GROK_LEDGER_TAIL' AND type='flow';

UPDATE directory SET content =
'# Last 20 blooio_logs rows. Use to find a recent inbound webhook or outbound SMS to inspect.
'||COALESCE(content,'') WHERE key='BLOOIO_LOGS_TAIL' AND type='flow';

UPDATE directory SET content =
'# List runtime-editable HTML pages (slug, title, version, updated_at). Use before PAGES_GET.
'||COALESCE(content,'') WHERE key='PAGES_LIST' AND type='flow';

UPDATE directory SET content =
'# Read one page by $1=slug. Use to inspect or revert page content.
'||COALESCE(content,'') WHERE key='PAGES_GET' AND type='flow';

UPDATE directory SET content =
'# List versions for $1=slug. Use to find a prior version id before reverting.
'||COALESCE(content,'') WHERE key='PAGES_VERSIONS' AND type='flow';

UPDATE directory SET content =
'# Body HTML for $1=slug (used by functions/[slug].js to serve /<slug>). Use ONLY from the page renderer.
'||COALESCE(content,'') WHERE key='SERVE_PAGE' AND type='flow';

UPDATE directory SET content =
'# Tally rows per auth prefix. Use to audit which secret is referenced by how many directory rows.
'||COALESCE(content,'') WHERE key='SECRETS_AUDIT' AND type='flow';

UPDATE directory SET content =
'# List tasks created by [ADDTASK] or other callers. Use to read recent open tasks.
'||COALESCE(content,'') WHERE key='TASKS_LIST' AND type='flow';

-- ─── BLOOIO: existing row gets docs ───
UPDATE directory SET content =
'# POST a message to chat $1 with body {"text":"$2"}. Use when the model decided on a reply.
# Use BLOOIO_SEND_MULTIPART (when added) for multi-line; use BLOOIO_TYPING_START before for natural pacing.
'||COALESCE(content,'{"text":"$2"}') WHERE key='BLOOIO_SEND' AND type='http';

-- ─── BLOOIO: full surface (Authorization: Bearer <env.BLOOIO_API_KEY>) ───

INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at, category, allowed_categories) VALUES

-- Account
('BLOOIO_ACCOUNT', 'http', 'GET https://backend.blooio.com/v2/api/account', 'bearer:BLOOIO_API_KEY',
'# GET current authentication context (org, plan, capabilities). Use to confirm the API key is alive before bulk sends.',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Numbers & Contact Card
('BLOOIO_NUMBERS_LIST', 'http', 'GET https://backend.blooio.com/v2/api/numbers', 'bearer:BLOOIO_API_KEY',
'# List all Blooio phone numbers in the pool. Use before specifying from_number on a send.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CONTACT_CARD_UPDATE', 'http', 'PUT https://backend.blooio.com/v2/api/contact-card', 'bearer:BLOOIO_API_KEY',
'# Update the build''s outgoing contact card (Name + Photo). Use to rebrand the iMessage sender identity.
form:name=$1',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CONTACT_CARD_SHARE', 'http', 'POST https://backend.blooio.com/v2/api/chats/$1/contact-card', 'bearer:BLOOIO_API_KEY',
'# Stage contact card to be sent piggybacked on the NEXT outgoing message to chat $1. Idempotent.',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Contacts
('BLOOIO_CONTACTS_LIST', 'http', 'GET https://backend.blooio.com/v2/api/contacts?limit=$1&offset=$2', 'bearer:BLOOIO_API_KEY',
'# Paginated list of contacts. $1=limit (1-200, default 50) $2=offset. Use before BLOOIO_CONTACT_CREATE to dedupe by identifier.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CONTACT_CREATE', 'http', 'POST https://backend.blooio.com/v2/api/contacts', 'bearer:BLOOIO_API_KEY',
'# Create a contact. $1=identifier (E.164 phone or email) $2=name. 409 if identifier already exists.
form:identifier=$1&name=$2',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CONTACT_GET', 'http', 'GET https://backend.blooio.com/v2/api/contacts/$1', 'bearer:BLOOIO_API_KEY',
'# Get one contact by $1=identifier (URL-encoded phone or email).',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CONTACT_UPDATE', 'http', 'PATCH https://backend.blooio.com/v2/api/contacts/$1', 'bearer:BLOOIO_API_KEY',
'# Update contact display name. $1=identifier $2=new name (or empty string to clear).
form:name=$2',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CONTACT_DELETE', 'http', 'DELETE https://backend.blooio.com/v2/api/contacts/$1', 'bearer:BLOOIO_API_KEY',
'# Soft-delete contact by $1=identifier. Re-create later to undelete.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CONTACT_CAPS', 'http', 'GET https://backend.blooio.com/v2/api/contacts/$1/capabilities', 'bearer:BLOOIO_API_KEY',
'# Check whether $1=identifier supports iMessage. Use before sending an iMessage-only effect.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CONTACT_TAGS_LIST', 'http', 'GET https://backend.blooio.com/v2/api/contacts/$1/tags', 'bearer:BLOOIO_API_KEY',
'# List tags on contact $1. Use for filtering audiences.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CONTACT_TAGS_ADD', 'http', 'POST https://backend.blooio.com/v2/api/contacts/$1/tags', 'bearer:BLOOIO_API_KEY',
'# Add one tag $2 to contact $1. (Multiple tags: call once per tag, or send JSON.)
{"tags":["$2"]}',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CONTACT_TAG_REMOVE', 'http', 'DELETE https://backend.blooio.com/v2/api/contacts/$1/tags/$2', 'bearer:BLOOIO_API_KEY',
'# Remove tag $2 from contact $1.',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Groups
('BLOOIO_GROUPS_LIST', 'http', 'GET https://backend.blooio.com/v2/api/groups?limit=$1&offset=$2', 'bearer:BLOOIO_API_KEY',
'# Paginated group list. Use to find an existing group before creating.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_GROUP_CREATE', 'http', 'POST https://backend.blooio.com/v2/api/groups', 'bearer:BLOOIO_API_KEY',
'# Create group. $1=name $2=chat_guid(optional) $3=members(comma list of phones/emails). Use $2 to link to an existing iMessage chat.
form:name=$1&chat_guid=$2&members=$3',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_GROUP_GET', 'http', 'GET https://backend.blooio.com/v2/api/groups/$1', 'bearer:BLOOIO_API_KEY',
'# Get group by $1=group_id (grp_xxxx).',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_GROUP_UPDATE', 'http', 'PATCH https://backend.blooio.com/v2/api/groups/$1', 'bearer:BLOOIO_API_KEY',
'# Rename group $1 to $2.
form:name=$2',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_GROUP_DELETE', 'http', 'DELETE https://backend.blooio.com/v2/api/groups/$1', 'bearer:BLOOIO_API_KEY',
'# Soft-delete group $1. Members are detached; if linked to a chat, the number also leaves it.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_GROUP_ICON_SET', 'http', 'POST https://backend.blooio.com/v2/api/groups/$1/icon', 'bearer:BLOOIO_API_KEY',
'# Set group icon. Multipart upload — not yet wired into the kernel; call via curl until form-data is supported here.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_GROUP_ICON_DEL', 'http', 'DELETE https://backend.blooio.com/v2/api/groups/$1/icon', 'bearer:BLOOIO_API_KEY',
'# Remove group icon.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_GROUP_MEMBERS_LIST', 'http', 'GET https://backend.blooio.com/v2/api/groups/$1/members', 'bearer:BLOOIO_API_KEY',
'# List members of group $1.',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Messages
('BLOOIO_MESSAGES_LIST', 'http', 'GET https://backend.blooio.com/v2/api/chats/$1/messages?limit=$2&offset=$3', 'bearer:BLOOIO_API_KEY',
'# List messages in chat $1 (phone, email, group, or comma list). Use to fetch recent history before composing a reply.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_MESSAGE_GET', 'http', 'GET https://backend.blooio.com/v2/api/chats/$1/messages/$2', 'bearer:BLOOIO_API_KEY',
'# Get one message $2 in chat $1.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_MESSAGE_STATUS', 'http', 'GET https://backend.blooio.com/v2/api/chats/$1/messages/$2/status', 'bearer:BLOOIO_API_KEY',
'# Delivery status (queued/sent/delivered/read/failed) for message $2.',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Chats
('BLOOIO_CHATS_LIST', 'http', 'GET https://backend.blooio.com/v2/api/chats?limit=$1&sort=$2', 'bearer:BLOOIO_API_KEY',
'# List unique chats. $2 in {recent,oldest}. Use to identify the most-recent inbound chat.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CHAT_GET', 'http', 'GET https://backend.blooio.com/v2/api/chats/$1', 'bearer:BLOOIO_API_KEY',
'# Get chat $1 details (counts, last message, background).',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CHAT_BG_GET', 'http', 'GET https://backend.blooio.com/v2/api/chats/$1/background', 'bearer:BLOOIO_API_KEY',
'# Get current background image metadata for chat $1.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_CHAT_BG_DEL', 'http', 'DELETE https://backend.blooio.com/v2/api/chats/$1/background', 'bearer:BLOOIO_API_KEY',
'# Remove background image from chat $1.',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Webhooks
('BLOOIO_WEBHOOKS_LIST', 'http', 'GET https://backend.blooio.com/v2/api/webhooks', 'bearer:BLOOIO_API_KEY',
'# List all webhooks for this org. Use to confirm our /blooio receiver is registered.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_WEBHOOK_CREATE', 'http', 'POST https://backend.blooio.com/v2/api/webhooks', 'bearer:BLOOIO_API_KEY',
'# Create a webhook. $1=webhook_url $2=type(message|status|all default message) $3=valid_until(unix or -1).
form:webhook_url=$1&webhook_type=$2&valid_until=$3',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_WEBHOOK_GET', 'http', 'GET https://backend.blooio.com/v2/api/webhooks/$1', 'bearer:BLOOIO_API_KEY',
'# Get webhook $1 (wh_xxx).',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_WEBHOOK_UPDATE', 'http', 'PATCH https://backend.blooio.com/v2/api/webhooks/$1', 'bearer:BLOOIO_API_KEY',
'# Update webhook $1. $2=webhook_type $3=valid_until $4=deprecate(true|false).
form:webhook_type=$2&valid_until=$3&deprecate=$4',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_WEBHOOK_DELETE', 'http', 'DELETE https://backend.blooio.com/v2/api/webhooks/$1', 'bearer:BLOOIO_API_KEY',
'# Permanently delete webhook $1.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_WEBHOOK_LOGS', 'http', 'GET https://backend.blooio.com/v2/api/webhooks/$1/logs?limit=$2', 'bearer:BLOOIO_API_KEY',
'# List delivery logs for webhook $1. Use to debug failing deliveries.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_WEBHOOK_REPLAY', 'http', 'POST https://backend.blooio.com/v2/api/webhooks/$1/logs/$2/replay', 'bearer:BLOOIO_API_KEY',
'# Re-send webhook event $2 from webhook $1 to the configured URL.',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Reactions
('BLOOIO_REACTION', 'http', 'POST https://backend.blooio.com/v2/api/chats/$1/messages/$2/reactions', 'bearer:BLOOIO_API_KEY',
'# Add/remove reaction to message $2 in chat $1. $3=reaction (e.g. +love, -love, +laugh, +👍).
{"reaction":"$3"}',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Typing indicators
('BLOOIO_TYPING_START', 'http', 'POST https://backend.blooio.com/v2/api/chats/$1/typing', 'bearer:BLOOIO_API_KEY',
'# Start typing indicator in chat $1. iMessage-only (RCS returns 200 with warning). Use to humanize pacing.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_TYPING_STOP', 'http', 'DELETE https://backend.blooio.com/v2/api/chats/$1/typing', 'bearer:BLOOIO_API_KEY',
'# Stop typing indicator in chat $1.',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Read receipts
('BLOOIO_READ', 'http', 'POST https://backend.blooio.com/v2/api/chats/$1/read', 'bearer:BLOOIO_API_KEY',
'# Mark all messages in chat $1 as read (sends a read receipt to sender).',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Polls
('BLOOIO_POLL_SEND', 'http', 'POST https://backend.blooio.com/v2/api/chats/$1/polls', 'bearer:BLOOIO_API_KEY',
'# Send a native iMessage poll to chat $1. $2=title $3=options (JSON array of 2-10 strings).
{"title":"$2","options":$3}',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_POLL_GET', 'http', 'GET https://backend.blooio.com/v2/api/chats/$1/polls/$2', 'bearer:BLOOIO_API_KEY',
'# Get poll $2 results in chat $1 (vote counts per option).',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Location
('BLOOIO_LOCATION_LIST', 'http', 'GET https://backend.blooio.com/v2/api/contacts/$1/locations', 'bearer:BLOOIO_API_KEY',
'# FindMy location history for contact $1.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_LOCATION_GET', 'http', 'GET https://backend.blooio.com/v2/api/contacts/$1/location', 'bearer:BLOOIO_API_KEY',
'# Most-recent FindMy location for contact $1.',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_LOCATION_REFRESH', 'http', 'POST https://backend.blooio.com/v2/api/contacts/$1/location/refresh', 'bearer:BLOOIO_API_KEY',
'# Request fresh FindMy location for contact $1.',
'2026-06-09T19:00:00Z', 'blooio', NULL),

-- Phone Numbers (Enterprise lookup)
('BLOOIO_LOOKUP_GET', 'http', 'GET https://backend.blooio.com/v2/api/phone-numbers/lookup?number=$1', 'bearer:BLOOIO_API_KEY',
'# Look up $1 (E.164 or national). Returns formatting, type, carrier-region. Enterprise plan only (403 otherwise).',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_LOOKUP_POST', 'http', 'POST https://backend.blooio.com/v2/api/phone-numbers/lookup', 'bearer:BLOOIO_API_KEY',
'# Same as BLOOIO_LOOKUP_GET but $1 in body (avoids URL-encoding issues).
{"number":"$1"}',
'2026-06-09T19:00:00Z', 'blooio', NULL),
('BLOOIO_LOOKUP_BATCH', 'http', 'POST https://backend.blooio.com/v2/api/phone-numbers/batch', 'bearer:BLOOIO_API_KEY',
'# Batch lookup up to 100 numbers. $1=JSON array of E.164 strings.
{"numbers":$1}',
'2026-06-09T19:00:00Z', 'blooio', NULL);

-- ─── Stripe: prepend docs to existing rows ───
UPDATE directory SET content =
'# GET https://api.stripe.com/v1/account. Use to confirm the live key is alive and check account metadata.
'||COALESCE(content,'') WHERE key='STRIPE_ACCOUNT' AND type='http';
UPDATE directory SET content =
'# GET balance. Returns {available[], pending[]}. Use before referencing payouts.
'||COALESCE(content,'') WHERE key='STRIPE_BALANCE' AND type='http';
UPDATE directory SET content =
'# List balance transactions, $1=limit. Use to audit money movement.
'||COALESCE(content,'') WHERE key='STRIPE_BALANCE_TX_LIST' AND type='http';
UPDATE directory SET content =
'# List customers, $1=limit (1-100). Use to enumerate; FOLLOW WITH STRIPE_CUSTOMER_SEARCH for email/phone match.
'||COALESCE(content,'') WHERE key='STRIPE_CUSTOMERS_LIST' AND type='http';
UPDATE directory SET content =
'# Get one customer by $1=id. Use after CUSTOMERS_LIST.
'||COALESCE(content,'') WHERE key='STRIPE_CUSTOMER_GET' AND type='http';
UPDATE directory SET content =
'# Search customers via Stripe Search syntax e.g. ''email:"a@b.c"''. Use to AVOID duplicate creation.
'||COALESCE(content,'') WHERE key='STRIPE_CUSTOMER_SEARCH' AND type='http';
UPDATE directory SET content =
'# Create customer $1=email $2=name $3=phone. ONLY USE when explicitly told to create. Search first.
'||COALESCE(content,'') WHERE key='STRIPE_CUSTOMER_CREATE' AND type='http';
UPDATE directory SET content =
'# Update customer $1. $2=email $3=name $4=phone.
'||COALESCE(content,'') WHERE key='STRIPE_CUSTOMER_UPDATE' AND type='http';
UPDATE directory SET content =
'# DELETE customer $1 (soft-delete on Stripe side). Use to clean up test customers.
'||COALESCE(content,'') WHERE key='STRIPE_CUSTOMER_DELETE' AND type='http';
UPDATE directory SET content =
'# List products, $1=limit. Use to discover SKUs. Cached in stripe_catalog via STRIPE_CATALOG_SYNC.
'||COALESCE(content,'') WHERE key='STRIPE_PRODUCTS_LIST' AND type='http';
UPDATE directory SET content =
'# Get product $1. Use to read metadata (brand, opaque_id).
'||COALESCE(content,'') WHERE key='STRIPE_PRODUCT_GET' AND type='http';
UPDATE directory SET content =
'# Create product $1=name $2=description. ONLY USE when explicitly told to.
'||COALESCE(content,'') WHERE key='STRIPE_PRODUCT_CREATE' AND type='http';
UPDATE directory SET content =
'# List prices, $1=limit. Each price references a product. Use after PRODUCTS_LIST.
'||COALESCE(content,'') WHERE key='STRIPE_PRICES_LIST' AND type='http';
UPDATE directory SET content =
'# Get price $1.
'||COALESCE(content,'') WHERE key='STRIPE_PRICE_GET' AND type='http';
UPDATE directory SET content =
'# Create price $1=product $2=unit_amount (cents) $3=currency. ONLY USE when told to.
'||COALESCE(content,'') WHERE key='STRIPE_PRICE_CREATE' AND type='http';
UPDATE directory SET content =
'# List invoices, $1=limit. Use to audit recent invoice activity.
'||COALESCE(content,'') WHERE key='STRIPE_INVOICES_LIST' AND type='http';
UPDATE directory SET content =
'# Get invoice $1. Use to inspect status, amount_due, hosted_invoice_url.
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_GET' AND type='http';
UPDATE directory SET content =
'# Create invoice $1=customer $2=days_until_due $3=description. ONLY USE when told to. Use SEND_INVOICE_VIA_BLOOIO for the full flow.
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_CREATE' AND type='http';
UPDATE directory SET content =
'# Update invoice $1. $2=description.
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_UPDATE' AND type='http';
UPDATE directory SET content =
'# Finalize draft invoice $1. After this, the invoice is uneditable and ready to send.
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_FINALIZE' AND type='http';
UPDATE directory SET content =
'# Send finalized invoice $1 (triggers Stripe customer email).
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_SEND' AND type='http';
UPDATE directory SET content =
'# Charge the customer''s default payment method against invoice $1 immediately.
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_PAY' AND type='http';
UPDATE directory SET content =
'# Void invoice $1 (no money moves; status=void). Use to cancel a finalized invoice with no payment.
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_VOID' AND type='http';
UPDATE directory SET content =
'# Mark invoice $1 uncollectible (writes off; doesn''t void). For collections workflows.
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_MARK_UNCOLLECTIBLE' AND type='http';
UPDATE directory SET content =
'# Delete draft invoice $1 (only valid before finalize).
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_DELETE' AND type='http';
UPDATE directory SET content =
'# List invoice items for customer $1, limit $2. Use to see pending line items.
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_ITEMS_LIST' AND type='http';
UPDATE directory SET content =
'# Create pending invoice item. $1=customer $2=amount(cents) $3=currency $4=description. Attaches to NEXT invoice for that customer.
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_ITEM_CREATE' AND type='http';
UPDATE directory SET content =
'# Delete invoice item $1 (only if not yet on a finalized invoice).
'||COALESCE(content,'') WHERE key='STRIPE_INVOICE_ITEM_DELETE' AND type='http';
UPDATE directory SET content =
'# List charges, $1=limit. Use to audit payments.
'||COALESCE(content,'') WHERE key='STRIPE_CHARGES_LIST' AND type='http';
UPDATE directory SET content =
'# Get charge $1.
'||COALESCE(content,'') WHERE key='STRIPE_CHARGE_GET' AND type='http';
UPDATE directory SET content =
'# List payment_intents, $1=limit.
'||COALESCE(content,'') WHERE key='STRIPE_PI_LIST' AND type='http';
UPDATE directory SET content =
'# Get payment_intent $1.
'||COALESCE(content,'') WHERE key='STRIPE_PI_GET' AND type='http';
UPDATE directory SET content =
'# Create payment_intent $1=amount $2=currency $3=customer $4=description. ONLY USE when told to.
'||COALESCE(content,'') WHERE key='STRIPE_PI_CREATE' AND type='http';
UPDATE directory SET content =
'# List payment_links, $1=limit.
'||COALESCE(content,'') WHERE key='STRIPE_PAYMENT_LINKS_LIST' AND type='http';
UPDATE directory SET content =
'# Create payment_link with $1=price $2=quantity. Useful for low-touch checkout via SMS.
'||COALESCE(content,'') WHERE key='STRIPE_PAYMENT_LINK_CREATE' AND type='http';
UPDATE directory SET content =
'# List subscriptions, $1=limit.
'||COALESCE(content,'') WHERE key='STRIPE_SUBSCRIPTIONS_LIST' AND type='http';
UPDATE directory SET content =
'# Get subscription $1.
'||COALESCE(content,'') WHERE key='STRIPE_SUBSCRIPTION_GET' AND type='http';
UPDATE directory SET content =
'# Cancel subscription $1. ONLY USE when explicitly told to.
'||COALESCE(content,'') WHERE key='STRIPE_SUBSCRIPTION_CANCEL' AND type='http';
UPDATE directory SET content =
'# List payouts, $1=limit.
'||COALESCE(content,'') WHERE key='STRIPE_PAYOUTS_LIST' AND type='http';
UPDATE directory SET content =
'# Get payout $1.
'||COALESCE(content,'') WHERE key='STRIPE_PAYOUT_GET' AND type='http';
UPDATE directory SET content =
'# List refunds, $1=limit.
'||COALESCE(content,'') WHERE key='STRIPE_REFUNDS_LIST' AND type='http';
UPDATE directory SET content =
'# Refund charge $1 amount=$2 (cents). ONLY USE when told to.
'||COALESCE(content,'') WHERE key='STRIPE_REFUND_CREATE' AND type='http';
UPDATE directory SET content =
'# List events, $1=limit. Use to audit what Stripe has been doing (subscription cycles, invoice events, etc.).
'||COALESCE(content,'') WHERE key='STRIPE_EVENTS_LIST' AND type='http';

UPDATE directory SET content =
'# One-shot: customer create + invoice item + invoice (pending_invoice_items_behavior=include) + finalize + SMS hosted_invoice_url via BLOOIO_SEND.
# Args: email|name|phone|amount_cents|description. STRICTLY: do not run unless the owner explicitly tells you to create an invoice for a real recipient.
'||COALESCE(content,'["$1","$2","$3","$4","$5"]') WHERE key='SEND_INVOICE_VIA_BLOOIO' AND type='fn';

-- ─── Stripe catalog cache + sync ───
INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at, category, allowed_categories) VALUES
('STRIPE_CATALOG_SYNC', 'fn', 'stripeCatalogSync', '',
'# Pull active products + prices from Stripe and upsert into D1.stripe_catalog. Use to refresh local SKU cache.
[]',
'2026-06-09T19:00:00Z', 'stripe', NULL),
('STRIPE_SKUS_LIST', 'flow', '', '',
'# List cached SKUs (product name, brand, opaque_id, prices summary). Run STRIPE_CATALOG_SYNC first to refresh.
D1_QUERY: SELECT product_id, name, brand, opaque_id, active, prices_json, updated_at FROM stripe_catalog ORDER BY name',
'2026-06-09T19:00:00Z', 'stripe', NULL),
('STRIPE_SKUS_BY_NAME', 'flow', '', '',
'# Find cached SKU by name pattern $1 (LIKE %$1%). Returns matching products + prices.
D1_QUERY: SELECT product_id, name, prices_json FROM stripe_catalog WHERE name LIKE ''%''||''$1''||''%''',
'2026-06-09T19:00:00Z', 'stripe', NULL);

-- ─── Slot rows for Secrets Store secrets this build will use later ───
-- (Auth column points at the env var name; binding still needs to be added in wrangler.toml.)

INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at, category, allowed_categories) VALUES

-- GitHub
('GITHUB_USER', 'http', 'GET https://api.github.com/user', 'bearer:GITHUB_TOKEN',
'# GET the GitHub user behind GITHUB_TOKEN. Use to confirm the secret is alive.',
'2026-06-09T19:00:00Z', 'github', NULL),
('GITHUB_REPO_GET', 'http', 'GET https://api.github.com/repos/$1', 'bearer:GITHUB_TOKEN',
'# GET repo metadata for $1 (owner/name). Use before any repo write.',
'2026-06-09T19:00:00Z', 'github', NULL),
('GITHUB_REPO_DISPATCH', 'http', 'POST https://api.github.com/repos/$1/dispatches', 'bearer:GITHUB_TOKEN',
'# Trigger a workflow_dispatch on repo $1 with event_type=$2. Use to fire GitHub Actions from the directory.
{"event_type":"$2","client_payload":$3}',
'2026-06-09T19:00:00Z', 'github', NULL),

-- Cloudflare API (account-level)
('CF_VERIFY', 'http', 'GET https://api.cloudflare.com/client/v4/user/tokens/verify', 'bearer:CLOUDFLARE_API_TOKEN',
'# Verify a CLOUDFLARE_API_TOKEN is valid. Use to test the binding before deploys/edits.',
'2026-06-09T19:00:00Z', 'cloudflare', NULL),
('CF_PAGES_DEPLOYMENTS', 'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/pages/projects/$2/deployments', 'bearer:CLOUDFLARE_API_TOKEN',
'# List deployments for Pages project $2 under account $1. Use to monitor what shipped recently.',
'2026-06-09T19:00:00Z', 'cloudflare', NULL),
('CF_WORKER_LIST', 'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/workers/scripts', 'bearer:CLOUDFLARE_API_TOKEN',
'# List Worker scripts for account $1.',
'2026-06-09T19:00:00Z', 'cloudflare', NULL),
('CF_KV_LIST_NS', 'http', 'GET https://api.cloudflare.com/client/v4/accounts/$1/storage/kv/namespaces', 'bearer:CLOUDFLARE_API_TOKEN',
'# List KV namespaces for account $1. Use before binding a new KV.',
'2026-06-09T19:00:00Z', 'cloudflare', NULL),

-- Meta (Graph API — distinct from META_CAPI_TOKEN which is the pixel-only token)
('META_ME', 'http', 'GET https://graph.facebook.com/v22.0/me?access_token=$ACCESS', 'headers:{"Accept":"application/json"}',
'# Verify META_ACCESS_TOKEN by GET /me. Auth via query param substituted from env.META_ACCESS_TOKEN; set ACCESS at call time.',
'2026-06-09T19:00:00Z', 'meta', NULL),
('META_AD_ACCOUNTS', 'http', 'GET https://graph.facebook.com/v22.0/$1/adaccounts', 'query:access_token=META_ACCESS_TOKEN',
'# List ad accounts under business $1=business_id. Use to discover ad account IDs.',
'2026-06-09T19:00:00Z', 'meta', NULL),
('META_CAMPAIGNS', 'http', 'GET https://graph.facebook.com/v22.0/$1/campaigns?fields=name,status,objective,daily_budget', 'query:access_token=META_ACCESS_TOKEN',
'# List campaigns for ad account $1=act_xxx. Use to enumerate live ads.',
'2026-06-09T19:00:00Z', 'meta', NULL),

-- Klaviyo (LIST + EVENTS)
('KLAVIYO_PROFILES', 'http', 'GET https://a.klaviyo.com/api/profiles/?page[size]=$1', 'headers:{"Authorization":"Klaviyo-API-Key $KLAVIYO_KEY","revision":"2024-10-15","Accept":"application/json"}',
'# List Klaviyo profiles, $1=page size. Use to audit subscribers / find a profile by email or phone.',
'2026-06-09T19:00:00Z', 'klaviyo', NULL),
('KLAVIYO_EVENTS', 'http', 'GET https://a.klaviyo.com/api/events/?page[size]=$1', 'headers:{"Authorization":"Klaviyo-API-Key $KLAVIYO_KEY","revision":"2024-10-15","Accept":"application/json"}',
'# List Klaviyo events, $1=page size. Use to audit recent activity.',
'2026-06-09T19:00:00Z', 'klaviyo', NULL),

-- BigCommerce (orders + products)
('BC_ORDERS', 'http', 'GET https://api.bigcommerce.com/stores/$BIGCOMMERCE_STORE_HASH/v2/orders?limit=$1', 'headers:{"X-Auth-Token":"$BIGCOMMERCE_TOKEN","Accept":"application/json"}',
'# List BigCommerce orders, $1=limit. Use as the source of truth for revenue + orders.',
'2026-06-09T19:00:00Z', 'bigcommerce', NULL),
('BC_PRODUCTS', 'http', 'GET https://api.bigcommerce.com/stores/$BIGCOMMERCE_STORE_HASH/v3/catalog/products?limit=$1', 'headers:{"X-Auth-Token":"$BIGCOMMERCE_TOKEN","Accept":"application/json"}',
'# List BigCommerce products, $1=limit.',
'2026-06-09T19:00:00Z', 'bigcommerce', NULL),

-- Triple Whale (attribution)
('TW_ATTRIBUTION', 'http', 'POST https://api.triplewhale.com/api/v2/attribution/get-orders-with-journeys-v2', 'headers:{"x-api-key":"$TRIPLEWHALE_API_KEY","Content-Type":"application/json"}',
'# Triple Whale attributed orders. $1=shop_domain $2=start $3=end (yyyy-mm-dd).
{"shop":"$1","startDate":"$2","endDate":"$3","timezone":"America/Los_Angeles"}',
'2026-06-09T19:00:00Z', 'triplewhale', NULL),

-- Gemini (Google Generative AI)
('GEMINI_GENERATE', 'http', 'POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', 'query:key=GEMINI_KEY',
'# Generate text via Gemini 2.5 Flash. $1=JSON contents array. Use as a cheaper alternative to Grok for batch summarization.
{"contents":$1}',
'2026-06-09T19:00:00Z', 'llm', NULL),

-- 2Chat (WhatsApp)
('TWOCHAT_SEND', 'http', 'POST https://api.p.2chat.io/open/whatsapp/send-message', 'headers:{"X-User-API-Key":"$TWOCHAT_API_KEY","Content-Type":"application/json"}',
'# Send a WhatsApp message. $1=from_number $2=to_number $3=text. Mirror of BLOOIO_SEND for the WhatsApp channel.
{"from_number":"$1","to_number":"$2","text":"$3"}',
'2026-06-09T19:00:00Z', 'twochat', NULL);

-- ─── the owner-owned agent rows (do NOT touch content) ───
-- ROUTER, XAI_CHAT, GROK_AUDIT contents are untouched.
