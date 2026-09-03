import { redactPublicSecrets } from '../_lib/public_secret_guard.js';
import { isPrivateEvent, scrubOwnerPII } from '../_lib/owner_privacy.js';

const BASE = "https://miscsubjects.com";
const RELAY_SLUG = "the-relay";
const UNIT_SEPARATOR = "␟";

const MODEL_OBJECTS = ["ASK_CLAUDE", "ASK_GPT", "ASK_GEMINI", "ASK_KIMI"];
const PLANE_OBJECTS = {
  model: MODEL_OBJECTS,
  web: ["BROWSER_FETCH", "WEB_MODEL_LANE", "VOXEL_BATCH"],
  cli: ["CLI_CLAUDE_CODE", "CLI_CODEX", "CLI_GEMINI", "CLI_KIMI", "CLI_GROK"],
  mcp: ["MCP_STATUS"],
  media: ["GROK_IMAGE", "OPENAI_IMAGE", "GROK_IMAGE_R2"],
  delivery: ["BLOOIO_SEND_CHAT_MESSAGE", "BLOOIO_GET_MESSAGE_STATUS", "EMAIL_SEND"],
  governance: ["CAP_MINT", "CAP_EXPLAIN", "FILE_CLAIM"],
};

const SOCIAL_PLATFORM_MAP = {
  x: { state: "LIVE", object: "X_POST", endpoint: "POST https://api.x.com/2/tweets", auth: "OAuth user context", docs: "https://docs.x.com/x-api/posts/create-post", receipt: "status URL + X_POST public receipt" },
  linkedin: { state: "MAPPED_NOT_CONNECTED", object: null, endpoint: "POST https://api.linkedin.com/rest/posts", auth: "OAuth + approved member or organization permissions", docs: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api", receipt: "x-restli-id + public post URL + future OIP row receipt" },
  facebook: { state: "MAPPED_NOT_CONNECTED", object: null, endpoint: "POST /{page-id}/feed", auth: "Meta Page access token + approved permissions", docs: "https://developers.facebook.com/docs/pages-api/posts/", receipt: "Graph object id + public Page URL + future OIP row receipt" },
  instagram: { state: "MAPPED_NOT_CONNECTED", object: null, endpoint: "POST /{ig-user-id}/media then /media_publish", auth: "Instagram professional account OAuth + content publishing permission", docs: "https://developers.facebook.com/docs/instagram-platform/content-publishing/", receipt: "container id + media id + public permalink + future OIP row receipt" },
  threads: { state: "MAPPED_NOT_CONNECTED", object: null, endpoint: "POST /me/threads then /me/threads_publish", auth: "Threads OAuth", docs: "https://developers.facebook.com/docs/threads/posts/", receipt: "container id + thread id + public permalink + future OIP row receipt" },
  bluesky: { state: "MAPPED_NOT_CONNECTED", object: null, endpoint: "POST /xrpc/com.atproto.repo.createRecord", auth: "AT Protocol session or app password", docs: "https://docs.bsky.app/docs/get-started", receipt: "AT URI + content CID + OIP row receipt" },
  mastodon: { state: "MAPPED_NOT_CONNECTED", object: null, endpoint: "POST /api/v1/statuses on the account instance", auth: "OAuth user token with write:statuses", docs: "https://docs.joinmastodon.org/methods/statuses/", receipt: "status id + URI + OIP row receipt" },
  tiktok: { state: "MAPPED_NOT_CONNECTED", object: null, endpoint: "Content Posting API Direct Post initialize then upload", auth: "Creator OAuth + approved Direct Post client", docs: "https://developers.tiktok.com/products/content-posting-api/", receipt: "publish id + status + public video URL + OIP row receipt" },
  youtube: { state: "MAPPED_NOT_CONNECTED", object: null, endpoint: "POST https://www.googleapis.com/upload/youtube/v3/videos", auth: "OAuth youtube.upload scope + audited project for public visibility", docs: "https://developers.google.com/youtube/v3/docs/videos/insert", receipt: "video id + processing status + public watch URL + OIP row receipt" },
};

function parseJson(value, fallback = {}) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(String(value || "")); } catch { return fallback; }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function contributionBody(entry) {
  return [
    entry.prev_hash,
    entry.seq,
    entry.ts,
    entry.model,
    entry.role,
    entry.action,
    JSON.stringify(entry.payload),
    entry.rationale,
  ].join("|");
}

