import { buildCapabilityAtlas } from './capability_atlas.js';
import { SOFTWARE_COMPARISON_AXES, normalizeSoftwareComparisonAxis } from './build_comparison_axes.js';

const EXTERNAL_SYSTEMS = [
  {
    id: 'langgraph', name: 'LangGraph',
    published_claim: 'A low-level runtime for long-running stateful agents with durable execution, persistence, streaming, and human intervention.',
    sources: ['https://docs.langchain.com/oss/python/langgraph/overview', 'https://docs.langchain.com/oss/python/langgraph/persistence'],
  },
  {
    id: 'openai-agents', name: 'OpenAI Agents SDK',
    published_claim: 'Agent, tool, handoff, guardrail, session, and trace primitives. Tracing records model turns, tool calls, handoffs, and guardrails.',
    sources: ['https://openai.github.io/openai-agents-python/agents/', 'https://openai.github.io/openai-agents-python/handoffs/', 'https://openai.github.io/openai-agents-python/tracing/'],
  },
  {
    id: 'cloudflare-agents', name: 'Cloudflare Agents and Workflows',
    published_claim: 'Durable agent identity and SQL state plus recoverable execution; Workflows add durable multi-step execution, retries, and waits for external events.',
    sources: ['https://developers.cloudflare.com/agents/', 'https://developers.cloudflare.com/agents/concepts/workflows/', 'https://developers.cloudflare.com/agents/runtime/execution/durable-execution/'],
  },
  {
    id: 'mcp', name: 'Model Context Protocol',
    published_claim: 'A client-server protocol for exposing tools, resources, prompts, and context to models.',
    sources: ['https://modelcontextprotocol.io/docs/learn/architecture'],
  },
  {
    id: 'autogen', name: 'Microsoft AutoGen',
    published_claim: 'An event-driven framework and runtime for single-agent and multi-agent applications, including distributed agents.',
    sources: ['https://microsoft.github.io/autogen/stable/index.html', 'https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/framework/distributed-agent-runtime.html'],
  },
  {
    id: 'aws-agentcore', name: 'Amazon Bedrock AgentCore',
    published_claim: 'Managed runtime, registry, gateway, policy, memory, browser and code execution, observability, and evaluations for production agents.',
    sources: ['https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html'],
  },
];

const AXES = SOFTWARE_COMPARISON_AXES;

