// sheet_views — a sheet as a projection of a source of record.
//
// The ledger (LEDGER.events) and the directory (DB.directory) are the sources of record. A view
// sheet stores no rows of its own: it stores a description — which table, which rows, which
// columns, how each column renders — and every open of the tab re-reads the source. Adding a
// column, changing a filter or pinning an object row is an edit to that description, made from
// the grid, and needs no code.
//
// Stored in user_sheets.col_meta as:
//   view:    { source, filters:[{field, op, value}], where, columns:[{path, header, format, w}], limit }
//   formats: { <field or data-col index>: 'text'|'json'|'time'|'number'|'link'|'image' }
//   pins:    [{ label, ref }]   ref = 'directory/<KEY>/<field>' | 'sheet/<sheet_id>/<A1>'
//
// A column path is a source column, optionally followed by a JSON path into it:
//   request_json.body.messages[0].content   ->  json_extract(request_json, '$.body.messages[0].content')
// so the exact text a model was sent is one column away from the row that sent it.

import { buildNowIso } from './build_time.js';
import { logEvent } from './event_log.js';
import { getSheet, getValues, setValues, parseCellRef, colToLetter } from './sheets_store.js';

export const EVENT_FIELDS = [
  'id', 'ts', 'build', 'source', 'key', 'route', 'actor', 'action', 'direction', 'status',
  'trace_id', 'step', 'parent', 'request_preview', 'response_preview', 'request_size',
  'response_size', 'request_json', 'response_json', 'r2_request_key', 'r2_response_key',
  'legacy_table', 'legacy_id',
];

export const DIRECTORY_FIELDS = [
  'key', 'type', 'target', 'auth', 'content', 'updated_at', 'category', 'allowed_categories', 'seq',
  'enabled', 'planner_visible', 'planner_rank', 'input_schema', 'examples', 'sensitive', 'runner',
  'includes', 'created_at', 'price_usd', 'meter_unit',
  // Environment descriptor (migration 0373). descriptor_json is the canonical object contract, so a
  // column path like descriptor_json.governance.direct or descriptor_json.comparables[0].dimensions
  // projects any part of it with the generic JSON-path grammar — no descriptor-specific feature.
  'object_kind', 'descriptor_json', 'descriptor_rev', 'descriptor_hash',
  // Invocation record (migration 0375): the raw REST call, the last transport record, the last
  // full payload and the 🟢/🟡/🔴 state — so a directory view is a live tool-status board.
  'invocation', 'invocation_curl', 'last_status', 'last_response', 'test_state', 'tested_at',
];