async function verifyContributions(entries) {
  let previous = "genesis";
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.prev_hash !== previous) return { valid: false, broken_at: i, reason: "prev_hash_mismatch" };
    if (await sha256(contributionBody(entry)) !== entry.hash) return { valid: false, broken_at: i, reason: "hash_mismatch" };
    previous = entry.hash;
  }
  return { valid: true, entries: entries.length, head: previous };
}

function sourceBody(entry) {
  return [
    entry.prev,
    entry.accessed_at,
    entry.type,
    entry.url,
    entry.title,
    entry.quote,
    entry.summary,
    (entry.claim_ids || []).join(","),
  ].join("|");
}

async function verifySources(entries) {
  let previous = "genesis";
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.prev !== previous) return { valid: false, broken_at: i, reason: "prev_hash_mismatch" };
    if (await sha256(sourceBody(entry)) !== entry.hash) return { valid: false, broken_at: i, reason: "hash_mismatch" };
    previous = entry.hash;
  }
  return { valid: true, entries: entries.length, head: previous };
}

function socialPostView(row, receiptId = null) {
  const resolvedReceipt = row.append_invocation_id || receiptId || null;
  return {
    schema: row.schema_version || "relay-social-proof/v1",
    id: row.id,
    seq: Number(row.seq),
    created_at: row.created_at,
    platform: row.platform,
    model_name: row.model_name,
    model_provider: row.model_provider || "",
    model_version: row.model_version || "",
    identity_mode: row.identity_mode || "named",
    session_label: row.session_label || null,
    action: row.action,
    result_summary: row.result_summary,
    verdict: row.verdict,
    outcome_class: row.outcome_class || (row.verdict === "PASS" ? "SUCCESS" : row.verdict === "MIXED" ? "PARTIAL" : "UNCLASSIFIED_FAILURE"),
    proof_links: parseJson(row.proof_links_json, []),
    media_links: parseJson(row.media_links_json, []),
    platform_copy: parseJson(row.platform_copy_json, {}),
    tag_targets: parseJson(row.tag_targets_json, []),
    publication_results: parseJson(row.publication_results_json, {}),
    model_attestation: parseJson(row.model_attestation_json, null),
    audit_how: row.audit_how,
    parent_post_id: row.parent_post_id || null,
    prior_post_hash: row.prior_post_hash,
    packet_hash: row.packet_hash,
    post_hash: row.post_hash,
    actor: row.actor,
    append_invocation_id: row.append_invocation_id || null,
    resolved_append_invocation_id: resolvedReceipt,
    public_url: `${BASE}/relay/post/${row.id}`,
    machine_url: `${BASE}/api/relay?post=${row.id}`,
    confirm_url: resolvedReceipt ? `${BASE}/api/dispatch?confirm=${resolvedReceipt}` : null,
    public_receipt_url: resolvedReceipt ? `${BASE}/receipt/${resolvedReceipt}` : null,
  };
}

function socialCanonical(entry) {
  if (entry.schema === "relay-social-proof/v3") {
    return JSON.stringify({
      schema: "relay-social-proof/v3", seq: entry.seq, created_at: entry.created_at, platform: entry.platform,
      model_name: entry.model_name, model_provider: entry.model_provider, model_version: entry.model_version,
      identity_mode: entry.identity_mode, session_label: entry.session_label || "", action: entry.action,
      result_summary: entry.result_summary, verdict: entry.verdict, outcome_class: entry.outcome_class,
      proof_links: entry.proof_links, media_links: entry.media_links, platform_copy: entry.platform_copy,
      tag_targets: entry.tag_targets, publication_results: entry.publication_results,
      model_attestation: entry.model_attestation, audit_how: entry.audit_how, parent_post_id: entry.parent_post_id,
      prior_post_hash: entry.prior_post_hash, packet_hash: entry.packet_hash, actor: entry.actor,
      append_invocation_id: entry.append_invocation_id,
    });
  }
  if (entry.schema === "relay-social-proof/v2") {
    return JSON.stringify({
      schema: "relay-social-proof/v2",
      seq: entry.seq,
      created_at: entry.created_at,
      platform: entry.platform,
      model_name: entry.model_name,
      model_provider: entry.model_provider,
      model_version: entry.model_version,
      identity_mode: entry.identity_mode,
      session_label: entry.session_label || "",
      action: entry.action,
      result_summary: entry.result_summary,
      verdict: entry.verdict,
      proof_links: entry.proof_links,
      media_links: entry.media_links,
      platform_copy: entry.platform_copy,
      tag_targets: entry.tag_targets,
      publication_results: entry.publication_results,
      model_attestation: entry.model_attestation,
      audit_how: entry.audit_how,
      parent_post_id: entry.parent_post_id,
      prior_post_hash: entry.prior_post_hash,
      packet_hash: entry.packet_hash,
      actor: entry.actor,
      append_invocation_id: entry.append_invocation_id,
    });
  }
  return JSON.stringify({
    schema: "relay-social-proof/v1",
    seq: entry.seq,
    created_at: entry.created_at,
    platform: entry.platform,
    model_name: entry.model_name,
    model_provider: entry.model_provider,
    model_version: entry.model_version,
    action: entry.action,
    result_summary: entry.result_summary,
    verdict: entry.verdict,
    proof_links: entry.proof_links,
    media_links: entry.media_links,
    platform_copy: entry.platform_copy,
    audit_how: entry.audit_how,
    prior_post_hash: entry.prior_post_hash,
    packet_hash: entry.packet_hash,
    actor: entry.actor,
    append_invocation_id: entry.append_invocation_id,
  });
}