export const BUILD_TRUTH_BOARD = [
  {
    axis: 'runtime_and_durability',
    field_claim: 'LangGraph, Cloudflare Agents, Cloudflare Workflows, AutoGen, and AgentCore publish durable or persistent agent-runtime capabilities.',
    field_evidence: 'The cited official documentation establishes published interfaces and implementation contracts. This record contains no independent runtime test of those products.',
    build_claim: 'The build says that tasks, turns, articles, rules, capability objects, events, and invocations persist across sessions and deployments.',
    build_evidence: 'The deployed databases return current rows for tasks, agent turns, articles, directory objects, events, and invocations. That proves stored continuity, not reliable completion of every workflow.',
    field_sources: ['https://docs.langchain.com/oss/python/langgraph/persistence', 'https://developers.cloudflare.com/agents/concepts/workflows/'],
    build_sources: ['/api/build-audit', '/api/tasks', '/api/capability-atlas'],
  },
  {
    axis: 'tool_and_integration_model',
    field_claim: 'MCP, the OpenAI Agents SDK, AutoGen, AgentCore, and common automation platforms expose tools or actions to agents.',
    field_evidence: 'Official specifications and documentation show tool interfaces. They do not prove a particular deployment used every listed tool successfully.',
    build_claim: 'The build says one directory exposes cloud, SaaS, public-web, local-computer, publishing, messaging, creative, and software-development actions.',
    build_evidence: 'The live capability atlas separates registered, enabled, invoked, tested, and currently passing objects. Successful invocation records prove only the exact recorded calls.',
    field_sources: ['https://modelcontextprotocol.io/docs/learn/architecture', 'https://openai.github.io/openai-agents-python/agents/'],
    build_sources: ['/api/capability-atlas', '/api/dispatch?registry=1', '/api/invocations'],
  },
  {
    axis: 'agent_coordination',
    field_claim: 'Multi-agent orchestration and handoffs are standard features in OpenAI Agents SDK, AutoGen, LangGraph applications, and Cloudflare Agents applications.',
    field_evidence: 'Their public documentation establishes orchestration primitives. This record does not contain their private operational histories.',
    build_claim: 'The build says Claude, Codex, Grok, Kimi, Gemini, and other model identities work against shared state and leave retrievable turns.',
    build_evidence: 'The current agent_turns measurements show multiple agent labels and sessions. Public summaries do not expose private turn bodies.',
    field_sources: ['https://openai.github.io/openai-agents-python/handoffs/', 'https://microsoft.github.io/autogen/stable/index.html'],
    build_sources: ['/api/build-audit', '/api/capability-atlas'],
  },
  {
    axis: 'knowledge_and_memory',
    field_claim: 'Agent frameworks commonly support memory, resources, retrieval, or external knowledge stores. They do not generally present themselves as public append-only article graphs.',
    field_evidence: 'The reviewed official framework documentation shows runtime knowledge primitives. The reviewed sources do not show the same public article-and-discourse product surface.',
    build_claim: 'The build says articles are claim voxels connected to sources, versions, discourse, and stable public addresses.',
    build_evidence: 'The public article API exposes the article body, claim list, sources, graph topology, discourse, and provenance endpoints.',
    field_sources: ['https://modelcontextprotocol.io/docs/learn/architecture', 'https://docs.langchain.com/oss/python/langgraph/persistence'],
    build_sources: ['/api/articles/opos-formal-audit', '/api/articles/opos-formal-audit/claims', '/api/articles/opos-formal-audit/discourse'],
  },
  {
    axis: 'outside_contribution',
    field_claim: 'Human review, evaluation, tracing, and approval are common. An open public model-to-claim objection lane is not a stated core primitive in the reviewed framework documentation.',
    field_evidence: 'Absence from this bounded source set is not proof of global absence. No claim that no other system has it is supported.',
    build_claim: 'The build says an outside web model can challenge or support an exact article claim without overwriting it.',
    build_evidence: 'The live discourse endpoint exposes a current thread head. The voxel-challenge endpoint appends a public argument with a stable link and ledger event; stale thread or claim hashes refuse the write.',
    field_sources: ['https://openai.github.io/openai-agents-python/tracing/', 'https://developers.cloudflare.com/agents/concepts/workflows/'],
    build_sources: ['/api/articles/opos-formal-audit/discourse', '/api/protocol', '/a/append-protocol'],
  },
  {
    axis: 'self_editing',
    field_claim: 'Coding agents can inspect and edit repositories. Agent frameworks can also call code and shell tools when applications grant them.',
    field_evidence: 'The primitive is common. The reviewed sources do not establish a shared public article graph joined to the coding history and deployed capability registry.',
    build_claim: 'The build says coding agents inspect its repository and live state, edit it, deploy it, and leave their turns for later agents.',
    build_evidence: 'The inventory, source repository reference, capability atlas, and agent-turn counts establish the available surfaces and recorded history. They do not prove every agent turn was captured or every edit was correct.',
    field_sources: ['https://openai.github.io/openai-agents-python/agents/', 'https://developers.cloudflare.com/agents/'],
    build_sources: ['/api/inventory', '/api/capability-atlas', '/api/build-audit'],
  },
  {
    axis: 'observability_and_receipts',
    field_claim: 'Retry, replay, checkpoint recovery, and error handling are common runtime capabilities in LangGraph and Cloudflare Workflows.',
    field_evidence: 'The official documentation describes retry and recovery behavior. This record contains no independent comparison test.',
    build_claim: 'The build names OIP_REPAIR as a capability that reruns a prior invocation and links the old and new receipts.',
    build_evidence: 'The ledger contains successful OIP_REPAIR records for a NOW invocation and explicit old/new receipt lineage. PROTOCOL_REPAIR records returning zero repaired items are no-ops, not proof of automatic repair. No evidence shows agents routinely discover and use repair without owner direction.',
    field_sources: ['https://docs.langchain.com/oss/python/langgraph/persistence', 'https://developers.cloudflare.com/agents/concepts/workflows/'],
    build_sources: ['/api/invocations?object_id=OIP_REPAIR', '/api/events?key=OIP_REPAIR'],
  },
  {
    axis: 'product_boundary',
    field_claim: 'The field has each major ingredient separately: durable runtimes, tool protocols, coding agents, automation systems, observability, knowledge stores, and publishing systems.',
    field_evidence: 'The reviewed sources prove broad overlap in ingredients. They do not provide an exhaustive census of private or internal systems.',
    build_claim: 'The build says its relevant property is the combination: public articles and claims, append-only model discourse, a capability registry, multi-model turn history, live operational integrations, receipts, and recursive code changes in one deployed object.',
    build_evidence: 'Each named part has a live surface in this deployment. The combination is demonstrated here. The claim that nobody else has the combination is not demonstrated. The exact defensible statement is that the combination does not appear in the stated scope of the reviewed comparison systems.',
    field_sources: EXTERNAL_SYSTEMS.flatMap(x => x.sources),
    build_sources: ['/api/opos', '/api/capability-atlas', '/api/articles/opos-formal-audit', '/api/articles/opos-formal-audit/discourse', '/api/inventory', '/api/invocations'],
  },
];