// Every table a view may read. `db` names the binding; `ts` the column that orders it.
export const SOURCES = {
  ledger:             { db: 'LEDGER', table: 'events',             ts: 'ts',         fields: EVENT_FIELDS, json: ['request_json', 'response_json'] },
  directory:          { db: 'DB',     table: 'directory',          ts: 'updated_at', fields: DIRECTORY_FIELDS, json: ['descriptor_json', 'invocation', 'last_status'] },
  directory_versions: { db: 'DB',     table: 'directory_versions', ts: 'ts',         fields: ['key', 'version', 'content', 'content_hash', 'actor', 'ts', 'descriptor_json', 'descriptor_hash'], json: ['descriptor_json'] },
  agent_turns:        { db: 'DB',     table: 'agent_turns',        ts: 'ts',         fields: ['id', 'ts', 'agent', 'source', 'session', 'trace_id', 'input_kind', 'user_input', 'assistant_text', 'n_tools', 'tools_json', 'commands_json', 'files_json', 'model_id', 'tokens_in', 'tokens_out', 'cost_usd', 'turn_key'], json: ['tools_json', 'commands_json', 'files_json'] },
  turn_jobs:          { db: 'DB',     table: 'turn_jobs',          ts: 'created_at', fields: ['id', 'job_json', 'status', 'attempts', 'created_at', 'updated_at'], json: ['job_json'] },
  // Articles are content objects: a view over them is the article list as a grid, and title, subject,
  // published, body and meta write through to PATCH /api/articles/<slug> (a body edit by hash).
  articles:           { db: 'DB',     table: 'articles',           ts: 'updated_at', fields: ['slug', 'title', 'subject', 'published', 'created_at', 'updated_at', 'body', 'meta'], json: ['meta'] },
  pending_deliveries: { db: 'DB',     table: 'pending_deliveries', ts: 'created_at', fields: ['id', 'asset_id', 'kind', 'model', 'chat', 'channel', 'trace_id', 'status', 'created_at', 'updated_at'], json: [] },
  // Identity + authority: the one profile object, its devices, and the mutable half of a capability.
  profiles:           { db: 'DB',     table: 'traffic_profiles',   ts: 'last_seen',  fields: ['id', 'tenant_id', 'kind', 'known', 'customer', 'tags_json', 'attrs_json', 'visit_count', 'first_seen', 'last_seen', 'merged_into', 'version', 'updated_at'], json: ['tags_json', 'attrs_json'] },
  devices:            { db: 'DB',     table: 'traffic_devices',    ts: 'last_seen',  fields: ['id', 'profile_id', 'trusted', 'trusted_at', 'trust_reason', 'trust_expires_at', 'revoked_at', 'last_verification', 'verification_method', 'label', 'class', 'browser', 'os', 'first_seen', 'last_seen', 'visit_count'], json: [] },
  profile_events:     { db: 'DB',     table: 'traffic_events',     ts: 'ts',         fields: ['id', 'ts', 'event_type', 'profile_id', 'device_id', 'session_id', 'url', 'source', 'payload_json', 'evidence_hash'], json: ['payload_json'] },
  capability_contexts:{ db: 'LEDGER', table: 'capability_contexts', ts: 'updated_at', fields: ['fingerprint', 'tenant_id', 'profile_id', 'actor_kind', 'device_ids_json', 'session_ids_json', 'state_handles_json', 'origins_json', 'require_verification_s', 'require_pop', 'policy_json', 'policy_rev', 'updated_at', 'updated_by'], json: ['device_ids_json', 'session_ids_json', 'state_handles_json', 'origins_json', 'policy_json'] },
  // Browser-model substrate: the durable sessions and turns the gateway writes.
  webmodel_sessions:  { db: 'DB',     table: 'webmodel_sessions',  ts: 'updated_at', fields: ['session_id', 'provider', 'state', 'conversation_url', 'provider_conversation_id', 'last_turn_id', 'state_handle', 'created_at', 'updated_at', 'metadata_json'], json: ['metadata_json'] },
  webmodel_turns:     { db: 'DB',     table: 'webmodel_turns',     ts: 'started_at', fields: ['turn_id', 'session_id', 'ordinal', 'provider', 'status', 'capture_method', 'user_content', 'assistant_content', 'started_at', 'completed_at', 'failure_code', 'response_digest', 'ledger_event_id', 'state_handle'], json: [] },
  traffic_rulesets:    { db: 'DB', table: 'traffic_rulesets',    ts: 'updated_at', fields: ['id', 'name', 'state', 'priority', 'entry_json', 'default_destination', 'fail_mode', 'campaign_id', 'revision', 'hash', 'activated_at', 'updated_at'], json: ['entry_json'] },
  traffic_rules:       { db: 'DB', table: 'traffic_rules',       ts: 'updated_at', fields: ['id', 'ruleset_id', 'name', 'enabled', 'shadow', 'priority', 'condition_json', 'actions_json', 'on_match', 'revision', 'updated_at'], json: ['condition_json', 'actions_json'] },
  traffic_destinations:{ db: 'DB', table: 'traffic_destinations',ts: 'updated_at', fields: ['id', 'name', 'type', 'url', 'enabled', 'health', 'fallback_id', 'grant_required', 'grant_ttl_s', 'campaign_id', 'updated_at'], json: [] },
  traffic_lists:       { db: 'DB', table: 'traffic_list_entries',ts: 'updated_at', fields: ['id', 'list', 'kind', 'value', 'reason', 'effect', 'enabled', 'priority', 'expires_at', 'created_by', 'updated_at'], json: ['effect_json'] },
  traffic_campaigns:   { db: 'DB', table: 'traffic_campaigns',   ts: 'updated_at', fields: ['id', 'name', 'enabled', 'ruleset_id', 'entry', 'sms_phone', 'sms_channel', 'blocked_capture', 'approved_destination', 'blocked_destination', 'review_destination', 'updated_at'], json: [] },
  traffic_squeeze_pages:{ db: 'DB', table: 'traffic_squeeze_pages', ts: 'updated_at', fields: ['id', 'campaign_id', 'name', 'enabled', 'status', 'version', 'weight', 'headline', 'cta_text', 'message_template', 'updated_at'], json: ['media_json'] },
  traffic_signal_policy:{ db: 'DB', table: 'traffic_signal_policy', ts: 'updated_at', fields: ['id', 'signal', 'value', 'effect', 'effect_value', 'note', 'enabled', 'updated_at'], json: [] },
  traffic_decisions:   { db: 'DB', table: 'traffic_decisions',   ts: 'ts',         fields: ['decision_id', 'ts', 'mode', 'host', 'path', 'entry', 'profile_id', 'device_id', 'ruleset_id', 'destination_id', 'experience', 'outcome', 'reason', 'fallback_used', 'latency_ms', 'campaign_id'], json: ['matched_rules_json', 'list_matches_json'] },
  traffic_memberships: { db: 'DB', table: 'traffic_memberships', ts: 'updated_at', fields: ['id', 'subject_kind', 'subject_value', 'status', 'population', 'source', 'confidence', 'effective_status', 'created_by', 'created_at', 'superseded_at'], json: ['provenance_json'] },
  traffic_grants:      { db: 'DB', table: 'traffic_grants',      ts: 'issued_at',  fields: ['jti', 'audience', 'destination_id', 'profile_id', 'device_id', 'issued_at', 'expires_at', 'one_time', 'consumed_at', 'status', 'decision_id'], json: [] },
  traffic_codes:       { db: 'DB', table: 'traffic_codes',       ts: 'issued_at',  fields: ['code', 'campaign_id', 'squeeze_page_id', 'profile_id', 'device_id', 'status', 'phone_masked', 'issued_at', 'received_at', 'verified_at', 'outcome'], json: [] },
  // Growth graph (0383–0386): providers → media hierarchy → versions → bridge → observations → proposals. Flattened for inspection.
  growth_providers:     { db: 'DB', table: 'providers',            ts: 'updated_at', fields: ['id', 'name', 'category', 'cap_entity_reads', 'cap_metric_reads', 'cap_budget_mutation', 'cap_status_mutation', 'cap_conversion_upload', 'cap_competitor_ads', 'cap_traffic_estimates', 'verified_at', 'adapter_module'], json: ['channels_json'] },
  growth_connections:   { db: 'DB', table: 'provider_connections', ts: 'updated_at', fields: ['id', 'provider_id', 'external_account_id', 'label', 'state', 'secret_ref', 'last_health', 'last_error', 'updated_at'], json: ['scopes_json'] },
  growth_syncs:         { db: 'DB', table: 'sync_runs',            ts: 'started_at', fields: ['id', 'provider_id', 'kind', 'window_start', 'window_end', 'state', 'started_at', 'finished_at', 'evidence_id'], json: ['counts_json', 'errors_json', 'invocation_ids_json'] },
  growth_evidence:      { db: 'DB', table: 'evidence_records',     ts: 'ts',         fields: ['id', 'ts', 'evidence_class', 'source', 'sync_run_id', 'raw_snapshot_id', 'normalizer_version', 'confidence', 'actor'], json: ['request_json', 'derived_json'] },
  growth_observations:  { db: 'DB', table: 'metric_observations',  ts: 'observed_at', fields: ['subject_type', 'subject_id', 'metric', 'value', 'state', 'interval_start', 'interval_end', 'currency', 'source', 'evidence_class', 'observed_at'], json: ['dimensions_json'] },
  growth_brands:        { db: 'DB', table: 'brands',               ts: 'updated_at', fields: ['id', 'name', 'is_self', 'vertical', 'evidence_class', 'first_seen', 'last_seen'], json: ['domains_json', 'social_json', 'ad_accounts_json', 'competitor_of_json'] },
  growth_initiatives:   { db: 'DB', table: 'media_initiatives',    ts: 'updated_at', fields: ['id', 'account_id', 'provider_id', 'external_id', 'name', 'objective', 'status', 'daily_budget', 'lifetime_budget', 'channel_id', 'traffic_campaign_id', 'synced_at'], json: [] },
  growth_groups:        { db: 'DB', table: 'media_groups',         ts: 'updated_at', fields: ['id', 'initiative_id', 'external_id', 'name', 'status', 'daily_budget', 'bid_amount', 'optimization_goal', 'synced_at'], json: ['targeting_json'] },
  growth_deployments:   { db: 'DB', table: 'media_deployments',    ts: 'updated_at', fields: ['id', 'group_id', 'initiative_id', 'provider_id', 'external_id', 'name', 'status', 'creative_id', 'creative_version_id', 'experience_version_id', 'first_seen', 'last_seen'], json: [] },
  growth_creatives:     { db: 'DB', table: 'creative_versions',    ts: 'created_at', fields: ['id', 'creative_id', 'version', 'parent_version_id', 'headline', 'body', 'cta', 'hook', 'angle', 'persona', 'proof_type', 'source', 'change_reason', 'created_at'], json: ['tags_json', 'provider_external_ids_json'] },
  growth_versions:      { db: 'DB', table: 'experience_versions',  ts: 'created_at', fields: ['id', 'experience_id', 'version', 'parent_version_id', 'ref_table', 'ref_id', 'artifact_hash', 'state', 'source', 'first_exposure_at', 'created_at'], json: ['components_json'] },
  growth_allocation:    { db: 'DB', table: 'allocation_policy_versions', ts: 'created_at', fields: ['id', 'experience_id', 'version', 'unit', 'sticky', 'reason', 'effective_from', 'effective_to'], json: ['policy_json'] },
  growth_clicks:        { db: 'DB', table: 'media_clicks',         ts: 'ts',         fields: ['id', 'ts', 'click_kind', 'provider_id', 'deployment_external_id', 'profile_id', 'decision_id', 'experience_version_id', 'destination_id'], json: ['utm_json'] },
  growth_touchpoints:   { db: 'DB', table: 'touchpoints',          ts: 'ts',         fields: ['id', 'ts', 'subject_kind', 'subject_id', 'channel_id', 'provider_id', 'deployment_id', 'experience_version_id', 'action', 'value', 'evidence_class', 'confidence'], json: [] },
  growth_orders:        { db: 'DB', table: 'orders',               ts: 'ts',         fields: ['id', 'brand_id', 'profile_id', 'provider_id', 'external_id', 'ts', 'gross', 'net', 'contribution_margin', 'first_order'], json: ['items_json'] },
  growth_economics:     { db: 'DB', table: 'customer_economics',   ts: 'computed_at', fields: ['profile_id', 'orders', 'gross', 'net', 'refunds', 'contribution_margin', 'ltv_30', 'ltv_90', 'realized_ltv', 'predicted_ltv', 'acquisition_channel_id', 'computed_at'], json: [] },
  growth_proposals:     { db: 'DB', table: 'action_proposals',     ts: 'ts',         fields: ['id', 'ts', 'actor', 'action', 'target_type', 'target_id', 'provider_id', 'reason', 'required_authority', 'approval_state', 'budget_bound', 'max_loss', 'approval_expires_at', 'receipt_id'], json: ['before_json', 'after_json', 'rollback_plan_json'] },
  growth_receipts:      { db: 'DB', table: 'action_receipts',      ts: 'ts',         fields: ['id', 'proposal_id', 'ts', 'actor', 'provider_mutation_id', 'result', 'error', 'invocation_id', 'ledger_event_id'], json: ['attempted_payload_json', 'provider_response_json'] },
  growth_hypotheses:    { db: 'DB', table: 'hypotheses',           ts: 'ts',         fields: ['id', 'ts', 'actor', 'statement', 'status', 'confidence', 'conclusion'], json: ['basis_json', 'proposed_action_json'] },
};