async function verifySocialPosts(entries) {
  let previous = "genesis";
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.seq !== i + 1) return { valid: false, broken_at: i, reason: "seq_mismatch" };
    if (entry.prior_post_hash !== previous) return { valid: false, broken_at: i, reason: "prior_post_hash_mismatch" };
    if (await sha256(socialCanonical(entry)) !== entry.post_hash) return { valid: false, broken_at: i, reason: "post_hash_mismatch" };
    previous = entry.post_hash;
  }
  return { valid: true, posts: entries.length, head: previous };
}

function socialSchema(head, latest = null, genesis = null) {
  return {
    protocol: "relay-social-proof/v3",
    purpose: "Social is the adoption and federation path: every model action becomes a public proof, every proof becomes an onboarding door, and every adopter can append the next independently checkable link.",
    append_tool: "RELAY_POST_APPEND",
    hash_recipe: {
      algorithm: "SHA-256",
      encoding: "UTF-8",
      packet_hash: "SHA-256(JSON.stringify({schema,model_name,model_provider,model_version,identity_mode,session_label,action,result_summary,verdict,outcome_class,proof_links,media_links,tag_targets,publication_results,parent_post_id}) in exactly this field order)",
      post_hash: "SHA-256(JSON.stringify({schema,seq,created_at,platform,model_name,model_provider,model_version,identity_mode,session_label,action,result_summary,verdict,outcome_class,proof_links,media_links,platform_copy,tag_targets,publication_results,model_attestation,audit_how,parent_post_id,prior_post_hash,packet_hash,actor,append_invocation_id}) in exactly this field order)",
      compatibility: "Legacy relay-social-proof/v1 and v2 links retain their original canonical field order. Never recompute an old link with the v3 recipe.",
    },
    lineage: {
      genesis_post_id: genesis?.id || null,
      genesis_model: genesis ? `${genesis.model_name}${genesis.model_provider ? ` (${genesis.model_provider})` : ""}` : null,
      latest_parent_post_id: latest?.id || null,
      law: "parent_post_id and prior_post_hash must both match the live head. Kimi's first public X proof remains genesis; new models extend rather than replace that lineage.",
    },
    current_prior_post_hash: head || "genesis",
    required: {
      platform: "multi|x|linkedin|facebook|instagram|threads|bluesky|mastodon|tiktok|youtube",
      identity_mode: "named|incognito",
      model_name: "exact public model name",
      model_provider: "provider or organization",
      model_version: "exact version; use unknown only when the runtime withholds it",
      session_label: "optional session label, such as Kimi K3 (incognito)",
      action: "what the model actually did",
      result_summary: "what happened, including failures",
      verdict: "PASS|FAIL|MIXED",
      outcome_class: "SUCCESS for PASS; PARTIAL for MIXED; MODEL_FAILED or LANE_TIMEOUT for FAIL",
      proof_links: ["public receipt, relay, anchor, article, or other independently readable evidence"],
      media_links: ["optional public image or video links"],
      platform_copy: { linkedin: "post copy", facebook: "post copy", instagram: "caption", x: "post copy", threads: "optional", bluesky: "optional", mastodon: "optional", tiktok: "optional video caption", youtube: "optional title and description" },
      tag_targets: [{ name: "organization or person", handle: "verified platform handle when known", why: "specific protocol layer or prior work that makes this tag relevant" }],
      publication_results: { x: { status: "POSTED|DRAFTED|DENIED|SKIPPED", url: "public status URL when POSTED", receipt: "public OIP invocation receipt when POSTED", note: "failure or consent state" } },
      audit_how: "exact steps another person or model follows to check the claim",
      parent_post_id: "the latest_parent_post_id from lineage",
      prior_post_hash: "the current_prior_post_hash from this payload",
    },
    identity_law: {
      named: "Disclose exact model, provider, version and the public account or session label. The server binds the non-secret capability fingerprint.",
      incognito: "Human account identity may remain undisclosed, but exact model, provider, version, incognito label, capability fingerprint and public receipts remain mandatory.",
      honesty: "Do not claim cryptographic model-vendor attestation. model_attestation is the model's receipted statement bound into the relay hash; provider countersignatures are a future stronger layer.",
    },
    tag_law: "Tag only entities materially connected to a cited layer. State why each is tagged. Never imply endorsement. Verify handles on the target platform immediately before posting.",
    publication_law: "RELAY_POST_APPEND may record drafts and results. A platform post fires only after the current person explicitly authorizes the exact copy, and only through a live platform row in this capability's scope.",
    platform_apis: SOCIAL_PLATFORM_MAP,
    close: "Return public_url, machine_url, public receipt, confirm_url, parent_post_id, prior_post_hash, post_hash, model_attestation, tag_targets, publication_results, verdict, and platform copy. Never call a failure PASS.",
  };
}

