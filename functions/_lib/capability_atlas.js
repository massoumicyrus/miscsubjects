const DOMAINS = [
  ['agents-models', 'Agents and model runtimes', /(^|[-_])(agent|agents|llm|ai|grok|openai|model|mcp)([-_]|$)/i],
  ['communications', 'Messaging, email, phone, and voice', /blooio|message|email|phone|voice|channel|sms|whatsapp|imessage/i],
  ['commerce', 'Commerce, payments, and customers', /stripe|payment|commerce|customer|invoice|refund|subscription/i],
  ['growth', 'Marketing, leads, sales, and distribution', /marketing|lead|biz[-_]?dev|klaviyo|campaign|ads|social|x_post|relay/i],
  ['creative-media', 'Creative, images, video, and media', /creative|arcads|image|video|audio|asset|render/i],
  ['knowledge-content', 'Knowledge, articles, graph, and protocol', /content|article|oip|protocol|graph|docs|claim|source|voxel|book/i],
  ['cloud-data', 'Cloud, data, storage, and deployment', /cloudflare|(^|_)cf([_-]|$)|pages|d1|kv|r2|storage|database|deploy|worker|durable/i],
  ['computer-code', 'Computer, code, files, browser, and GitHub', /local|computer|browser|desktop|device|file|github|cli|code|repo|shell|terminal/i],
  ['automation-work', 'Automation, flows, tasks, and durable work', /automation|automate|flow|pipeline|task|todo|cron|work|session|queue|schedule/i],
  ['governance-proof', 'Governance, security, evidence, and audit', /governance|audit|security|law|limit|proof|ledger|receipt|rule|approval|token|capability/i],
  ['system-meta', 'System, directory, settings, and self-modification', /directory|settings|meta|tools|util|build|self[-_]?mod|log|router|world[-_]?map/i],
];

function n(value) { return Number(value || 0); }

async function all(binding, sql) {
  try { return (await binding.prepare(sql).all()).results || []; } catch { return []; }
}

async function first(binding, sql) {
  try { return await binding.prepare(sql).first(); } catch { return null; }
}

function docSection(content, name) {
  const text = String(content || '').replace(/\\n/g, '\n').replace(/\r/g, '');
  const re = new RegExp('^#\\s*' + name + ':?\\s*([\\s\\S]*?)(?=^#\\s*[A-Z][A-Z0-9_ /-]*:?|(?![\\s\\S]))', 'mi');
  const match = text.match(re);
  return match ? match[1].trim() : '';
}

function cleanDescription(value) {
  return String(value || '')
    .replace(/\[[A-Z0-9_]+\][\s\S]*?\[\/[A-Z0-9_]+\]/g, '[invocation omitted]')
    .replace(/(?:bearer|token|secret|password|api[_ -]?key)\s*[:=]\s*\S+/gi, '[credential redacted]')
    // Agent-row content stores composition placeholders ({{SHARED}} etc.) substituted only
    // at actual agent invocation, never at read time. A public summary must never leak them.
    .replace(/\{\{[A-Z0-9_]+\}\}/g, '')
    .replace(/\[object Object\]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 700)
    .trim();
}