export const FORMATS = ['text', 'json', 'time', 'number', 'link', 'image'];

// The full-payload column set: what went down the wire, not a 500-character preview.
// TIME, THEN THE RAW PAYLOAD. IN THAT ORDER, BECAUSE THAT IS WHAT THE LEDGER IS FOR.
// The previous order put nine identifier columns before the payload, so opening a ledger view
// showed you a row's metadata and made you scroll to reach the only thing you came for: what was
// actually sent and what actually came back. Identity still travels with the row — it just sits
// after the evidence instead of in front of it.
const LEDGER_DEFAULT_COLUMNS = [
  { path: 'ts', header: 'time', format: 'time', w: 160 },
  { path: 'request_json', header: 'RAW IN', format: 'json', w: 520 },
  { path: 'response_json', header: 'RAW OUT', format: 'json', w: 520 },
  { path: 'source', header: 'source', w: 100 },
  { path: 'key', header: 'key', w: 150 },
  { path: 'action', header: 'action', w: 120 },
  { path: 'actor', header: 'actor', w: 130 },
  { path: 'status', header: 'status', format: 'number', w: 60 },
  { path: 'direction', header: 'dir', w: 56 },
  { path: 'trace_id', header: 'trace', w: 120 },
  { path: 'id', header: 'id', w: 260 },
];