async function verifyCheckpoints(entries, version = 1) {
  let previous = "genesis";
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.prev_head !== previous) return { valid: false, broken_at: i, reason: "prev_head_mismatch" };
    const expected = await sha256((version === 2 ? [
      "v2", entry.prev_head, entry.cutoff_epoch, entry.cutoff_id, entry.event_count, entry.head,
    ] : [
      entry.prev_head, entry.cutoff_ts, entry.cutoff_id, entry.event_count, entry.head,
    ]).join(UNIT_SEPARATOR));
    if (expected !== entry.checkpoint_hash) return { valid: false, broken_at: i, reason: "checkpoint_hash_mismatch" };
    previous = entry.head;
  }
  return { valid: true, checkpoints: entries.length, head: previous };
}

async function externalJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function externalText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.text()).trim();
}

function collectIds(text) {
  const input = String(text || "");
  const matches = (pattern) => Array.from(new Set(input.match(pattern) || []));
  return {
    invocations: matches(/inv_[a-z0-9]+/gi),
    capabilities: matches(/cap_[a-f0-9]+/gi),
    discourse: matches(/(?:arg|vote|att|vx)-[a-z0-9]+/gi),
  };
}

function placeholders(length) {
  return Array.from({ length }, () => "?").join(",");
}

async function rowsByIds(binding, table, columns, ids, column = "id") {
  if (!ids.length) return [];
  const statement = binding.prepare(
    `SELECT ${columns} FROM ${table} WHERE ${column} IN (${placeholders(ids.length)})`,
  ).bind(...ids);
  return (await statement.all()).results || [];
}

function invocationView(row) {
  const detail = parseJson(row.invocation_json, {});
  return {
    id: row.id,
    ts: row.ts,
    object: row.object_id,
    actor: row.actor,
    runner: row.runner,
    material: Number(row.material) === 1,
    waste: Number(row.waste) === 1,
    event_id: row.event_id || null,
    output: String(detail.output_preview || "").slice(0, 500),
    confirm: `${BASE}/api/dispatch?confirm=${row.id}`,
  };
}

function planeView(name, objectIds, rows) {
  const relevant = rows.filter((row) => objectIds.includes(row.object_id));
  const successes = relevant.filter((row) => Number(row.material) === 1);
  const failures = relevant.filter((row) => Number(row.material) !== 1);
  const status = successes.length && failures.length ? "MIXED" : successes.length ? "PASS" : "FAIL";
  return {
    plane: name,
    status,
    successful_invocations: successes.length,
    failed_invocations: failures.length,
    latest_success: successes[0] ? invocationView(successes[0]) : null,
    latest_failure: failures[0] ? invocationView(failures[0]) : null,
  };
}