function describeRow(row) {
  const what = cleanDescription(docSection(row.content, 'WHAT'));
  if (what) return what;
  const firstLine = String(row.content || '').split('\n').map(x => x.trim()).find(Boolean) || '';
  return cleanDescription(firstLine.replace(/^#+\s*/, '')) || 'Registered capability object without a public WHAT description.';
}

function domainFor(row) {
  const haystack = [row.key, row.category, row.allowed_categories, row.runner, row.type].filter(Boolean).join(' ');
  const found = DOMAINS.find(([, , re]) => re.test(haystack));
  return found ? found[0] : 'other';
}

function targetKind(row, origin) {
  const target = String(row.target || '');
  if (!target) return row.type === 'agent' ? 'model_or_agent' : row.type === 'flow' ? 'composed_flow' : 'internal_function';
  if (/localhost|127\.0\.0\.1|192\.168\.|10\.0\./i.test(target)) return 'local_computer_or_bridge';
  if (/^https?:\/\//i.test(target)) {
    try { return new URL(target).origin === origin ? 'same_build_http' : 'external_http'; } catch { return 'http'; }
  }
  return row.type === 'flow' ? 'composed_flow' : 'internal_function';
}

function verificationFor(row, invocation, test) {
  if (!n(row.enabled)) return 'disabled';
  if (n(test?.passed_tests) > 0 && n(invocation?.uses) > 0) return 'tested_and_invoked';
  if (n(test?.passed_tests) > 0) return 'tested';
  if (n(invocation?.uses) > 0) return 'invoked_not_test_proven';
  if (n(test?.tests) > 0) return 'test_exists_not_currently_passed';
  return 'registered_only';
}

function relativeFile(file) {
  const value = String(file || '');
  const marker = '/miscsubjects-pages/';
  const at = value.indexOf(marker);
  if (at >= 0) return value.slice(at + marker.length);
  const parts = value.split('/').filter(Boolean);
  return parts.length ? '[external]/' + parts.slice(-2).join('/') : '[unknown]';
}

export async function buildCapabilityAtlas(env, requestUrl, { includeCapabilities = true } = {}) {
  const origin = new URL(requestUrl).origin;
  const [rows, tests, turnSummary, agentActivity, turnTimeline, changedFiles, invocations] = await Promise.all([
    all(env.DB, "SELECT key,type,target,category,allowed_categories,updated_at,enabled,planner_visible,planner_rank,sensitive,runner,substr(content,1,5000) content FROM directory ORDER BY key"),
    all(env.DB, "SELECT key,COUNT(*) tests,SUM(CASE WHEN last_passed=1 THEN 1 ELSE 0 END) passed_tests,MAX(last_run_id) last_run_id FROM directory_tests GROUP BY key"),
    first(env.DB, "SELECT COUNT(*) total,COUNT(DISTINCT agent) agents,COUNT(DISTINCT session) sessions,SUM(CASE WHEN files_json IS NOT NULL AND files_json<>'[]' THEN 1 ELSE 0 END) file_changing_turns,SUM(CASE WHEN n_tools>0 THEN 1 ELSE 0 END) tool_using_turns,MIN(ts) first_turn,MAX(ts) latest_turn FROM agent_turns"),
    all(env.DB, "SELECT agent,COUNT(*) turns,COUNT(DISTINCT session) sessions,SUM(CASE WHEN files_json IS NOT NULL AND files_json<>'[]' THEN 1 ELSE 0 END) file_changing_turns,MAX(ts) latest_turn FROM agent_turns GROUP BY agent ORDER BY turns DESC"),
    all(env.DB, "SELECT substr(ts,1,10) day,COUNT(*) turns,SUM(CASE WHEN files_json IS NOT NULL AND files_json<>'[]' THEN 1 ELSE 0 END) file_changing_turns FROM agent_turns GROUP BY substr(ts,1,10) ORDER BY day"),
    all(env.DB, "SELECT j.value file,COUNT(*) turns,MAX(a.ts) last_changed FROM agent_turns a,json_each(a.files_json) j WHERE json_valid(a.files_json) AND j.type='text' GROUP BY j.value ORDER BY turns DESC LIMIT 100"),
    all(env.LEDGER, "SELECT object_id,COUNT(*) uses,MAX(ts) last_used,SUM(CASE WHEN material=1 THEN 1 ELSE 0 END) material_uses,COUNT(DISTINCT actor) actors FROM invocations GROUP BY object_id"),
  ]);

  const testsByKey = new Map(tests.map(x => [String(x.key).toUpperCase(), x]));
  const invocationsByKey = new Map(invocations.map(x => [String(x.object_id).toUpperCase(), x]));
  const capabilities = rows.map(row => {
    const key = String(row.key || '');
    const invocation = invocationsByKey.get(key.toUpperCase()) || null;
    const test = testsByKey.get(key.toUpperCase()) || null;
    const description = describeRow(row);
    const domain = domainFor(row);
    return {
      key,
      type: row.type || 'unknown',
      domain,
      category: row.category || 'uncategorized',
      description,
      enabled: !!n(row.enabled),
      planner_visible: !!n(row.planner_visible),
      sensitive: !!n(row.sensitive),
      runner: row.runner || null,
      target_kind: targetKind(row, origin),
      updated_at: row.updated_at || null,
      contract: {
        has_what: !!docSection(row.content, 'WHAT'),
        has_args: !!docSection(row.content, 'ARGS'),
        has_tests_section: !!docSection(row.content, 'TESTS'),
        has_examples: !!String(row.content || '').match(/#\s*(EX|EXAMPLE|EXAMPLES):/i),
      },
      evidence: {
        verification: verificationFor(row, invocation, test),
        recorded_invocations: n(invocation?.uses),
        material_invocations: n(invocation?.material_uses),
        invoking_actors: n(invocation?.actors),
        last_invoked: invocation?.last_used || null,
        registered_tests: n(test?.tests),
        currently_passed_tests: n(test?.passed_tests),
        last_test_run: test?.last_run_id || null,
        warning: n(invocation?.uses) > 0 ? 'A recorded invocation proves use, not successful real-world effect.' : 'No invocation record was found; registration is not proof that this capability works.',
      },
      urls: {
        human: origin + '/a/directory/' + encodeURIComponent(key),
        contract: origin + '/api/directory/' + encodeURIComponent(key),
        invocation_history: origin + '/api/invocations?object_id=' + encodeURIComponent(key),
      },
      search_text: [key, row.type, domain, row.category, description].filter(Boolean).join(' ').toLowerCase(),
    };
  });

  const domainMap = new Map([...DOMAINS.map(([id, name]) => [id, { id, name, registered: 0, enabled: 0, invoked: 0, with_registered_tests: 0, with_current_test_pass: 0, recorded_invocations: 0, examples: [] }]), ['other', { id: 'other', name: 'Other and uncategorized', registered: 0, enabled: 0, invoked: 0, with_registered_tests: 0, with_current_test_pass: 0, recorded_invocations: 0, examples: [] }]]);
  for (const cap of capabilities) {
    const d = domainMap.get(cap.domain);
    d.registered++;
    if (cap.enabled) d.enabled++;
    if (cap.evidence.recorded_invocations > 0) d.invoked++;
    if (cap.evidence.registered_tests > 0) d.with_registered_tests++;
    if (cap.evidence.currently_passed_tests > 0) d.with_current_test_pass++;
    d.recorded_invocations += cap.evidence.recorded_invocations;
    if (d.examples.length < 12) d.examples.push({ key: cap.key, description: cap.description, verification: cap.evidence.verification });
  }

  const enabled = capabilities.filter(x => x.enabled);
  const invoked = enabled.filter(x => x.evidence.recorded_invocations > 0);
  const tested = enabled.filter(x => x.evidence.currently_passed_tests > 0);
  const documented = enabled.filter(x => x.contract.has_what);
  const topCapabilities = [...capabilities].sort((a, b) => b.evidence.recorded_invocations - a.evidence.recorded_invocations).slice(0, 50);
  const uniqueChangedFiles = new Set(changedFiles.map(x => relativeFile(x.file))).size;

  const atlas = {
    schema: 'miscsubjects-capability-atlas/1.0',
    generated_at: new Date().toISOString(),
    purpose: 'Make accumulated build ability legible by joining current capability contracts, recorded invocations, tests, and coding-agent turn sediment.',
    definitions: {
      registered_capability: 'One current directory object. It may be a primitive, integration, agent, or composed flow; it is not automatically a proven end-user feature.',
      recorded_invocation: 'A ledger invocation exists for the object. This proves use was attempted or recorded, not that the real-world result succeeded.',
      tested: 'At least one directory test currently records a pass. Test scope varies and is not equivalent to end-to-end production proof.',
      coding_turn_sediment: 'Durable coding-agent turns and changed-file records showing how implementation accumulated over time. Counts do not establish quality.',
    },
    summary: {
      registered_capabilities: capabilities.length,
      enabled_capabilities: enabled.length,
      described_capabilities: documented.length,
      capabilities_with_recorded_invocations: invoked.length,
      capabilities_with_registered_tests: enabled.filter(x => x.evidence.registered_tests > 0).length,
      capabilities_with_currently_passed_tests: tested.length,
      registered_only: enabled.filter(x => x.evidence.verification === 'registered_only').length,
      recorded_invocations_across_current_capabilities: capabilities.reduce((sum, x) => sum + x.evidence.recorded_invocations, 0),
      material_invocation_flags: capabilities.reduce((sum, x) => sum + x.evidence.material_invocations, 0),
      categories: new Set(capabilities.map(x => x.category)).size,
      domains: [...domainMap.values()].filter(x => x.registered > 0).length,
    },
    domains: [...domainMap.values()].filter(x => x.registered > 0).sort((a, b) => b.registered - a.registered),
    turn_archaeology: {
      summary: turnSummary || { unavailable: true },
      agent_activity: agentActivity,
      daily_activity: turnTimeline,
      changed_files: {
        unique_in_top_100: uniqueChangedFiles,
        top: changedFiles.map(x => ({ file: relativeFile(x.file), turns: n(x.turns), last_changed: x.last_changed || null })),
        privacy: 'Only aggregate counts and sanitized paths are public. Raw owner prompts and turn bodies are excluded from this atlas.',
      },
    },
    evidence_boundaries: [
      'Directory registration proves that a current contract exists, not that it works.',
      'Invocation history proves recorded use, not successful external consequence.',
      'A passed directory test proves only the behavior asserted by that test.',
      'Turn and file-change counts prove accumulated work history, not distinct feature count or quality.',
      'Raw private owner prompts, credentials, auth fields, and capability bodies are excluded.',
    ],
    top_capabilities_by_recorded_use: topCapabilities,
    urls: {
      human_atlas: origin + '/capability-atlas',
      full_json: origin + '/api/capability-atlas',
      summary_json: origin + '/api/capability-atlas?summary=1',
      formal_audit_drop: origin + '/api/opos?format=drop',
    },
  };
  if (includeCapabilities) atlas.capabilities = capabilities;
  return atlas;
}