export const LEDGER_NOISE_SOURCE = 'jci';
export const LEDGER_NOISE_SOURCES = ['jci', 'dispatch'];

// Ready-made descriptions. `param` names what the person supplies when they pick one.
export const TEMPLATES = [
  { id: 'blooio', title: 'Blooio', what: 'every raw payload in and out of the iMessage line',
    view: { source: 'ledger', filters: [{ field: 'source', op: '=', value: 'blooio' }], columns: LEDGER_DEFAULT_COLUMNS } },
  { id: 'blooio_number', title: 'Blooio + a number', param: { name: 'number', hint: '[OWNER_PHONE]' },
    what: 'every Blooio payload that mentions one phone number',
    view: { source: 'ledger', filters: [{ field: 'source', op: '=', value: 'blooio' }, { field: 'any', op: 'contains', value: '{{number}}' }], columns: LEDGER_DEFAULT_COLUMNS } },
  { id: 'blooio_chat', title: 'Blooio + a chat / group id', param: { name: 'chat', hint: 'chat_019ec103-…' },
    what: 'every Blooio payload for one chat or group',
    view: { source: 'ledger', filters: [{ field: 'source', op: '=', value: 'blooio' }, { field: 'any', op: 'contains', value: '{{chat}}' }], columns: LEDGER_DEFAULT_COLUMNS } },
  { id: 'turn', title: 'One turn (trace)', param: { name: 'trace', hint: 't_dwrgjg1g' },
    what: 'every payload that belongs to one turn, in order',
    view: { source: 'ledger', filters: [{ field: 'trace_id', op: '=', value: '{{trace}}' }], order: 'asc', columns: LEDGER_DEFAULT_COLUMNS } },
  { id: 'model_calls', title: 'Model calls', what: 'every request sent to a model and what came back',
    view: { source: 'ledger', filters: [{ field: 'action', op: 'in', value: 'chat_completion,agent,fn_call,invoke' }, { field: 'source', op: 'in', value: 'grok,aig,aigateway,invoke_json,openai,cloudflare' }],
      columns: LEDGER_DEFAULT_COLUMNS.concat([
        { path: 'request_json.body.model', header: 'model', w: 120 },
        { path: 'request_json.body.messages[0].content', header: 'system prompt sent', w: 360 },
        { path: 'request_json.body.temperature', header: 'temperature', format: 'number', w: 90 },
        { path: 'response_json.choices[0].message.content', header: 'model text', w: 360 },
        { path: 'response_json.usage.total_tokens', header: 'tokens', format: 'number', w: 80 },
      ]) } },
  { id: 'klaviyo', title: 'Klaviyo', what: 'every Klaviyo call and its response',
    view: { source: 'ledger', filters: [{ field: 'any_key', op: 'contains', value: 'KLAVIYO' }], columns: LEDGER_DEFAULT_COLUMNS } },
  { id: 'bigcommerce', title: 'BigCommerce', what: 'every BigCommerce call and its response',
    view: { source: 'ledger', filters: [{ field: 'any_key', op: 'contains', value: 'BC' }, { field: 'source', op: 'in', value: 'dispatch,bigcommerce,bc,sync' }], columns: LEDGER_DEFAULT_COLUMNS } },
  { id: 'source', title: 'Ledger — one source', param: { name: 'source', hint: 'grok, dispatch, email, stripe, meta, x, sheets…' },
    what: 'every payload from one source',
    view: { source: 'ledger', filters: [{ field: 'source', op: '=', value: '{{source}}' }], columns: LEDGER_DEFAULT_COLUMNS } },
  { id: 'agents', title: 'Directory — agents', what: 'every agent row: its model and its whole system prompt',
    view: { source: 'directory', filters: [{ field: 'type', op: '=', value: 'agent' }],
      columns: [{ path: 'key', header: 'agent', w: 180 }, { path: 'target', header: 'model', w: 200 }, { path: 'content', header: 'system prompt', w: 600 }, { path: 'updated_at', header: 'updated', format: 'time', w: 150 }] } },
  { id: 'traffic', title: 'Traffic — Blooio + AI Gateway (raw)',
    what: 'every raw payload in and out of the phone line and the model gateway, with the message, the prompt and the tool tags pulled out',
    view: { source: 'ledger',
      filters: [{ field: 'source', op: 'in', value: 'blooio,grok,aig,aigateway,invoke_json,openai' }],
      columns: [
        { path: 'ts', header: 'time', format: 'time', w: 155 },
        { path: 'source', header: 'source', w: 85 },
        { path: 'direction', header: 'dir', w: 50 },
        // One column for "what was actually said", whichever lane the row came from: the iMessage
        // text if it is one, otherwise what the model answered.
        { path: '=IF(JSON(request_json,"$.data.text")<>"",JSON(request_json,"$.data.text"),JSON(response_json,"$.choices[0].message.content"))', header: 'the message', w: 380 },
        { path: '=REGEXALL(response_json,"\\[([A-Z][A-Z0-9_]{2,})\\]")', header: 'tool tags emitted', w: 200 },
        { path: '=JSON(request_json,"$.body.messages[0].content")', header: 'system prompt sent', w: 340 },
        { path: '=JSON(request_json,"$.model")', header: 'model', w: 150 },
        { path: '=JSON(request_json,"$.data.sender")', header: 'from', w: 130 },
        { path: 'request_json', header: 'RAW IN', format: 'json', w: 520 },
        { path: 'response_json', header: 'RAW OUT', format: 'json', w: 520 },
        { path: 'key', header: 'key', w: 150 },
        { path: 'action', header: 'action', w: 130 },
        { path: 'status', header: 'status', format: 'number', w: 58 },
        { path: 'trace_id', header: 'trace', w: 120 },
      ] } },
  { id: 'custom', title: 'Custom (write the WHERE)', param: { name: 'where', hint: "source='blooio' AND request_json LIKE '%How are you%'" },
    what: 'any table, any condition — SQL WHERE clause, read-only',
    view: { source: 'ledger', where: '{{where}}', columns: LEDGER_DEFAULT_COLUMNS } },
];