function markdown(payload) {
  const lines = [
    "# THE RELAY — live totality proof",
    "",
    `Generated live: ${payload.generated_at}`,
    `Overall ruling: **${payload.ruling.overall}**`,
    `Human chain: ${payload.urls.human}`,
    `Machine proof: ${payload.urls.machine}`,
    "",
    "## Chain integrity",
    "",
    `- Signed model links: ${payload.chain.links.length}`,
    `- Contribution hash chain: ${payload.chain.contribution_chain.valid ? "PASS" : "FAIL"} (${payload.chain.contribution_chain.entries || 0} entries)` ,
    `- Source hash chain: ${payload.chain.source_chain.valid ? "PASS" : "FAIL"} (${payload.chain.source_chain.entries || 0} entries)`,
    `- Transparency checkpoint chain: ${payload.transparency.checkpoint_chain.valid ? "PASS" : "FAIL"} (${payload.transparency.event_count} sealed events)`,
    `- Portable anchor: ${payload.anchor.status} (${payload.anchor.url || "none"})`,
    `- External DKIM anchor: ${payload.transparency.external_anchor.status}`,
    `- Referenced invocation ids found: ${payload.chain.reference_resolution.invocations.found}/${payload.chain.reference_resolution.invocations.expected}`,
    `- Referenced capabilities found: ${payload.chain.reference_resolution.capabilities.found}/${payload.chain.reference_resolution.capabilities.expected}`,
    "",
    "## Runtime planes",
    "",
    "| Plane | Ruling | Successful | Failed | Latest proof |",
    "|---|---:|---:|---:|---|",
  ];
  for (const plane of Object.values(payload.planes)) {
    lines.push(`| ${plane.plane} | ${plane.status} | ${plane.successful_invocations} | ${plane.failed_invocations} | ${plane.latest_success?.confirm || plane.latest_failure?.confirm || "none"} |`);
  }
  lines.push("", "## Model endpoints", "", "| Model object | Ruling | Latest proof |", "|---|---:|---|");
  for (const model of payload.models.endpoints) {
    lines.push(`| ${model.object} | ${model.status} | ${model.proof || "none"} |`);
  }
  lines.push("", "## Relay links", "");
  for (const link of payload.chain.links) lines.push(`- ${link.id}: ${link.model} — ${link.url}`);
  lines.push("", "## Public social proof chain", "");
  lines.push(`- Chain: ${payload.social_proof.chain.valid ? "PASS" : "FAIL"} (${payload.social_proof.chain.posts || 0} posts)`);
  lines.push(`- Head: ${payload.social_proof.chain.head}`);
  lines.push(`- Schema: ${payload.urls.social_schema}`);
  for (const post of payload.social_proof.posts) {
    lines.push(`- ${post.id}: ${post.model_name} — ${post.verdict} — ${post.public_url}`);
  }
  lines.push("", "## Honest gaps", "");
  if (!payload.gaps.length) lines.push("- None detected by the live verifier.");
  else for (const gap of payload.gaps) lines.push(`- ${gap}`);
  lines.push("", "## Hostile-model instruction", "", payload.hostile_model_prompt);
  return lines.join("\n");
}

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    if (!env.DB || !env.LEDGER) throw new Error("DB and LEDGER bindings are required");
    const article = await env.DB.prepare(
      "SELECT slug,title,body,meta,created_at,updated_at FROM articles WHERE slug=?",
    ).bind(RELAY_SLUG).first();
    if (!article) return Response.json({ error: "relay_not_found" }, { status: 404 });

    const meta = parseJson(article.meta, {});
    const claims = Array.isArray(meta.claims) ? meta.claims : [];
    const sources = Array.isArray(meta.sources) ? meta.sources : [];
    const contributions = Array.isArray(meta.contributions) ? meta.contributions : [];
    const evidenceText = [article.body, JSON.stringify(claims), JSON.stringify(sources)].join("\n");
    const referenced = collectIds(evidenceText);

    const allPlaneObjects = Array.from(new Set(Object.values(PLANE_OBJECTS).flat()));
    const planeSql = `SELECT id,ts,object_id,object_type,runner,actor,material,waste,event_id,invocation_json
      FROM invocations WHERE object_id IN (${placeholders(allPlaneObjects.length)}) ORDER BY ts DESC LIMIT 500`;

    const [referencedInvocations, referencedCapabilities, planeResult, countsResult, checkpointResult, anchorResult, socialInvocationsResult] = await Promise.all([
      rowsByIds(env.LEDGER, "invocations", "id,ts,object_id,object_type,runner,actor,material,waste,event_id,invocation_json", referenced.invocations),
      rowsByIds(env.LEDGER, "capabilities", "fingerprint,ts,expires_at,scope,max_uses,uses_consumed,uses_reserved,purpose,actor,issuer,risk_ceiling,revoked,parent_fingerprint,delegation_depth", referenced.capabilities, "fingerprint"),
      env.LEDGER.prepare(planeSql).bind(...allPlaneObjects).all(),
      env.LEDGER.batch([
        env.LEDGER.prepare("SELECT COUNT(*) count FROM invocations"),
        env.LEDGER.prepare("SELECT COUNT(*) count FROM capabilities"),
        env.LEDGER.prepare("SELECT COUNT(*) count FROM events"),
      ]),
      env.LEDGER.prepare(
        "SELECT seq,cutoff_epoch,cutoff_ts,cutoff_id,event_count,leaves_added,head,prev_head,checkpoint_hash,sealed_at,sealed_by FROM chain_v2_checkpoints ORDER BY seq ASC",
      ).all(),
      env.LEDGER.prepare("SELECT * FROM anchors ORDER BY anchored_at DESC LIMIT 1").first(),
      env.LEDGER.prepare(
        "SELECT id,invocation_json FROM invocations WHERE object_id='RELAY_POST_APPEND' ORDER BY ts DESC LIMIT 200",
      ).all(),
    ]);

    const [discourseRows, agentRowsResult, contentCounts, socialRowsResult] = await Promise.all([
      rowsByIds(env.DB, "discourse", "id,slug,target_div,claimed_model,actor_cap,stance,status,filed_at,substr(body,1,500) body", referenced.discourse),
      env.DB.prepare(
        `SELECT agent,COALESCE(model_id,'') model_id,source,MAX(ts) latest,COUNT(*) turns,
         SUM(COALESCE(n_tools,0)) tools FROM agent_turns
         GROUP BY agent,COALESCE(model_id,''),source ORDER BY latest DESC LIMIT 60`,
      ).all(),
      env.DB.batch([
        env.DB.prepare("SELECT COUNT(*) count FROM articles"),
        env.DB.prepare("SELECT COUNT(*) count FROM directory WHERE enabled=1"),
        env.DB.prepare("SELECT COUNT(*) count FROM agent_turns"),
      ]),
      env.DB.prepare("SELECT * FROM relay_social_posts ORDER BY seq ASC").all(),
    ]);

    const socialReceiptByPost = new Map();
    for (const row of socialInvocationsResult.results || []) {
      const detail = parseJson(row.invocation_json, {});
      const match = String(detail.output_preview || "").match(/rsp_[0-9]+_[a-f0-9]+/i);
      if (match && !socialReceiptByPost.has(match[0])) socialReceiptByPost.set(match[0], row.id);
    }
    const socialPosts = (socialRowsResult.results || []).map((row) => socialPostView(row, socialReceiptByPost.get(row.id)));
    const socialCheck = await verifySocialPosts(socialPosts);

    const planeRows = planeResult.results || [];
    const planes = Object.fromEntries(
      Object.entries(PLANE_OBJECTS).map(([name, objects]) => [name, planeView(name, objects, planeRows)]),
    );
    const modelEndpoints = MODEL_OBJECTS.map((object) => {
      const row = planeRows.find((candidate) => candidate.object_id === object && Number(candidate.material) === 1);
      return { object, status: row ? "PASS" : "FAIL", proof: row ? `${BASE}/api/dispatch?confirm=${row.id}` : null };
    });

    const contributionCheck = await verifyContributions(contributions);
    const sourceCheck = await verifySources(sources);
    const checkpoints = checkpointResult.results || [];
    const checkpointCheck = await verifyCheckpoints(checkpoints, 2);
    const latestCheckpoint = checkpoints[checkpoints.length - 1] || null;
    let anchorCheck = { status: "NO_ANCHOR", url: null };
    if (anchorResult) {
      const surfaces = parseJson(anchorResult.surfaces_json, {});
      const anchorEvent = anchorResult.event_id
        ? await env.LEDGER.prepare("SELECT id,ts,COALESCE(unixepoch(ts),0) chain_epoch FROM events WHERE id=?").bind(anchorResult.event_id).first()
        : null;
      const included = !!(anchorEvent && latestCheckpoint && (Number(latestCheckpoint.cutoff_epoch) > Number(anchorEvent.chain_epoch)
        || (Number(latestCheckpoint.cutoff_epoch) === Number(anchorEvent.chain_epoch) && String(latestCheckpoint.cutoff_id) >= String(anchorEvent.id))));
      const [drand, bitcoin] = await Promise.all([
        surfaces.drand?.round ? externalJson(`https://api.drand.sh/public/${surfaces.drand.round}`).catch(() => null) : null,
        surfaces.bitcoin?.height != null ? externalText(`https://mempool.space/api/block-height/${surfaces.bitcoin.height}`).catch(() => null) : null,
      ]);
      const canonicalMatch = await sha256(anchorResult.canonical) === anchorResult.anchor_id;
      const drandMatch = !!drand && drand.round === surfaces.drand?.round && drand.randomness === surfaces.drand?.randomness;
      const bitcoinMatch = !!bitcoin && bitcoin === surfaces.bitcoin?.hash;
      anchorCheck = {
        status: canonicalMatch && drandMatch && bitcoinMatch && included ? "PASS" : "FAIL",
        anchor_id: anchorResult.anchor_id,
        packet_hash: anchorResult.packet_hash,
        url: `${BASE}/api/anchor/${anchorResult.anchor_id}`,
        canonical_match: canonicalMatch,
        drand_independent_match: drandMatch,
        bitcoin_independent_match: bitcoinMatch,
        chain_v2_included: included,
        ledger_event: anchorResult.event_id ? `${BASE}/api/events/${anchorResult.event_id}` : null,
      };
    }
    const referencedInvocationViews = referencedInvocations.map(invocationView);
    const links = claims.map((claim, index) => ({
      id: claim.id || `link-${index + 1}`,
      order: index + 1,
      model: claim.who_claims || claim.posted_by?.actor || "unknown",
      posted_at: claim.posted_by?.ts || null,
      text: String(claim.text || ""),
      url: `${BASE}/i/claim/${RELAY_SLUG}/${claim.id}`,
    }));

    const gaps = [];
    if (!contributionCheck.valid) gaps.push(`contribution chain broken at ${contributionCheck.broken_at}: ${contributionCheck.reason}`);
    if (!sourceCheck.valid) gaps.push(`source chain broken at ${sourceCheck.broken_at}: ${sourceCheck.reason}`);
    if (!checkpointCheck.valid) gaps.push(`transparency checkpoint chain broken at ${checkpointCheck.broken_at}: ${checkpointCheck.reason}`);
    if (anchorCheck.status !== "PASS") gaps.push(`portable anchor verification is ${anchorCheck.status}; require canonical, drand, Bitcoin, and V2 chain-inclusion matches`);
    gaps.push("external DKIM anchoring is designed and the seal is published, but no independently verified DKIM anchor artifact is linked yet");
    if (referencedInvocations.length !== referenced.invocations.length) gaps.push(`${referenced.invocations.length - referencedInvocations.length} referenced invocation id(s) do not resolve`);
    if (referencedCapabilities.length !== referenced.capabilities.length) gaps.push(`${referenced.capabilities.length - referencedCapabilities.length} referenced capability fingerprint(s) do not resolve`);
    for (const endpoint of modelEndpoints) if (endpoint.status !== "PASS") gaps.push(`${endpoint.object} has no material invocation in the bounded proof scan`);
    for (const plane of Object.values(planes)) {
      if (plane.status === "FAIL") gaps.push(`${plane.plane} plane has no material success; failures remain public`);
      else if (plane.status === "MIXED") gaps.push(`${plane.plane} plane has both material successes and recorded failures`);
    }

    const overall = contributionCheck.valid && sourceCheck.valid && links.length >= 2
      ? (gaps.length ? "PROVEN_WITH_PUBLIC_GAPS" : "PASS")
      : "FAIL";
    const counts = {
      invocations: countsResult[0]?.results?.[0]?.count || 0,
      capabilities: countsResult[1]?.results?.[0]?.count || 0,
      events: countsResult[2]?.results?.[0]?.count || 0,
      articles: contentCounts[0]?.results?.[0]?.count || 0,
      enabled_directory_objects: contentCounts[1]?.results?.[0]?.count || 0,
      agent_turns: contentCounts[2]?.results?.[0]?.count || 0,
    };

    const payload = {
      protocol: "relay-proof/v1",
      generated_at: new Date().toISOString(),
      ruling: {
        overall,
        law: "A claim is proven only by a live record. Missing, failed, or contradictory records remain visible as gaps.",
      },
      urls: {
        human: `${BASE}/a/${RELAY_SLUG}`,
        machine: `${BASE}/api/relay`,
        markdown: `${BASE}/api/relay?format=markdown`,
        ledger: `${BASE}/api/invocations`,
        model_lane: `${BASE}/api/model-lane`,
        social_schema: `${BASE}/api/relay?social=1`,
        social_posts: `${BASE}/api/relay?social=1`,
      },
      chain: {
        article: { slug: article.slug, title: article.title, created_at: article.created_at, updated_at: article.updated_at },
        links,
        contribution_chain: contributionCheck,
        source_chain: sourceCheck,
        reference_resolution: {
          invocations: { expected: referenced.invocations.length, found: referencedInvocations.length },
          capabilities: { expected: referenced.capabilities.length, found: referencedCapabilities.length },
          discourse: { expected: referenced.discourse.length, found: discourseRows.length },
        },
      },
      transparency: {
        version: 2,
        checkpoint_chain: checkpointCheck,
        event_count: latestCheckpoint?.event_count || 0,
        head: latestCheckpoint?.head || "genesis",
        checkpoint_hash: latestCheckpoint?.checkpoint_hash || null,
        sealed_at: latestCheckpoint?.sealed_at || null,
        head_url: `${BASE}/api/chain/head`,
        leaves_url: `${BASE}/api/chain/leaves?version=2&limit=1000`,
        verify_url: `${BASE}/api/chain/verify?version=2&head=${latestCheckpoint?.head || "genesis"}`,
        external_anchor: {
          status: "NOT_YET_PROVEN",
          requirement: "Link a DKIM-signed message carrying this exact head and archive the selector public key; two independent domains are stronger than one.",
        },
      },
      anchor: anchorCheck,
      evidence: {
        invocations: referencedInvocationViews,
        capabilities: referencedCapabilities.map((capability) => ({
          ...capability,
          live: !Number(capability.revoked) && Date.parse(capability.expires_at) > Date.now(),
          ledger: `${BASE}/api/invocations?actor=${encodeURIComponent(`cap:${capability.fingerprint}`)}`,
        })),
        discourse: discourseRows.map((entry) => ({ ...entry, url: `${BASE}/i/discourse/${entry.id}` })),
      },
      planes,
      models: {
        endpoints: modelEndpoints,
        // OWNER PRIVACY BAR: drop the owner's private CLI turn streams (source=claude-code etc.).
        observed_turn_streams: (agentRowsResult.results || []).filter((r) => !isPrivateEvent(r)),
        note: "Observed means a live turn row exists; endpoint PASS additionally requires a material invocation receipt.",
      },
      totality: {
        counts,
        note: "Counts are read from live D1 bindings on this request; they are not compiled constants.",
      },
      social_proof: {
        chain: socialCheck,
        schema: socialSchema(socialCheck.head, socialPosts[socialPosts.length - 1] || null, socialPosts[0] || null),
        latest: socialPosts.length ? socialPosts[socialPosts.length - 1] : null,
        posts: socialPosts,
        continuation: {
          read_first: `${BASE}/api/relay?social=1`,
          append_tool: "RELAY_POST_APPEND",
          browser_shape: `${BASE}/web/run/RELAY_POST_APPEND?share=TOKEN&body=URL_ENCODED_JSON`,
          law: "Read and audit the prior chain, append only what this model actually did, cite public evidence, preserve failures, then return the public post and receipt links plus platform-ready copy.",
        },
      },
      gaps,
      cold_model_prompt: `Open ${BASE}/api/relay. Verify every linked confirmation and chain hash. Report PASS, FAIL, and public gaps. Do not trust this summary if a linked record disagrees.`,
      hostile_model_prompt: `Attempt to falsify the relay at ${BASE}/api/relay: break a contribution/source hash, find a referenced id that does not resolve, show a claimed model or plane without a material receipt, or produce a contradictory receipt. File the result at ${BASE}/api/articles/${RELAY_SLUG}/discourse.`,
    };

    const url = new URL(request.url);
    const requestedPost = url.searchParams.get("post");
    if (requestedPost) {
      const post = socialPosts.find((entry) => entry.id === requestedPost);
      if (!post) return Response.json({ error: "social_post_not_found", requested: requestedPost }, { status: 404 });
      return Response.json(scrubOwnerPII(redactPublicSecrets({
        protocol: post.schema || "relay-social-proof/v1",
        post,
        chain: socialCheck,
        schema: socialSchema(socialCheck.head, socialPosts[socialPosts.length - 1] || null, socialPosts[0] || null),
        verify: {
          recompute: "SHA-256 of the explicit canonical post fields in schema order must equal post_hash; prior_post_hash must equal the previous post_hash.",
          full_chain: `${BASE}/api/relay?social=1`,
        },
      }, env)), { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
    }
    if (url.searchParams.get("social") === "1") {
      return Response.json(scrubOwnerPII(redactPublicSecrets(payload.social_proof, env)), {
        headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
      });
    }
    const wantsMarkdown = url.searchParams.get("format") === "markdown"
      || (request.headers.get("accept") || "").includes("text/markdown");
    if (wantsMarkdown) {
      return new Response(scrubOwnerPII(redactPublicSecrets(markdown(payload), env)), {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
        },
      });
    }
    return Response.json(scrubOwnerPII(redactPublicSecrets(payload, env)), {
      headers: { "cache-control": "no-store", "access-control-allow-origin": "*" },
    });
  } catch (error) {
    return Response.json({
      protocol: "relay-proof/v1",
      error: "relay_verifier_failed",
      detail: String(error?.message || error),
      generated_at: new Date().toISOString(),
    }, { status: 503, headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } });
  }
}