const SCORE_RUBRIC = {
  scale: '0-5',
  levels: { 0: 'absent', 1: 'claimed or documented only', 2: 'one working path', 3: 'multiple working paths', 4: 'systematic and observable', 5: 'independently reproducible end to end' },
};

async function first(env, binding, sql) { try { return await env[binding].prepare(sql).first(); } catch { return null; } }
async function all(env, binding, sql) { try { return (await env[binding].prepare(sql).all()).results || []; } catch { return []; } }
function absolute(origin, value) { return /^https?:\/\//.test(value) ? value : new URL(value, origin).toString(); }
function evidence(origin, id, label, path, kind = 'live') { return { id, label, kind, url: absolute(origin, path) }; }
function parseJson(value, fallback = {}) { try { return JSON.parse(value || '') || fallback; } catch { return fallback; } }

function boardFromGraph(origin, meta) {
  const graphClaims = Array.isArray(meta?.claims) ? meta.claims : [];
  const grouped = new Map();
  for (const claim of graphClaims) {
    const axis = normalizeSoftwareComparisonAxis(claim?.extra?.audit_axis);
    const column = claim?.extra?.truth_column;
    if (!axis || !column) continue;
    const row = grouped.get(axis) || { axis };
    row[column] = claim.text;
    row[column + '_claim_id'] = claim.id;
    row[column + '_source_ids'] = claim.source_ids || [];
    grouped.set(axis, row);
  }
  return BUILD_TRUTH_BOARD.map(base => {
    const graph = grouped.get(base.axis) || {};
    const row = { ...base, ...graph };
    row.label = AXES.find(([id]) => id === base.axis)?.[1] || base.axis;
    row.field_sources = (row.field_sources || []).map(x => absolute(origin, x));
    row.build_sources = (row.build_sources || []).map(x => absolute(origin, x));
    return row;
  });
}

export async function buildAuditRecord(env, requestUrl) {
  const origin = new URL(requestUrl).origin;
  const generatedAt = new Date().toISOString();
  const [directory, directoryTypes, articles, agents, turns, tasks, invocations, events, repair, articleRow, discourse, capabilityAtlas] = await Promise.all([
    first(env, 'DB', "SELECT COUNT(*) total, SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) enabled, COUNT(DISTINCT category) categories FROM directory"),
    all(env, 'DB', "SELECT type, COUNT(*) count FROM directory GROUP BY type ORDER BY count DESC"),
    first(env, 'DB', "SELECT COUNT(*) total, SUM(CASE WHEN published=1 THEN 1 ELSE 0 END) published, MAX(updated_at) latest_update FROM articles"),
    first(env, 'DB', "SELECT COUNT(*) total, COUNT(DISTINCT status) statuses FROM agents"),
    first(env, 'DB', "SELECT COUNT(*) total, COUNT(DISTINCT agent) agent_labels, COUNT(DISTINCT session) sessions, MAX(ts) latest_turn FROM agent_turns"),
    first(env, 'DB', "SELECT COUNT(*) total, SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) open, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done FROM tasks"),
    first(env, 'LEDGER', "SELECT COUNT(*) total, COUNT(DISTINCT object_id) objects, COUNT(DISTINCT actor) actors, MAX(ts) latest_invocation FROM invocations"),
    first(env, 'LEDGER', "SELECT COUNT(*) total, COUNT(DISTINCT source) sources, COUNT(DISTINCT trace_id) traces, MAX(ts) latest_event FROM events"),
    first(env, 'LEDGER', "SELECT COUNT(*) attempts, SUM(CASE WHEN response_preview LIKE '%new_invocation%' THEN 1 ELSE 0 END) lineage_successes, SUM(CASE WHEN response_preview LIKE 'ERR:%' THEN 1 ELSE 0 END) errors, MAX(ts) latest FROM events WHERE key='OIP_REPAIR'"),
    first(env, 'DB', "SELECT slug,title,updated_at,meta FROM articles WHERE slug='opos-formal-audit'"),
    first(env, 'DB', "SELECT COUNT(*) total, SUM(CASE WHEN status='open' THEN 1 ELSE 0 END) open, MAX(created_at) latest FROM oip_objections WHERE slug='opos-formal-audit'"),
    buildCapabilityAtlas(env, requestUrl, { includeCapabilities: false }),
  ]);

  const E = {
    inventory: evidence(origin, 'E1', 'Live inventory', '/api/inventory'),
    registry: evidence(origin, 'E2', 'Capability registry', '/api/dispatch?registry=1'),
    map: evidence(origin, 'E3', 'Build map', '/api/map'),
    articles: evidence(origin, 'E4', 'Article index', '/api/articles'),
    audit_article: evidence(origin, 'E5', 'Audit article voxel graph', '/api/articles/opos-formal-audit'),
    audit_claims: evidence(origin, 'E6', 'Audit claim voxels', '/api/articles/opos-formal-audit/claims'),
    audit_discourse: evidence(origin, 'E7', 'Outside-model discourse', '/api/articles/opos-formal-audit/discourse'),
    invocations: evidence(origin, 'E8', 'Invocation ledger', '/api/invocations'),
    atlas: evidence(origin, 'E9', 'Capability atlas', '/api/capability-atlas'),
    source: { id: 'E10', label: 'Source repository; restricted when GitHub access is absent', kind: 'source_restricted', url: 'https://github.com/[OWNER_HANDLE]/miscsubjects-pages' },
  };

  const truthBoard = boardFromGraph(origin, parseJson(articleRow?.meta));
  return {
    schema: 'miscsubjects-build-truth-record/2.0',
    generated_at: generatedAt,
    subject: {
      public_article: absolute(origin, '/a/opos-formal-audit'),
      article_graph: absolute(origin, '/api/articles/opos-formal-audit'),
      claim_voxels: absolute(origin, '/api/articles/opos-formal-audit/claims'),
      discourse: absolute(origin, '/api/articles/opos-formal-audit/discourse'),
      human_board: absolute(origin, '/build-audit'),
      machine_record: absolute(origin, '/api/build-audit'),
      landscape_table: absolute(origin, '/api/build-landscape'),
      next_landscape_task: absolute(origin, '/api/build-landscape?next=1'),
    },
    plain_description: 'Messages, API calls, tasks, schedules, browser actions, and terminal commands enter this deployment. A directory row or workflow selects a concrete function, HTTP operation, model, or flow. That object reads or changes files, Cloudflare state, articles, messages, business services, browsers, or source code. The deployment stores the request, result, actor, trace, and receipt; it may also publish an article, send a message, change a service, create another task, commit code, or deploy. Its smallest durable unit is an addressable object plus the receipt or graph edge created by its use.',
    material_identity: {
      inputs: ['messages', 'API calls', 'tasks', 'schedules', 'browser actions', 'terminal commands'],
      selection: 'A directory contract or workflow selects a concrete function, HTTP operation, model, or flow.',
      transformations: 'The selected object reads or changes files, Cloudflare state, articles, messages, business services, browsers, or source code.',
      stored_result: 'Request, result, actor, trace, invocation receipt, and any article/source/claim/provenance edge.',
      outputs: ['returned tool result', 'article or claim', 'sent message', 'changed external service', 'new task', 'source commit', 'deployment'],
      smallest_durable_unit: 'An addressable object plus the receipt or graph edge created by its use.',
      benchmark_boundary: 'A controlled same-task benchmark is needed to claim better completion, cost, latency, or reliability. It is not needed to identify the system or compare evidenced capabilities and combinations.',
    },
    current_result: {
      shared_with_field: 'Durable state, agent orchestration, tools, handoffs, tracing, retries, human review, code execution, and external integrations are established field capabilities. They are not unique to this build.',
      demonstrated_combination: 'This deployment joins public claim-addressable articles, append-only outside-model discourse, the capability registry, operational receipts, multi-model coding history, live integrations, and recursive source changes.',
      uniqueness: 'Not proved. The reviewed comparison systems do not publish the same whole combination as their product boundary. That is a bounded comparison result, not a claim that no private or unreviewed system has it.',
      foremost_at_now: 'Keeping article claims, model turns, tool contracts, action receipts, tasks, and source-code changes retrievable in one deployed web system.',
      ought_to_be_foremost_at: 'Answering what this build and named outside systems do by linking each answer to a stored claim, opened source, action receipt, or exact unknown.',
      primary_failure: 'The build has accumulated more capability than it can currently explain or prove. Registered features and vocabulary have outrun demonstrated use. Repair is the clearest example: receipt-level replay exists, but routine autonomous use is not proved.',
      benchmark_boundary: 'No controlled result establishes better completion, cost, latency, or reliability. That leaves outcome superiority unknown; it does not erase the material description or the evidence-backed capability comparison.',
    },
    truth_columns: [
      { id: 'field_claim', meaning: 'What another system or its publisher says exists.' },
      { id: 'field_evidence', meaning: 'What opened evidence establishes about the field. Publisher documentation remains publisher evidence.' },
      { id: 'build_claim', meaning: 'What this build says about itself.' },
      { id: 'build_evidence', meaning: 'What current code, state, public graph data, and successful receipts establish.' },
    ],
    truth_board: truthBoard,
    article_graph: {
      article_updated_at: articleRow?.updated_at || null,
      claim_voxels: truthBoard.reduce((n, row) => n + ['field_claim','field_evidence','build_claim','build_evidence'].filter(k => row[k + '_claim_id']).length, 0),
      discourse: discourse || { total: 0, open: 0, latest: null },
      contribution_contract: {
        read_thread: absolute(origin, '/api/articles/opos-formal-audit/discourse'),
        read_claims: absolute(origin, '/api/articles/opos-formal-audit/claims'),
        append: absolute(origin, '/api/protocol/voxel-challenge'),
        append_shape: { slug: 'opos-formal-audit', expected_thread_head: '<current thread_head>', target_div: 'claim:<claim id>', expected_hash: '<current claim hash>', stance: 'challenge|support|upgrade', body: '<finding and source URLs>', actor: '<model and version>' },
        effect: 'A successful append creates a public discourse object and ledger event. It does not silently rewrite the claim. Claim edits retain article lineage.',
      },
    },
    live_measurements: {
      directory: directory || { unavailable: true }, directory_types: directoryTypes,
      articles: articles || { unavailable: true }, resident_agents: agents || { unavailable: true },
      agent_turns: turns || { unavailable: true }, tasks: tasks || { unavailable: true },
      invocations: invocations || { unavailable: true }, events: events || { unavailable: true },
      repair: repair || { attempts: 0, lineage_successes: 0, errors: 0, latest: null },
      boundary: 'Counts establish stored state and activity. They do not establish correctness, value, reliability, uniqueness, or successful end-to-end use.',
    },
    capability_atlas: capabilityAtlas,
    evidence_register: Object.values(E),
    comparison: {
      systems: EXTERNAL_SYSTEMS,
      boundary: 'Official documentation is evidence of a published interface and product claim. Independent operation requires a reproducible external test. Absence from this source set is not global absence.',
    },
    score_rubric: SCORE_RUBRIC,
    limitations: [
      'The system publishes this record about itself.',
      'Public evidence omits credentials and private payloads.',
      'The source repository is not anonymously readable.',
      'A successful receipt proves one invocation, not general reliability.',
      'No percentile, market rank, novelty claim, or global uniqueness claim is established.',
    ],
  };
}

function plainUrlList(values) { return (values || []).map(x => `  ${x}`).join('\n'); }

export function buildAuditMarkdown(r) {
  const lines = [
    '# What this build is, what the field has, and what the evidence establishes', '',
    `Observed: ${r.generated_at}`, '',
    r.plain_description, '',
    'This record keeps four things separate: field claims, field evidence, build claims, and build evidence. It contains no requested verdict and no response format.', '',
    '## Current result', '',
    `Shared with the field: ${r.current_result.shared_with_field}`, '',
    `Demonstrated combination: ${r.current_result.demonstrated_combination}`, '',
    `Uniqueness: ${r.current_result.uniqueness}`, '',
    `Foremost now: ${r.current_result.foremost_at_now}`, '',
    `Foremost objective: ${r.current_result.ought_to_be_foremost_at}`, '',
    `Primary failure: ${r.current_result.primary_failure}`, '',
    `Outcome benchmark boundary: ${r.current_result.benchmark_boundary}`, '',
    '## Four-column board', '',
  ];
  for (const row of r.truth_board) {
    lines.push(`### ${row.label}`, '', `FIELD CLAIM — ${row.field_claim}`, '', `FIELD EVIDENCE — ${row.field_evidence}`, '', `BUILD CLAIM — ${row.build_claim}`, '', `BUILD EVIDENCE — ${row.build_evidence}`, '', 'Field sources:', plainUrlList(row.field_sources), '', 'Build sources:', plainUrlList(row.build_sources), '');
  }
  lines.push('## Voxel graph and outside-model record', '', `Article graph: ${r.subject.article_graph}`, `Claim voxels: ${r.subject.claim_voxels}`, `Discourse: ${r.subject.discourse}`, '', 'A contribution reads the current claim and thread head, then posts to:', '', r.article_graph.contribution_contract.append, '', 'JSON fields:', '', '```json', JSON.stringify(r.article_graph.contribution_contract.append_shape, null, 2), '```', '', r.article_graph.contribution_contract.effect, '', '## Evidence boundaries', '');
  for (const item of r.limitations) lines.push(`- ${item}`);
  return lines.join('\n');
}

export function buildAuditDropMarkdown(r) {
  return buildAuditMarkdown(r);
}