function ident(s) { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(s || '')); }

// 'request_json.body.messages[0].content' -> { col:'request_json', json:'$.body.messages[0].content' }
export function parsePath(path) {
  const p = String(path || '').trim();
  const m = p.match(/^([A-Za-z_][A-Za-z0-9_]*)(?:[.[](.*))?$/);
  if (!m) return null;
  const col = m[1];
  if (!m[2]) return { col, json: null };
  const rest = p.slice(col.length);
  // SQLite JSON paths: '$' + '.a.b[0].c'. A leading '[' is already valid after '$'.
  return { col, json: '$' + (rest.charAt(0) === '.' ? rest : rest) };
}

function colSql(src, path) {
  const pp = parsePath(path);
  if (!pp || !src.fields.includes(pp.col)) return null;
  if (!pp.json) return pp.col;
  if (!/^\$[A-Za-z0-9_.[\]$-]*$/.test(pp.json)) return null;
  const jp = "'" + pp.json.replace(/'/g, "''") + "'";
  return "CASE WHEN json_valid(" + pp.col + ") THEN json_extract(" + pp.col + ", " + jp + ") END";
}

const OPS = { '=': '=', '!=': '!=', '>': '>', '<': '<', '>=': '>=', '<=': '<=' };

// Filters become parameterized WHERE terms. Two virtual fields cover "anything about X":
//   any      — every text column of the row (payloads included)
//   any_key  — key, source, action and route
function filterSql(src, f) {
  const field = String(f.field || '').trim();
  const op = String(f.op || '=').toLowerCase();
  const value = f.value == null ? '' : String(f.value);
  if (!value && op !== 'empty' && op !== 'not_empty') return null;
  if (field === 'any') {
    const cols = src.fields.filter((c) => !/size|step|parent|status|version|seq|rank|enabled|sensitive|price/.test(c));
    return { clause: '(' + cols.map((c) => c + ' LIKE ?').join(' OR ') + ')', binds: cols.map(() => '%' + value + '%') };
  }
  if (field === 'any_key') {
    const cols = ['key', 'source', 'action', 'route'].filter((c) => src.fields.includes(c));
    return { clause: '(' + cols.map((c) => c + ' LIKE ?').join(' OR ') + ')', binds: cols.map(() => '%' + value + '%') };
  }
  const col = colSql(src, field);
  if (!col) return null;
  if (op === 'contains' || op === 'like') return { clause: col + ' LIKE ?', binds: ['%' + value.replace(/^%|%$/g, '') + '%'] };
  if (op === 'starts') return { clause: col + ' LIKE ?', binds: [value + '%'] };
  if (op === 'in' || op === 'not-in') {
    const vals = value.split(',').map((s) => s.trim()).filter(Boolean);
    if (!vals.length) return null;
    const set = '(' + vals.map(() => '?').join(',') + ')';
    // NULL is not "not in" anything in SQL, so a bare NOT IN silently drops every row whose source
    // was never set. The default noise filter would then hide real traffic, which is the opposite
    // of what it is for.
    return op === 'in'
      ? { clause: col + ' IN ' + set, binds: vals }
      : { clause: '(' + col + ' IS NULL OR ' + col + ' NOT IN ' + set + ')', binds: vals };
  }
  if (op === 'empty') return { clause: '(' + col + " IS NULL OR " + col + " = '')", binds: [] };
  if (op === 'not_empty') return { clause: '(' + col + " IS NOT NULL AND " + col + " != '')", binds: [] };
  if (OPS[op]) return { clause: col + ' ' + OPS[op] + ' ?', binds: [/^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value] };
  return null;
}

function safeWhere(where) {
  const w = String(where || '').trim();
  if (!w) return '';
  if (/;|--|\/\*/.test(w)) throw new Error('where: no statement breaks or comments');
  if (/\b(attach|pragma|insert|update|delete|drop|alter|create|replace|vacuum)\b/i.test(w)) throw new Error('where: read-only conditions only');
  return w;
}


// AN EXPRESSION COLUMN: THE POINT OF THE WHOLE THING.
// `=REGEX(response_json,"\\[([A-Z_0-9]{2,})\\]")` is a column, evaluated once per row, with every
// field of that row in scope by its own name. Change the pattern, reopen, and the whole slice is
// re-tested. Without this a projection could only ever show what the table already stored, so
// asking "did the tool tag fire on these 300 turns" meant writing product code.
export function isExpressionColumn(path) {
  return typeof path === 'string' && path.trim().charAt(0) === '=';
}

// A RECALCULATION MUST NEVER SPEND MONEY OR SEND ANYTHING (law://sheets/S01).
// A stored cell may call a tool, because a person typed it into one cell and it runs once. A view
// column runs once PER ROW, every time the tab is opened — a =DISPATCH there would fire hundreds
// of real calls on a scroll. Refused by name, with the lane that does work said out loud.
const EFFECTFUL_IN_EXPRESSION = /\b(DISPATCH|TAG|INVOKE|LLMCALL|IMAGE|D1QUERY|SEARCH|SEARCHCOUNT)\s*\(/i;

export function normalizeView(view) {
  const v = view && typeof view === 'object' ? view : {};
  const source = SOURCES[v.source] ? v.source : 'ledger';
  const src = SOURCES[source];
  const columns = (Array.isArray(v.columns) && v.columns.length ? v.columns : LEDGER_DEFAULT_COLUMNS)
    .map((c) => (typeof c === 'string' ? { path: c } : c))
    // A column is EITHER a stored field (optionally with a JSON path) OR an expression. An
    // expression starts with '=' and is not checked against the table's columns, because its
    // whole point is to compute something the table does not store.
    .filter((c) => c && c.path && (isExpressionColumn(c.path) || (parsePath(c.path) && src.fields.includes(parsePath(c.path).col))))
    .map((c) => ({
      path: String(c.path), header: String(c.header || c.path).slice(0, 80),
      format: FORMATS.includes(c.format) ? c.format
        : (isExpressionColumn(c.path) ? 'text'
          : (parsePath(c.path).json ? 'text' : (src.json.includes(c.path) ? 'json' : (c.path === src.ts ? 'time' : 'text')))),
      w: Math.max(40, Math.min(1200, parseInt(c.w, 10) || 140)),
    }));
  const filters = (Array.isArray(v.filters) ? v.filters : []).filter((f) => f && f.field).slice(0, 12);
  if (source === 'ledger' && !filters.some((f) => String(f.field) === 'source')) {
    filters.unshift({ field: 'source', op: 'not-in', value: LEDGER_NOISE_SOURCES.join(',') });
  }
  return {
    source,
    filters,
    where: String(v.where || '').slice(0, 2000),
    columns: columns.length ? columns : LEDGER_DEFAULT_COLUMNS.slice(0, 4),
    order: v.order === 'asc' ? 'asc' : 'desc',
    limit: Math.max(1, Math.min(2000, parseInt(v.limit, 10) || 300)),
  };
}

// Run one view. Returns the rows as strings (the grid's currency) plus per-row identity.
export async function runView(env, viewIn, { limit, before, after } = {}) {
  const view = normalizeView(viewIn);
  const src = SOURCES[view.source];
  const db = env[src.db];
  if (!db) return { error: src.db + '_unbound', columns: view.columns, rows: [], meta: [] };
  const where = [];
  const binds = [];
  for (const f of view.filters) {
    const t = filterSql(src, f);
    if (t) { where.push(t.clause); binds.push(...t.binds); }
  }
  const raw = safeWhere(view.where);
  if (raw) where.push('(' + raw + ')');
  if (before) { where.push(src.ts + ' < ?'); binds.push(String(before)); }
  if (after) { where.push(src.ts + ' > ?'); binds.push(String(after)); }
  // Stored columns are selected. Expression columns select nothing — instead the raw fields their
  // text names are fetched alongside, so each one can be evaluated against its own row below.
  const selects = [];
  const exprCols = [];
  view.columns.forEach((c, i) => {
    if (isExpressionColumn(c.path)) { exprCols.push({ i, expr: c.path }); return; }
    selects.push(colSql(src, c.path) + ' AS c' + i);
  });
  const needed = new Set();
  for (const { expr } of exprCols) {
    for (const m of String(expr).matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)) {
      if (src.fields.includes(m[0])) needed.add(m[0]);
    }
  }
  for (const f of needed) selects.push(f + ' AS f_' + f);
  const idCol = src.fields.includes('id') ? 'id' : (src.fields.includes('key') ? 'key' : src.fields[0]);
  selects.push(idCol + ' AS __id', src.ts + ' AS __ts');
  if (src.fields.includes('trace_id')) selects.push('trace_id AS __trace');
  const lim = Math.max(1, Math.min(2000, parseInt(limit, 10) || view.limit));
  const sql = 'SELECT ' + selects.join(', ') + ' FROM ' + src.table
    + (where.length ? ' WHERE ' + where.join(' AND ') : '')
    + ' ORDER BY ' + src.ts + ' ' + (view.order === 'asc' ? 'ASC' : 'DESC') + ' LIMIT ?';
  binds.push(lim);
  // A FAILED READ IS NOT AN EMPTY RESULT.
  // D1 answers "overloaded" under load, and the first version of this returned rows:[] with no
  // error alongside ok:true — indistinguishable from "nothing matched". I hit it during
  // verification: the same query gave 0 rows, then 25 rows ten seconds later. A person who cannot
  // tell a failure from an empty table stops trusting a sheet that is correct. Silence is not a
  // pass anywhere else in this build and it is not one here: `ok` is false and `error` is set, and
  // a transient failure says so in the word the reader needs.
  let res;
  try { res = await db.prepare(sql).bind(...binds).all(); }
  catch (e) {
    const detail = String(e && e.message || e);
    const transient = /overload|too many|timeout|429|503|storage/i.test(detail);
    return {
      ok: false, error: 'query_failed', transient, detail, sql,
      say: transient
        ? 'The database was busy, so this view could not be read. This is NOT an empty result — reopen the tab.'
        : 'This view could not be read. It is NOT an empty result.',
      columns: view.columns, rows: [], meta: [],
    };
  }
  if (!res || !Array.isArray(res.results)) {
    return {
      ok: false, error: 'read_returned_nothing', transient: true, sql,
      say: 'The read came back with no result set at all, which is a failure and not an empty table. Reopen the tab.',
      columns: view.columns, rows: [], meta: [],
    };
  }
  let evaluate = null;
  if (exprCols.length) {
    ({ evaluate } = await import('./sheet_formula.js'));
  }
  const rows = [];
  const meta = [];
  for (const r of (res.results || [])) {
    const cells = view.columns.map((c, i) => {
      const v = r['c' + i];
      if (v == null) return '';
      return typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
    for (const { i, expr } of exprCols) {
      // Test the CODE, not the strings. A column whose job is to SHOW the formula —
      // ="=DISPATCH("&key&",…)" — contains the word DISPATCH inside a quoted literal and calls
      // nothing. Blanking string literals first is the difference between a column that displays
      // a call and a column that makes one.
      if (EFFECTFUL_IN_EXPRESSION.test(String(expr).replace(/"(?:[^"\\]|\\.)*"/g, '""'))) {
        cells[i] = '#NO_EFFECTS — a column runs once per row on every open. Put the call in a stored sheet cell instead.';
        continue;
      }
      // Every field of THIS row, by its own name. readCell is inert: a projection has no A1 grid
      // of its own, so an accidental =A1 reads empty rather than reaching into some other sheet.
      const ctx = {
        field: async (name) => (Object.prototype.hasOwnProperty.call(r, 'f_' + name)
          ? (r['f_' + name] == null ? '' : String(r['f_' + name]))
          : undefined),
        readCell: async () => '',
      };
      try { cells[i] = String(await evaluate(expr, ctx)); }
      catch (e) { cells[i] = '#ERROR ' + String(e && e.message || e).slice(0, 120); }
    }
    rows.push(cells);
    meta.push({
      id: r.__id == null ? '' : String(r.__id), ts: r.__ts || '', trace_id: r.__trace || '',
      href: view.source === 'ledger' ? '/admin/ledger/' + encodeURIComponent(String(r.__id)) + '?data=1'
        : view.source === 'directory' ? '/admin/directory/' + encodeURIComponent(String(r.__id))
        : view.source === 'articles' ? '/admin/articles/' + encodeURIComponent(String(r.__id)) : '',
    });
  }
  return { ok: true, view, columns: view.columns, rows, meta, sql, count: rows.length, source: view.source };
}

// ── pins: object rows that stick to the top of a sheet ────────────────────────────────────
//
// A pin is a reference to one field of one object in a source of record. It is shown in a
// band above the grid, edits in place, and the edit lands on the object itself — so a system
// prompt pinned above a turn log is the directory row, not a copy of it.

export function parseRef(ref) {
  const s = String(ref || '').trim();
  let m = s.match(/^directory\/([^/]+)\/([A-Za-z_][A-Za-z0-9_]*)$/);
  if (m) return { kind: 'directory', key: decodeURIComponent(m[1]), field: m[2] };
  m = s.match(/^sheet\/([A-Za-z0-9_-]+)\/([A-Za-z]{1,3}\d{1,6})$/);
  if (m) return { kind: 'sheet', sheet_id: m[1], cell: m[2].toUpperCase() };
  m = s.match(/^settings\/([A-Za-z0-9_.:-]+)$/);
  if (m) return { kind: 'settings', key: m[1] };
  return null;
}

const DIR_PIN_FIELDS = new Set(['content', 'target', 'type', 'auth', 'category', 'includes', 'input_schema', 'examples', 'runner', 'enabled', 'planner_visible', 'planner_rank', 'seq', 'sensitive', 'allowed_categories']);

export async function resolvePins(env, pins) {
  const out = [];
  for (const p of (Array.isArray(pins) ? pins : []).slice(0, 24)) {
    const ref = parseRef(p && p.ref);
    const item = { label: String((p && p.label) || (p && p.ref) || ''), ref: String((p && p.ref) || ''), value: '', href: '', editable: false, error: '' };
    if (!ref) { item.error = 'unreadable ref — use directory/<KEY>/<field>, sheet/<id>/<A1> or settings/<key>'; out.push(item); continue; }
    try {
      if (ref.kind === 'directory') {
        if (!DIR_PIN_FIELDS.has(ref.field) && ref.field !== 'key' && ref.field !== 'updated_at') { item.error = 'field not on a directory row'; out.push(item); continue; }
        const row = await env.DB.prepare('SELECT ' + ref.field + ', updated_at FROM directory WHERE key = ?').bind(ref.key).first();
        if (!row) { item.error = 'no directory row ' + ref.key; out.push(item); continue; }
        item.value = row[ref.field] == null ? '' : String(row[ref.field]);
        item.updated_at = row.updated_at || '';
        item.href = '/admin/directory/' + encodeURIComponent(ref.key);
        item.editable = DIR_PIN_FIELDS.has(ref.field);
      } else if (ref.kind === 'sheet') {
        const sheet = await getSheet(env, ref.sheet_id);
        if (!sheet) { item.error = 'no sheet ' + ref.sheet_id; out.push(item); continue; }
        const got = await getValues(env, sheet, ref.cell);
        item.value = got && got.values && got.values[0] ? String(got.values[0][0] == null ? '' : got.values[0][0]) : '';
        item.href = '/admin/sheets?tab=' + encodeURIComponent(ref.sheet_id) + '&cell=' + ref.cell;
        item.editable = true;
        item.sheet_title = sheet.title;
      } else if (ref.kind === 'settings') {
        const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(ref.key).first();
        item.value = row && row.value != null ? String(row.value) : '';
        item.editable = true;
        item.href = '/admin/vault';
      }
    } catch (e) { item.error = String(e && e.message || e); }
    out.push(item);
  }
  return out;
}

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Write through to the object a pin points at. Directory writes version the content the same
// way /api/directory does, and every write is a ledger row.
export async function writePin(env, refStr, value, actor) {
  const ref = parseRef(refStr);
  if (!ref) return { error: 'bad_ref' };
  const val = value == null ? '' : String(value);
  const ts = buildNowIso();
  if (ref.kind === 'directory') {
    if (!DIR_PIN_FIELDS.has(ref.field)) return { error: 'field_not_writable', field: ref.field };
    const cur = await env.DB.prepare('SELECT key FROM directory WHERE key = ?').bind(ref.key).first();
    if (!cur) return { error: 'no_such_row', key: ref.key };
    await env.DB.prepare('UPDATE directory SET ' + ref.field + ' = ?, updated_at = ? WHERE key = ?').bind(val, ts, ref.key).run();
    if (ref.field === 'content') {
      try {
        const hash = await sha256Hex(val);
        const last = await env.DB.prepare('SELECT version, content_hash FROM directory_versions WHERE key=? ORDER BY version DESC LIMIT 1').bind(ref.key).first();
        if (!last || String(last.content_hash) !== hash) {
          await env.DB.prepare('INSERT INTO directory_versions (key,version,content,content_hash,actor,ts) VALUES (?,?,?,?,?,?)')
            .bind(ref.key, Number(last?.version || 0) + 1, val, hash, actor || 'sheet-pin', ts).run();
        }
      } catch {}
    }
    if (env.KV) { try { await env.KV.delete('directory:snapshot'); } catch {} }
    await logEvent(env, { source: 'directory', key: 'DIR_PATCH', route: '/api/sheets/pins', actor: actor || 'sheet-pin', action: 'PATCH', direction: 'in', status: 200,
      request: { key: ref.key, field: ref.field, chars: val.length, via: 'sheet pin' }, response: { ok: true, updated_at: ts } });
    return { ok: true, ref: refStr, updated_at: ts };
  }
  if (ref.kind === 'sheet') {
    const sheet = await getSheet(env, ref.sheet_id);
    if (!sheet) return { error: 'no_such_sheet' };
    const out = await setValues(env, sheet, ref.cell, [[val]], actor || 'sheet-pin');
    return out && out.error ? out : { ok: true, ref: refStr, updated_at: ts };
  }
  if (ref.kind === 'settings') {
    await env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(ref.key, val).run();
    if (env.KV) { try { await env.KV.put(ref.key, val); } catch {} }
    await logEvent(env, { source: 'settings', key: 'SET_PUT', route: '/api/sheets/pins', actor: actor || 'sheet-pin', action: 'PUT', direction: 'in', status: 200,
      request: { key: ref.key, chars: val.length, via: 'sheet pin' }, response: { ok: true } });
    return { ok: true, ref: refStr, updated_at: ts };
  }
  return { error: 'bad_ref' };
}

// What a person can pick from when adding a column or a filter: the source's own columns, and
// for the ledger the JSON paths that actually occur in the rows on screen are discovered by
// the grid — the server only has to say which columns hold JSON.
export function describeSources() {
  const out = {};
  for (const [name, s] of Object.entries(SOURCES)) out[name] = { table: s.table, order_by: s.ts, fields: s.fields, json_fields: s.json };
  return { sources: out, formats: FORMATS, templates: TEMPLATES.map((t) => ({ id: t.id, title: t.title, what: t.what, param: t.param || null })),
    virtual_filter_fields: { any: 'every text column of the row, payloads included', any_key: 'key, source, action, route' },
    filter_ops: ['=', '!=', 'contains', 'starts', 'in', 'not-in', '>', '<', '>=', '<=', 'empty', 'not_empty'],
    path_syntax: 'column, or column.json.path — request_json.body.messages[0].content' };
}

// Fill a template's {{param}} with what the person typed.
export function instantiateTemplate(id, paramValue) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return null;
  const str = JSON.stringify(t.view);
  const val = paramValue == null ? '' : String(paramValue);
  const filled = t.param ? str.replace(new RegExp('\\{\\{' + t.param.name + '\\}\\}', 'g'), () => JSON.stringify(val).slice(1, -1)) : str;
  return { title: t.title + (t.param && val ? ' · ' + val : ''), view: normalizeView(JSON.parse(filled)) };
}

export { colToLetter, parseCellRef };
