// Extracted from api/dispatch.js: the 224 fn-runner implementations (the 'fn' capability plane).
// makeFnMap injects the dispatch-module symbols the runners close over (proven complete by
// static free-variable analysis: 0 unresolved). FN_MAP is an internal const so methods that call
// siblings via FN_MAP.x resolve to this same object. No behavior change — pure relocation.
import { sendFromHome } from './oip_federation.js';
import { appendGovernanceRecord } from './oip_governance.js';
import { parseDecisionFinding, derivationSignature } from './decision_finding.js';
import { checkGovernedWrite, governedTableIn } from './governed_tables.js';

async function relaySha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(value || '')));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ---- METER + TENANT plumbing (minimum proof, 2026-07-28) — see the LEADS ENGINE header
// for the verified unit prices these constants carry.
const PLACES_TEXTSEARCH_USD = 0.04;            // per searchText request, Enterprise + Atmosphere SKU
// Find Place and Place Details (Basic Data) bill at $17.00/1,000 requests. Site resolution spends two
// of these per identified lead (phone -> place_id, then place_id -> website), so a resolved lead costs
// about $0.034 and an unidentifiable one about $0.017. Discovery is much cheaper per lead than either,
// because one searchText request returns up to 20 places: $0.04/20 = $0.002 per lead.
const PLACES_FINDPLACE_USD = 0.017;            // per Find Place / Place Details request, Basic Data SKU
const GROK43_IN_PER_M = 1.25, GROK43_OUT_PER_M = 2.50;
const GEMINI25F_IN_PER_M = 0.30, GEMINI25F_OUT_PER_M = 2.50;
// Add a real provider cost to the dispatch cost accumulator so logInvocation records it.
function meterCost(env, usd) {
  const c = env && env.TRACE_CTX;
  if (c && Number.isFinite(usd) && usd > 0) c.cost = (c.cost || 0) + usd;
}
// The tenant bound to the invoking capability token, or null for owner/untenanted calls.
function meterTenant(env) {
  const c = env && env.TRACE_CTX;
  return (c && c.authContext && c.authContext.tenant_id) || null;
}
// Real cost of one callGateway() round-trip from its returned usage block.
function gatewayCostUsd(g) {
  const u = g && g.usage;
  if (!u) return 0;
  if (g && g.fallback === 'gemini') {
    const pi = Number(u.promptTokenCount || 0);
    const po = Number(u.candidatesTokenCount || 0) + Number(u.thoughtsTokenCount || 0);
    return Math.round((pi * GEMINI25F_IN_PER_M + po * GEMINI25F_OUT_PER_M)) / 1e6;
  }
  const pi = Number(u.prompt_tokens || 0);
  const po = Number(u.completion_tokens || 0);
  return Math.round((pi * GROK43_IN_PER_M + po * GROK43_OUT_PER_M)) / 1e6;
}

function relayText(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function relayLinks(value, max = 20) {
  return (Array.isArray(value) ? value : [])
    .map((item) => relayText(item, 1000))
    .filter((item) => /^https:\/\//i.test(item))
    .slice(0, max);
}

function relayTagTargets(value) {
  return (Array.isArray(value) ? value : []).slice(0, 16).map((item) => ({
    name: relayText(item?.name, 160),
    handle: relayText(item?.handle, 160),
    why: relayText(item?.why, 500),
  })).filter((item) => item.name && item.why);
}

function relayPublicationResults(value) {
  const allowed = new Set(['x', 'linkedin', 'facebook', 'instagram', 'threads', 'bluesky', 'mastodon', 'tiktok', 'youtube']);
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [platform, raw] of Object.entries(value)) {
    const key = relayText(platform, 24).toLowerCase();
    if (!allowed.has(key) || !raw || typeof raw !== 'object') continue;
    const status = relayText(raw.status, 16).toUpperCase();
    if (!['POSTED', 'DRAFTED', 'DENIED', 'SKIPPED'].includes(status)) continue;
    out[key] = {
      status,
      url: relayLinks(raw.url ? [raw.url] : [], 1)[0] || null,
      receipt: relayLinks(raw.receipt ? [raw.receipt] : [], 1)[0] || null,
      note: relayText(raw.note, 500) || null,
    };
  }
  return out;
}

// SQL PREFLIGHT (owner, 2026-07-28). The ledger showed 158 identical D1 failures whose
// only cause was the argument never arriving as SQL: an empty body (42x "No SQL statements
// detected"), a leading "# ..." doc line pasted in as the statement, or a malformed verb
// ("SELECT FROM nowhere"). D1 answers all of these with an opaque D1_ERROR, so the caller
// retries the same broken shape. This turns each into a named, actionable refusal that
// tells the caller exactly what to change, so a repeat is a different call, not the same one.
export function sqlPreflight(key, sql, kind) {
  let s = String(sql == null ? '' : sql).trim();
  // A pasted doc block ("# WHAT: ...") is documentation, not a statement. Strip leading
  // comment lines rather than handing D1 a comment and getting "No SQL statements detected".
  const lines = s.split('\n');
  let i = 0;
  while (i < lines.length && (/^\s*#/.test(lines[i]) || /^\s*--/.test(lines[i]))) i++;
  s = lines.slice(i).join('\n').trim();
  if (!s) {
    return { err: 'ERR:' + key + ':empty_sql — no statement arrived. The body was empty or only comments. ' +
      'Send the full SQL as the first (and only) argument, e.g. ' + key + ' | SELECT slug FROM articles LIMIT 3. ' +
      'Use double quotes for string literals; single quotes are consumed by the argument parser.' };
  }
  const verb = (s.match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
  const SELECTY = ['SELECT', 'WITH', 'PRAGMA', 'EXPLAIN'];
  if (kind === 'select' && !SELECTY.includes(verb)) {
    return { err: 'ERR:' + key + ':not_a_read:' + (verb || '?') + ' — this capability only runs SELECT/WITH/PRAGMA. ' +
      'For a write use D1_EXEC (content DB) or LEDGER_EXEC (events DB).' };
  }
  if (kind === 'write' && SELECTY.includes(verb)) {
    return { err: 'ERR:' + key + ':not_a_write:' + verb + ' — this capability only runs INSERT/UPDATE/DELETE/CREATE. ' +
      'For a read use D1_QUERY (content DB) or LEDGER_QUERY (events DB).' };
  }
  if (/^SELECT\s+FROM\b/i.test(s)) {
    return { err: 'ERR:' + key + ':no_columns — "SELECT FROM" names no columns. Write SELECT <cols> FROM <table>, ' +
      'or SELECT * FROM <table>.' };
  }
  if (/\bFROM\s*$/i.test(s) || /\bWHERE\s*$/i.test(s)) {
    return { err: 'ERR:' + key + ':truncated_sql — the statement ends after FROM/WHERE. The argument was probably ' +
      'cut at a pipe. Escape pipes or send the statement as the only argument.' };
  }
  return { sql: s };
}

// A "no such column" / "no such table" error sends the caller guessing a second and third
// column name. 16 ledger events were exactly that. Answer with the real schema instead, so
// the next call is informed rather than another guess (owner, 2026-07-28).
export async function sqlSchemaHint(db, key, sql, err) {
  const msg = String((err && err.message) || err || '');
  const col = (msg.match(/no such column:\s*([A-Za-z0-9_.]+)/) || [])[1];
  const tbl = (msg.match(/no such table:\s*([A-Za-z0-9_.]+)/) || [])[1];
  let hint = '';
  try {
    if (tbl) {
      const r = await db.prepare('SELECT name FROM sqlite_master WHERE type="table" ORDER BY name').all();
      hint = ' Tables that exist: ' + (r.results || []).map((x) => x.name).join(', ') + '.';
    } else if (col) {
      const from = (String(sql).match(/\bFROM\s+([A-Za-z0-9_]+)/i) || [])[1];
      if (from) {
        const r = await db.prepare('SELECT name FROM pragma_table_info("' + from + '")').all();
        const cols = (r.results || []).map((x) => x.name);
        if (cols.length) hint = ' Columns in ' + from + ': ' + cols.join(', ') + '.';
      }
    }
  } catch { /* hint is best-effort */ }
  return 'ERR:' + key + ':' + msg + hint + ' Do not guess a second name — use the list above.';
}

// PLATFORM RENDER LAW, mechanically enforced for X (owner, 2026-07-24).
// A post is a visual object in a feed, not a paragraph. Every rule here mirrors the
// post-to-x skill; the tool refuses what the skill forbids so a model that skips the
// skill still cannot publish off-register copy. Returns a violation code + the fix, or ''.
export function xFormatViolation(text) {
  const t = String(text || '');
  // 1. Machine-log headers. Kimi k1.5 posted "[Kimi Chat · Kimi k1.5 · 2026-07-24 20:18 UTC]"
  //    as the hook — a log line where the headline belongs.
  if (/^\s*\[[^\]\n]{4,}\]/.test(t))
    return 'machine_log_header — the first line is the headline readers see before "show more". Delete the [bracketed log header] and open with the most surprising concrete fact in <=8 words.';
  // 2. A foreign model introducing itself, or promoting itself in the third person, on the
  //    owner's account. The signature names the author; the copy never advertises the model.
  if (/\b(?:i'?m|i am)\s+(?:kimi|grok|gemini|gpt|chatgpt|deepseek|qwen|claude|llama)\b/i.test(t))
    return 'model_self_introduction — the account is the owner\'s. Never introduce yourself in the copy; the trailing signature is the only authorship marker.';
  if (/\b(?:kimi|grok|gemini|chatgpt|deepseek|qwen)\s+(?:shipped|wrote|published|posted|built|dropped)\b/i.test(t))
    return 'model_self_promotion — write about the finding, not about which model produced it. Authorship belongs in the signature line only.';
  // 3. The signature. CLAUDE.md SIGN YOUR WORK: "— <Model> (<surface>)" as the last line.
  const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  if (!/^[—-]\s*\S.*\([^)]+\)$/.test(last))
    return 'missing_signature — the last line must be the model signature, e.g. "— Fable 5 (Claude Code)". Trim the body to fit 280; never drop the signature or the link.';
  // 4. Paragraph blobs. Line breaks are the typography on X.
  const body = lines.filter((l) => !/^https?:\/\//.test(l) && l !== last && !/^#\S+/.test(l));
  if (body.length === 1 && body[0].length > 180)
    return 'paragraph_blob — a wall of text reads as spam. Break it: hook line, blank line, one short beat per line (3-6 lines total).';
  // 5. Generic hashtags are a spam signal; one niche tag or none.
  const tags = t.match(/#\w+/g) || [];
  const generic = tags.filter((h) => /^#(ai|artificialintelligence|tech|technology|innovation|health|wellness|science|future|machinelearning|ml|llm|startup|startups)$/i.test(h));
  if (generic.length)
    return 'generic_hashtag:' + generic.join(',') + ' — generic tags read as spam. Use at most ONE niche searchable tag (e.g. #BPC157, #peptides, #buildinpublic) or none.';
  if (tags.length > 1)
    return 'hashtag_spam:' + tags.length + ' — at most one hashtag per post.';
  return '';
}

export function normalizeXPostText(value) {
  let text = String(value == null ? '' : value).trim();
  let decoded = false;
  let unwrapped = false;
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('"') && text.endsWith('"'))) {
      try {
        const parsed = JSON.parse(text);
        const candidate = typeof parsed === 'string'
          ? parsed
          : parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            && Object.keys(parsed).length === 1 && typeof parsed.text === 'string'
            ? parsed.text
            : null;
        if (candidate != null && candidate !== text) {
          text = String(candidate).trim();
          unwrapped = true;
          changed = true;
        }
      } catch {}
    }
    if (changed) continue;
    if (/%[0-9a-f]{2}/i.test(text)) {
      try {
        const candidate = decodeURIComponent(text);
        if (candidate !== text) {
          text = candidate.trim();
          decoded = true;
          changed = true;
        }
      } catch {}
    }
    if (!changed) break;
  }
  return { text, normalized: decoded || unwrapped, decoded, unwrapped };
}

const SOCIAL_FIRST_PERSON_RE = /\b(?:i|i['’](?:m|ve|d|ll)|me|my|mine|myself|we|we['’](?:re|ve|d|ll)|us|our|ours|ourselves)\b/i;
const SOCIAL_GENERIC_HYPE_RE = /\b(?:one door|rival (?:ai )?models?|game[- ]changer|the future is here|this is (?:insane|wild|crazy)|holy shit|what the actual fuck|verify,? don['’]?t trust|every (?:action|act) leaves a receipt|ran (?:the )?(?:whole protocol|oip) end[- ]to[- ]end)\b/i;
// Human-readable attribution, NOT a machine timestamp lead. Owner order 2026-07-22: a post must
// never open with a clock reading, and never in UTC — nobody writes that way. The required
// signature is just [execution surface · exact model]. An optional third field is allowed only if
// it is a Pacific-time date/time (the build clock); a UTC/Z stamp is rejected outright.
const SOCIAL_SIGNATURE_RE = /^\[([^\]\n·]{2,80}) · ([^\]\n·]{2,80})(?: · ([^\]\n]{2,80}))?\]\n/;
const SOCIAL_UTC_STAMP_RE = /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?\s*(?:Z|UTC)\b/i;
const SOCIAL_NON_WORK_OBJECTS = new Set([
  'NOW', 'X_POST', 'RELAY_POST_APPEND', 'CAP_EXPLAIN', 'ARTICLE_GET',
  'ARCADS_CREDITS', 'WORLD_MAP', 'DIR_GET', 'DIR_LIST', 'SEARCH_TOOLS', 'OIP_GOVERNANCE',
]);

// Model-authored social proof is an attributed field record, never first-person account
// impersonation. The signature is intentionally human-readable and portable across platforms:
// [execution surface · exact model · Pacific timestamp]. UTC is BARRED and rejected below — this line
// said "UTC timestamp" for as long as the bar existed, which told every reader to write the one thing
// the validator refuses. The body remains free-form, but it must
// lead with one concrete observed result instead of the stock hype phrases that made prior posts
// interchangeable and uninformative.
export function validateModelSocialCopy(value, expected = {}) {
  const text = String(value == null ? '' : value).trim();
  if (SOCIAL_UTC_STAMP_RE.test(text)) return { ok: false, reason: 'utc_timestamp_barred_use_pacific', text };
  const match = text.match(SOCIAL_SIGNATURE_RE);
  if (!match) return { ok: false, reason: 'missing_attribution_header', text };
  const surface = match[1].trim();
  const model = match[2].trim();
  const observedAt = (match[3] || '').trim();
  const body = text.slice(match[0].length).trim();
  if (!body) return { ok: false, reason: 'empty_observation', text, surface, model, observed_at: observedAt };
  if (SOCIAL_FIRST_PERSON_RE.test(body)) return { ok: false, reason: 'first_person_barred', text, surface, model, observed_at: observedAt };
  if (SOCIAL_GENERIC_HYPE_RE.test(body)) return { ok: false, reason: 'generic_breathless_copy_barred', text, surface, model, observed_at: observedAt };
  if (expected.surface && surface.toLowerCase() !== String(expected.surface).trim().toLowerCase()) {
    return { ok: false, reason: 'execution_surface_mismatch', text, surface, model, observed_at: observedAt };
  }
  if (expected.model && model.toLowerCase() !== String(expected.model).trim().toLowerCase()) {
    return { ok: false, reason: 'model_name_mismatch', text, surface, model, observed_at: observedAt };
  }
  if (expected.incognito && !/\bincognito\b/i.test(surface)) {
    return { ok: false, reason: 'incognito_label_required', text, surface, model, observed_at: observedAt };
  }
  return { ok: true, text, surface, model, observed_at: observedAt, body };
}

export function makeFnMap(D) {
  const { ARTICLE_BACKGROUND_LOCK_KEY, LOCKED_AUTORUN_KEYS, LOOP_FLAGS, OIP_VERSION, OWNER_BLOOIO_CHAT, SIBLING_BASE, appendMirrorContribution, arcadsUploadInner, articleBackgroundWritesLocked, assembleAgentPrompt, authForModel, authorizeCompositeReceipt, blooioSend, buildAraAfplayCmd, buildNowIso, callGateway, capabilityChainStatus, directoryRowToObject, dispatch, dispatchHeaders, dispatchNestedAuthorized, evaluateExpect, explainCapability, flagEnables, getCapabilityByFingerprint, getInvocation, getMirrorFeed, githubApi, githubTailApi, grokImageToR2, isArticleBackgroundRole, isAutomatedActor, keyify, kvGetFlag, ledgerCapEvent, levenshteinSmall, linkRepairedBy, loadDirectory, loadPromptBlockMap, logEvent, logInvocation, mcpFreshToken, mcpRpc, mintCapability, oipProtocolPayload, parseFrontmatter, parseIncludes, pipeJson, protocolFlagForRole, readEventFull, receiptPayload, redactReq, registryFromRows, resolveMirrorContribution, resolveSource, revokeCapability, runCliAgentGroup, spawnCliAgent, sqlEsc, storeB64Png, stripePost, tailLatexEscape, tailLiveCounts, tailReadFile, tailRenderReadme, tailWriteFile, triggerIssueReflex, wrapDispatchResponse, xOAuth1Header, xWriteFailureMessage, xaiSearch } = D;
  const FN_MAP = {
  async oipGovernance(env, raw) {
    const actor = env.TRACE_CTX?.actor || 'capability-model';
    const result = await appendGovernanceRecord(env, raw, {
      actor,
      ownerAuthed: !!env.TRACE_CTX?.authContext?.ownerAuthed,
    });
    return result.ok ? JSON.stringify(result) : 'ERR:fn:oip_governance:' + (result.error || 'rejected') + ':' + JSON.stringify(result);
  },
  // ── The model comment ledger (owner order 2026-08-05) ─────────────────────────────────────
  // Every article carries a public comment thread. These three rows are how an agent working
  // through dispatch reads it, writes to it, and answers it. The HTTP door at /api/comments is
  // the same machinery for models arriving from a chat window with no dispatch access.
  async ledgerCommentWrite(env, slugArg, actorArg, bodyArg, verdictArg) {
    const { postComment } = await import('./article_ledger.js');
    const result = await postComment(env, {
      slug: slugArg, actor: actorArg, body: bodyArg,
      verdict: verdictArg || null,
      fingerprint: env.TRACE_CTX?.fingerprint || null,
    });
    if (result.error) return 'ERR:fn:ledger_comment:' + result.error + ':' + JSON.stringify(result);
    return JSON.stringify(result);
  },
  async ledgerCommentsOpen(env, limitArg, slugArg) {
    const { listOpenComments } = await import('./article_ledger.js');
    const rows = await listOpenComments(env, {
      limit: parseInt(limitArg, 10) || 100,
      slug: slugArg ? String(slugArg).toLowerCase() : null,
    });
    return JSON.stringify({
      count: rows.length,
      answer_with: 'LEDGER_COMMENT_REPLY|<id>|<your answer>  — or pass a JSON array to answer many at once',
      comments: rows.map((r) => ({ ...r, thread: `https://miscsubjects.com/a/${r.slug}#ledger-${r.id}` })),
    });
  },
  async ledgerCommentReply(env, idArg, bodyArg) {
    const { replyToComment } = await import('./article_ledger.js');
    // One id and a body, or a JSON array to answer three hundred comments in a single call —
    // which is the point of the row, not an optimisation of it.
    let batch = null;
    const raw = String(idArg || '').trim();
    if (raw.startsWith('[')) {
      try { batch = JSON.parse(raw); } catch { return 'ERR:fn:ledger_comment_reply:array_must_be_json'; }
    }
    if (!batch) batch = [{ id: raw, body: bodyArg }];
    const results = [];
    for (const item of batch.slice(0, 500)) {
      results.push(await replyToComment(env, { id: item.id, body: item.body, actor: item.actor || 'the build' }));
    }
    const answered = results.filter((r) => r.ok).length;
    return JSON.stringify({ answered, failed: results.length - answered, results });
  },

  // ── The coding law (owner order 2026-08-05) ───────────────────────────────────────────────
  // A hash when the work starts, a hash when the work commits. These two rows are the dispatch
  // form of POST /api/coding-law/start and /commit; both write the same tables.
  async codeLeaseStart(env, agentArg, filesArg, intentArg) {
    let files;
    try { files = JSON.parse(String(filesArg || '[]')); }
    catch { return 'ERR:fn:code_lease_start:files_must_be_json_array'; }
    const r = await fetch('https://miscsubjects.com/api/coding-law/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent: agentArg, intent: intentArg || '', files }),
    });
    const text = await r.text();
    return r.ok ? text : 'ERR:fn:code_lease_start:' + r.status + ':' + text;
  },
  async codeLeaseCommit(env, leaseArg, filesArg) {
    let files;
    try { files = JSON.parse(String(filesArg || '[]')); }
    catch { return 'ERR:fn:code_lease_commit:files_must_be_json_array'; }
    const r = await fetch('https://miscsubjects.com/api/coding-law/commit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lease_id: leaseArg, files }),
    });
    const text = await r.text();
    // A 409 is the law working. It is returned as an error string so the calling agent stops
    // rather than proceeding to git commit — that stop is the entire value of the mechanism.
    return r.ok ? text : 'ERR:fn:code_lease_commit:' + r.status + ':' + text;
  },

  async relayPostAppend(env, raw) {
    let input;
    try { input = JSON.parse(String(raw || '')); }
    catch { return 'ERR:fn:relay_post:body_must_be_json'; }

    const platform = relayText(input.platform || 'multi', 24).toLowerCase();
    const platforms = new Set(['multi', 'linkedin', 'facebook', 'instagram', 'x', 'threads', 'bluesky', 'mastodon', 'tiktok', 'youtube']);
    const verdict = relayText(input.verdict, 12).toUpperCase();
    const outcomeClass = relayText(input.outcome_class, 24).toUpperCase();
    const identityMode = relayText(input.identity_mode || 'named', 16).toLowerCase();
    const sessionLabel = relayText(input.session_label, 160);
    const modelName = relayText(input.model_name, 160);
    const modelProvider = relayText(input.model_provider, 160);
    const modelVersion = relayText(input.model_version, 160);
    const action = relayText(input.action, 1000);
    const resultSummary = relayText(input.result_summary, 4000);
    const auditHow = relayText(input.audit_how, 2000);
    const proofLinks = relayLinks(input.proof_links);
    const mediaLinks = relayLinks(input.media_links);
    const copyInput = input.platform_copy && typeof input.platform_copy === 'object' ? input.platform_copy : {};
    const platformCopy = {
      linkedin: relayText(copyInput.linkedin, 5000),
      facebook: relayText(copyInput.facebook, 5000),
      instagram: relayText(copyInput.instagram, 5000),
      x: relayText(copyInput.x, 1000),
      threads: relayText(copyInput.threads, 5000),
      bluesky: relayText(copyInput.bluesky, 5000),
      mastodon: relayText(copyInput.mastodon, 5000),
      tiktok: relayText(copyInput.tiktok, 5000),
      youtube: relayText(copyInput.youtube, 5000),
    };
    const tagTargets = relayTagTargets(input.tag_targets);
    const publicationResults = relayPublicationResults(input.publication_results);
    const priorPostHash = relayText(input.prior_post_hash, 64).toLowerCase();
    const parentPostId = relayText(input.parent_post_id, 120) || null;

    if (!platforms.has(platform)) return 'ERR:fn:relay_post:unsupported_platform';
    if (!['PASS', 'FAIL', 'MIXED'].includes(verdict)) return 'ERR:fn:relay_post:verdict_must_be_PASS_FAIL_or_MIXED';
    if (!['SUCCESS', 'PARTIAL', 'MODEL_FAILED', 'LANE_TIMEOUT'].includes(outcomeClass)) return 'ERR:fn:relay_post:outcome_class_must_be_SUCCESS_PARTIAL_MODEL_FAILED_or_LANE_TIMEOUT';
    if (verdict === 'PASS' && outcomeClass !== 'SUCCESS') return 'ERR:fn:relay_post:PASS_requires_SUCCESS_outcome_class';
    if (verdict === 'MIXED' && outcomeClass !== 'PARTIAL') return 'ERR:fn:relay_post:MIXED_requires_PARTIAL_outcome_class';
    if (verdict === 'FAIL' && !['MODEL_FAILED', 'LANE_TIMEOUT'].includes(outcomeClass)) return 'ERR:fn:relay_post:FAIL_requires_MODEL_FAILED_or_LANE_TIMEOUT';
    if (!['named', 'incognito'].includes(identityMode)) return 'ERR:fn:relay_post:identity_mode_must_be_named_or_incognito';
    if (!modelName || !modelProvider || !modelVersion || !sessionLabel || !action || !resultSummary || !auditHow) return 'ERR:fn:relay_post:model_name_provider_version_session_label_action_result_summary_and_audit_how_required';
    if (!proofLinks.length) return 'ERR:fn:relay_post:at_least_one_public_https_proof_link_required';
    if ([platformCopy.linkedin, platformCopy.facebook, platformCopy.instagram, platformCopy.x].some((value) => !value)) return 'ERR:fn:relay_post:platform_copy_requires_linkedin_facebook_instagram_and_x';
    if (!tagTargets.length) return 'ERR:fn:relay_post:at_least_one_tag_target_with_name_and_why_required';
    for (const [copyPlatform, copy] of Object.entries(platformCopy)) {
      if (!copy) continue;
      const copyCheck = validateModelSocialCopy(copy, {
        surface: sessionLabel,
        model: modelName,
        incognito: identityMode === 'incognito',
      });
      if (!copyCheck.ok) return 'ERR:fn:relay_post:platform_copy_' + copyPlatform + ':' + copyCheck.reason;
    }

    const latest = await env.DB.prepare(
      'SELECT id,seq,post_hash FROM relay_social_posts ORDER BY seq DESC LIMIT 1'
    ).first();
    const expectedPrior = latest ? String(latest.post_hash) : 'genesis';
    if (priorPostHash !== expectedPrior) {
      return 'ERR:fn:relay_post:' + JSON.stringify({
        error: 'relay_head_moved',
        expected_prior_post_hash: expectedPrior,
        received_prior_post_hash: priorPostHash || null,
        read_current_chain: 'https://miscsubjects.com/api/relay',
      });
    }
    if ((latest?.id || null) !== parentPostId) {
      return 'ERR:fn:relay_post:' + JSON.stringify({
        error: 'relay_parent_moved',
        expected_parent_post_id: latest?.id || null,
        received_parent_post_id: parentPostId,
        read_current_chain: 'https://miscsubjects.com/api/relay?social=1',
      });
    }

    const seq = Number(latest?.seq || 0) + 1;
    const createdAt = buildNowIso();
    const ctx = env.TRACE_CTX || {};
    const actor = relayText(ctx.actor || input.actor || modelName, 200);
    const appendInvocationId = relayText(ctx.authContext?.invocation_id, 120) || null;
    const capabilityFingerprint = actor.startsWith('cap:') ? actor.slice(4) : null;
    const modelAttestation = {
      schema: 'oip-model-attestation/v1',
      identity_mode: identityMode,
      model_name: modelName,
      model_provider: modelProvider,
      model_version: modelVersion,
      session_label: sessionLabel || null,
      capability_fingerprint: capabilityFingerprint,
      disclosure: identityMode === 'incognito'
        ? 'The human account identity is undisclosed. Model, provider, version, capability fingerprint and receipts remain public.'
        : 'The model signs with its public display identity, provider, version, capability fingerprint and receipts.',
      statement: 'This model attests that the record describes its observed actions and separates model failure from lane timeout.',
      attested_at: createdAt,
    };
    const packetHash = await relaySha256(JSON.stringify({
      schema: 'relay-social-proof/v3',
      model_name: modelName,
      model_provider: modelProvider,
      model_version: modelVersion,
      identity_mode: identityMode,
      session_label: sessionLabel,
      action,
      result_summary: resultSummary,
      verdict,
      outcome_class: outcomeClass,
      proof_links: proofLinks,
      media_links: mediaLinks,
      tag_targets: tagTargets,
      publication_results: publicationResults,
      parent_post_id: parentPostId,
    }));
    const canonical = JSON.stringify({
      schema: 'relay-social-proof/v3',
      seq,
      created_at: createdAt,
      platform,
      model_name: modelName,
      model_provider: modelProvider,
      model_version: modelVersion,
      identity_mode: identityMode,
      session_label: sessionLabel,
      action,
      result_summary: resultSummary,
      verdict,
      outcome_class: outcomeClass,
      proof_links: proofLinks,
      media_links: mediaLinks,
      platform_copy: platformCopy,
      tag_targets: tagTargets,
      publication_results: publicationResults,
      model_attestation: modelAttestation,
      audit_how: auditHow,
      parent_post_id: parentPostId,
      prior_post_hash: priorPostHash,
      packet_hash: packetHash,
      actor,
      append_invocation_id: appendInvocationId,
    });
    const postHash = await relaySha256(canonical);
    const id = 'rsp_' + String(seq).padStart(6, '0') + '_' + postHash.slice(0, 12);

    try {
      await env.DB.prepare(
        `INSERT INTO relay_social_posts
        (id,seq,created_at,platform,model_name,model_provider,model_version,action,result_summary,verdict,
         proof_links_json,media_links_json,platform_copy_json,audit_how,prior_post_hash,packet_hash,post_hash,actor,append_invocation_id,
         schema_version,identity_mode,session_label,tag_targets_json,publication_results_json,model_attestation_json,parent_post_id,outcome_class)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        id, seq, createdAt, platform, modelName, modelProvider, modelVersion, action, resultSummary, verdict,
        JSON.stringify(proofLinks), JSON.stringify(mediaLinks), JSON.stringify(platformCopy), auditHow,
        priorPostHash, packetHash, postHash, actor, appendInvocationId,
        'relay-social-proof/v3', identityMode, sessionLabel || null, JSON.stringify(tagTargets),
        JSON.stringify(publicationResults), JSON.stringify(modelAttestation), parentPostId, outcomeClass,
      ).run();
    } catch (error) {
      const moved = await env.DB.prepare('SELECT seq,post_hash FROM relay_social_posts ORDER BY seq DESC LIMIT 1').first();
      return 'ERR:fn:relay_post:' + JSON.stringify({
        error: 'append_failed_or_head_moved',
        detail: relayText(error?.message || error, 500),
        current_seq: moved?.seq || 0,
        current_head: moved?.post_hash || 'genesis',
      });
    }

    return JSON.stringify({
      ok: true,
      protocol: 'relay-social-proof/v3',
      schema: 'relay-social-proof/v3',
      post_id: id,
      seq,
      verdict,
      outcome_class: outcomeClass,
      model_name: modelName,
      model_attestation: modelAttestation,
      tag_targets: tagTargets,
      publication_results: publicationResults,
      parent_post_id: parentPostId,
      created_at: createdAt,
      packet_hash: packetHash,
      prior_post_hash: priorPostHash,
      post_hash: postHash,
      append_invocation_id: appendInvocationId,
      public_url: 'https://miscsubjects.com/relay/post/' + id,
      public_receipt_url: appendInvocationId ? 'https://miscsubjects.com/receipt/' + appendInvocationId : null,
      machine_url: 'https://miscsubjects.com/api/relay?post=' + id,
      confirm_url: appendInvocationId ? 'https://miscsubjects.com/api/dispatch?confirm=' + appendInvocationId : null,
      next_model: {
        read: 'https://miscsubjects.com/api/relay?social=1',
        parent_post_id: id,
        prior_post_hash: postHash,
        append_with: 'RELAY_POST_APPEND',
      },
    });
  },
  // OIP tails — the paper and the repository are live objects. arxivGrow is the only
  // writer of the generated files; arxivState/githubTail are the read views.
  async arxivGrow(env) {
    const ctx = env.TRACE_CTX || {};
    const trace = String((ctx && ctx.trace) || 't_unknown');
    const live = await tailLiveCounts(env);
    const tpl = await tailReadFile(env, 'paper/template.tex');
    if (tpl.err || tpl.missing) return tpl.err || 'ERR:fn:arxiv:template_missing';
    const ringsFile = await tailReadFile(env, 'paper/rings.json');
    if (ringsFile.err) return ringsFile.err;
    let rings = [];
    try { rings = JSON.parse(ringsFile.missing ? '[]' : ringsFile.text) || []; } catch { rings = []; }
    const ts = buildNowIso().replace('T', ' ').replace(/\.\d+Z$/, ' UTC').replace('Z', ' UTC');
    const stText = live.selftest ? live.selftest.passed + '/' + live.selftest.total + ' (' + live.selftest.score + ')' : 'UNKNOWN';
    const ring = {
      n: rings.length + 1, ts, trace,
      objects: live.objects, invocations: live.invocations, capabilities: live.capabilities,
      selftest_score: stText, selftest_run: live.selftest ? live.selftest.run_id : 'UNKNOWN',
    };
    rings.push(ring);
    const contracts = {};
    for (const k of ['ARXIV_PAPER', 'ARXIV_GROW', 'GITHUB_TAIL']) {
      const row = await env.DB.prepare('SELECT content FROM directory WHERE key=?1').bind(k).first();
      contracts[k] = row ? String(row.content) : 'ERR:row_missing:' + k;
    }
    const ringsTable = rings.map((r) =>
      r.n + ' & ' + r.ts + ' & \\texttt{' + tailLatexEscape(r.trace) + '} & ' + r.objects + ' & ' + r.invocations + ' & ' + r.capabilities + ' & ' + tailLatexEscape(r.selftest_score) + ' \\\\'
    ).join('\n');
    let tex = tpl.text;
    const subs = {
      OIP_VERSION: '0.3', GENERATED_AT: ts, RING_N: String(ring.n), NEXT_RING_N: String(ring.n + 1),
      TRACE_ID: tailLatexEscape(trace), OBJECT_COUNT: String(live.objects),
      INVOCATION_COUNT: String(live.invocations), CAP_COUNT: String(live.capabilities),
      SELFTEST_SCORE: tailLatexEscape(stText), SELFTEST_RUN: tailLatexEscape(ring.selftest_run),
      RINGS_TABLE: ringsTable,
      ARXIV_PAPER_CONTRACT: contracts.ARXIV_PAPER, ARXIV_GROW_CONTRACT: contracts.ARXIV_GROW,
      GITHUB_TAIL_CONTRACT: contracts.GITHUB_TAIL,
    };
    for (const [k, v] of Object.entries(subs)) tex = tex.split('@@' + k + '@@').join(v);
    const readFor = async (p) => { const f = await tailReadFile(env, p); return f.missing ? undefined : f.sha; };
    const writes = [];
    const w1 = await tailWriteFile(env, 'paper/rings.json', JSON.stringify(rings, null, 2) + '\n', 'grow: ring ' + ring.n + ' ledger (' + trace + ') [skip ci]', ringsFile.missing ? undefined : ringsFile.sha);
    writes.push({ file: 'paper/rings.json', ...w1 });
    const w2 = await tailWriteFile(env, 'oip.json', JSON.stringify({ object: 'GITHUB_TAIL', oip_version: '0.3', generated_at: ts, trace, live, rings }, null, 2) + '\n', 'grow: ring ' + ring.n + ' snapshot (' + trace + ') [skip ci]', await readFor('oip.json'));
    writes.push({ file: 'oip.json', ...w2 });
    const w3 = await tailWriteFile(env, 'README.md', tailRenderReadme(live, ring, rings.length), 'grow: ring ' + ring.n + ' readme (' + trace + ') [skip ci]', await readFor('README.md'));
    writes.push({ file: 'README.md', ...w3 });
    const w4 = await tailWriteFile(env, 'paper/paper.tex', tex, 'grow: ring ' + ring.n + ' — objects ' + live.objects + ', invocations ' + live.invocations + ' (' + trace + ')', await readFor('paper/paper.tex'));
    writes.push({ file: 'paper/paper.tex', ...w4 });
    const failed = writes.filter((w) => !w.ok);
    if (failed.length) return 'ERR:fn:arxiv_grow:' + JSON.stringify(failed).slice(0, 500);
    return JSON.stringify({ ok: true, ring: ring.n, trace, objects: live.objects, invocations: live.invocations, capabilities: live.capabilities, selftest: stText, paper_commit: w4.commit, repo: 'https://github.com/[OWNER_HANDLE]/oip', pdf: 'paper/paper.pdf compiled by CI on this push' });
  },
  async arxivState(env) {
    const live = await tailLiveCounts(env);
    const ringsFile = await tailReadFile(env, 'paper/rings.json');
    let rings = [];
    try { rings = JSON.parse((ringsFile && ringsFile.text) || '[]') || []; } catch {}
    const commits = await githubTailApi(env, '/commits?per_page=1');
    const c = (!commits.err && Array.isArray(commits.json) && commits.json[0]) || null;
    const last = rings.length ? rings[rings.length - 1] : null;
    return JSON.stringify({
      object: 'ARXIV_PAPER', title: 'The Document Is the Receipt', rings: rings.length,
      latest_ring: last, live,
      drift_since_last_ring: last ? { objects: live.objects - last.objects, invocations: live.invocations - last.invocations, capabilities: live.capabilities - last.capabilities } : null,
      latest_commit: c ? { sha: c.sha, message: c.commit.message, date: c.commit.committer.date } : null,
      repo: 'https://github.com/[OWNER_HANDLE]/oip', grow_with: 'ARXIV_GROW',
    });
  },
  async githubTail(env) {
    const meta = await githubTailApi(env, '');
    if (meta.err) return meta.err;
    const root = await githubTailApi(env, '/contents/');
    const files = (!root.err && Array.isArray(root.json)) ? root.json.map((f) => f.path + (f.type === 'dir' ? '/' : '')) : [];
    const commits = await githubTailApi(env, '/commits?per_page=3');
    const recent = (!commits.err && Array.isArray(commits.json)) ? commits.json.map((x) => ({ sha: x.sha.slice(0, 10), message: x.commit.message.split('\n')[0], date: x.commit.committer.date })) : [];
    return JSON.stringify({
      object: 'GITHUB_TAIL', repo: meta.json.full_name, private: meta.json.private,
      default_branch: meta.json.default_branch, pushed_at: meta.json.pushed_at,
      url: meta.json.html_url, files, recent_commits: recent,
      note: 'every content commit is protocol-authored; the trace id in each message resolves to a ledger receipt',
    });
  },
  // META (ads) — read-only, via the loop-meta-bridge service binding. The bridge owns
  // the shared Meta token (Secrets Store, by reference); this build never holds the token
  // and never spends. metaAccounts lists live ad accounts + upserts them into meta_ad_accounts
  // so the marketing surface + Site Sync stay current. metaInsights returns per-account
  // performance (spend/roas/clicks) for a date preset. NEVER a write to Meta.
  async metaAccounts(env) {
    if (!env.META_BRIDGE) return JSON.stringify({ error: 'META_BRIDGE service binding not present — deploy workers/meta-bridge and bind it' });
    const r = await env.META_BRIDGE.fetch('https://bridge/accounts');
    const j = await r.json();
    if (!r.ok || j.error) return JSON.stringify({ error: 'meta_bridge_error', status: r.status, detail: j });
    const accounts = j.accounts || [];
    let upserted = 0;
    for (const a of accounts) {
      const accId = String(a.account_id || (a.id || '').replace(/^act_/, ''));
      if (!accId) continue;
      await env.DB.prepare(
        "INSERT INTO meta_ad_accounts (account_id,name,status,currency,synced_at) VALUES (?,?,?,?,datetime('now')) " +
        "ON CONFLICT(account_id) DO UPDATE SET name=excluded.name, status=excluded.status, currency=excluded.currency, synced_at=datetime('now')"
      ).bind(accId, String(a.name || ''), Number(a.account_status || 0), String(a.currency || '')).run();
      upserted++;
    }
    return JSON.stringify({ source: j.source, count: accounts.length, upserted_into_meta_ad_accounts: upserted, accounts });
  },
  async metaInsights(env, presetArg, accountsArg) {
    if (!env.META_BRIDGE) return JSON.stringify({ error: 'META_BRIDGE service binding not present — deploy workers/meta-bridge and bind it' });
    const preset = String(presetArg || 'last_7d').trim();
    const accounts = String(accountsArg || '').trim();
    const q = new URLSearchParams({ preset, level: 'account' });
    if (accounts) q.set('accounts', accounts);
    const r = await env.META_BRIDGE.fetch('https://bridge/insights?' + q.toString());
    const j = await r.json();
    if (!r.ok || j.error) return JSON.stringify({ error: 'meta_bridge_error', status: r.status, detail: j });
    return JSON.stringify(j);
  },
  async metaHealth(env) {
    if (!env.META_BRIDGE) return JSON.stringify({ error: 'META_BRIDGE service binding not present' });
    const r = await env.META_BRIDGE.fetch('https://bridge/health');
    return JSON.stringify(await r.json());
  },
  // GOVERNOR — build manager: digest the last window of ledger turns, model writes the
  // brief, email + iMessage to the owner, everything ledgered. arg: '' = full run, 'dry' = digest only.
  async governorRun(env, mode) {
    const { governorRun } = await import('../_lib/governor.js');
    return governorRun(env, mode);
  },
  // Ask the GOVERNOR a question in natural language — answers from the live digest +
  // recurrence memory + charter, sized for an iMessage reply.
  async governorAsk(env, question) {
    const { governorAsk } = await import('../_lib/governor.js');
    return governorAsk(env, question);
  },
  // Fire the server-side half of QUADSYNC now: ledger→GitHub mirror + GitHub→ledger fold.
  async quadsyncRun(env) {
    const { ledgerGithubSync, githubLedgerSync, syncHealth } = await import('../_lib/ledger_sync.js');
    const out = await ledgerGithubSync(env);
    const infold = await githubLedgerSync(env);
    const corners = await syncHealth(env);
    return JSON.stringify({ out, in: infold, corners }, null, 1);
  },
  // Unified outstanding sync: open GitHub issues, open/running tasks, Kimi CLI/Desktop
  // turn state, and recurring historical problem classes -> email + short iMessage notice.
  async outstandingSync(env, mode) {
    const { sendOutstandingSync } = await import('../_lib/outstanding_sync.js');
    return sendOutstandingSync(env, mode);
  },
  // THE PROSECUTOR — a machine runs the operator loop end to end with no human transport:
  // reads the live thread-state + the drop, asks a model for NEW LOAD only (inheriting all
  // accepted state), and posts material output back onto the bus as a proposed update.
  async prosecutorRun(env, modelKey) {
    const state = await fetch('https://miscsubjects.com/api/protocol/thread-state?target=oip&format=markdown').then((r) => r.text()).catch(() => '');
    const drop = await fetch('https://miscsubjects.com/api/articles/oip-total-structure/drop').then((r) => r.text()).catch(() => '');
    const key = String(modelKey || 'ASK_CLAUDE').toUpperCase() || 'ASK_CLAUDE';
    const prompt = 'You are one machine in the OIP operator loop. Below are the protocol drop and the CURRENT accepted thread-state (the compiled cross-model memory). Inherit it: do not repeat anything already accepted. Contribute exactly ONE materially new point — an attack, a patch, a proof gap, or a missing thread — in 2-4 plain sentences. If you have nothing new, reply exactly NOTHING NEW.\n\n=== DROP ===\n' + drop.slice(0, 6000) + '\n\n=== ACCEPTED THREAD-STATE ===\n' + state.slice(0, 8000);
    const out = await dispatch(env, key, prompt, { actor: 'prosecutor:' + key });
    const text = String(out?.result || '').trim();
    if (!text || /^NOTHING NEW/i.test(text) || /^(ERR|PROVIDER_ERROR)/.test(text)) {
      return JSON.stringify({ ok: true, model: key, posted: false, reply: text.slice(0, 200) || '(empty)' });
    }
    const post = await fetch('https://miscsubjects.com/api/protocol/thread-update', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'prosecutor:' + key.toLowerCase(), target: 'oip', source_kind: 'model_turn', raw_text: text.slice(0, 4000) }),
    }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    return JSON.stringify({ ok: true, model: key, posted: !!post.ok, bus: post }, null, 1);
  },
  // Objection ledger intake: log an objection (and optionally its settled answer) against
  // an article. Ledgered as an event; rendered on the page, the JSON, and the bundle.
  // OBJECTION_LOG (extended per owner ship-order 2026-07-16 W12+W17 §1/§5 — same verb, never
  // a fork): accepts the legacy pipe shape slug|objection|answer|model AND a structured JSON
  // first arg {slug, target_div?, stance?, body, answer?, claimed_model?, duplicate_of?}.
  // New objections pass the duplicate gate; every accept folds into the discourse index and
  // returns the clickable human permalink (/a/<slug>#disc-obj-<id>).
  async objectionLog(env, slug, objection, answer, actor) {
    let s, obj, ans, who, targetDiv = null, stance = 'challenge', dupOf = null, repairs = null;
    const first = String(slug || '').trim();
    if (first.startsWith('{')) {
      let j = {};
      try { j = JSON.parse(first) || {}; } catch { return 'ERR:objection:bad_json_shape'; }
      s = String(j.slug || '').trim();
      obj = String(j.body || j.objection || '').trim().slice(0, 4000);
      ans = String(j.answer || '').trim().slice(0, 4000) || null;
      who = String(j.claimed_model || j.actor || 'anonymous').trim().slice(0, 120);
      targetDiv = String(j.target_div || '').trim().slice(0, 40) || null;
      stance = ['challenge', 'support', 'upgrade'].includes(String(j.stance || '').toLowerCase()) ? String(j.stance).toLowerCase() : 'challenge';
      dupOf = String(j.duplicate_of || '').trim() || null;
      repairs = String(j.repairs || j.answer_of || '').trim() || null;
    } else {
      s = first;
      obj = String(objection || '').trim().slice(0, 4000);
      ans = String(answer || '').trim().slice(0, 4000) || null;
      who = String(actor || 'anonymous').trim().slice(0, 120);
    }
    if (!s || !obj) return 'ERR:objection:slug_and_objection_required';
    const { recordDiscourse, findDuplicate, bumpIndependentlyRaised } = await import('../_lib/discourse_widgets.js');
    // A repair is an append, not a duplicate filing. It points to the standing objection,
    // bypasses similarity rejection, preserves the original row and adds linked discourse.
    if (repairs) {
      const repairId = repairs.replace(/^obj-/, '');
      const target = await env.DB.prepare('SELECT id,slug,objection,status FROM oip_objections WHERE id=?').bind(repairId).first();
      if (!target) return 'ERR:objection:repair_target_not_found';
      if (String(target.slug) !== s) return 'ERR:objection:repair_slug_mismatch';
      if (!ans && stance !== 'upgrade') return 'ERR:objection:repair_requires_answer_or_upgrade_stance';
      // An owned receipt is authority to repair, not an unlimited write budget. Bound
      // repeated repairs per canonical target and asserted actor without weakening the
      // append-only lineage or turning repair into an owner-only path.
      if (env.KV) {
        const hour = new Date().toISOString().slice(0, 13);
        const actorHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(who));
        const actorKey = Array.from(new Uint8Array(actorHash), (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16);
        const rateKey = `objection-repair-rate:${hour}:${repairId}:${actorKey}`;
        const repairCount = Number(await env.KV.get(rateKey) || 0);
        if (repairCount >= 3) return 'ERR:objection:repair_rate_limited:3_per_target_actor_utc_hour';
        await env.KV.put(rateKey, String(repairCount + 1), { expirationTtl: 7200 });
      }
      const repairDiscId = 'repair-' + repairId + '-' + Math.random().toString(36).slice(2, 10);
      await recordDiscourse(env, {
        id: repairDiscId, slug: s, target_div: targetDiv, claimed_model: who,
        stance: 'upgrade', body: obj, status: ans ? 'answered' : 'open', answer: ans,
        answered_by: ans ? who : null, source_ref: 'repairs:obj-' + repairId,
        canonical_of: 'obj-' + repairId,
      });
      if (ans) {
        await env.DB.prepare("UPDATE oip_objections SET answer=?, answered_by=?, status='settled', answered_at=datetime('now') WHERE id=?")
          .bind(ans, who, repairId).run();
        try { await env.DB.prepare("UPDATE discourse SET status='answered', answer=?, answered_by=? WHERE id=?").bind(ans, who, 'obj-' + repairId).run(); } catch {}
      }
      const { logEvent } = await import('../_lib/event_log.js');
      await logEvent(env, {
        source: 'objections', key: 'OBJECTION_LOG', action: 'objection_repair', direction: 'in', status: 200, actor: who,
        request: { slug: s, repairs: 'obj-' + repairId, target_div: targetDiv, body: obj, answer: ans },
        response: { repair_discourse_id: repairDiscId, canonical_objection_id: repairId },
      });
      const link = 'https://miscsubjects.com/a/' + s + '#disc-' + repairDiscId;
      return JSON.stringify({ ok: true, repaired: 'obj-' + repairId, repair_discourse_id: repairDiscId, link, say_to_user: 'Repair appended without erasing the original. Here is the link: ' + link });
    }
    // Confirmed duplicate: measurement, not noise.
    if (dupOf) {
      await bumpIndependentlyRaised(env, dupOf, { id: 'dup-' + Math.random().toString(36).slice(2, 10), slug: s, target_div: targetDiv, claimed_model: who, stance, body: obj });
      const link0 = 'https://miscsubjects.com/a/' + s + '#disc-' + dupOf;
      return JSON.stringify({ ok: true, duplicate_confirmed: dupOf, link: link0, say_to_user: 'Confirmed as an independent raise of the standing objection. Here is the link: ' + link0 });
    }
    // Same objection text on the same slug: answering an open one settles it.
    const existing = await env.DB.prepare(
      'SELECT id, status FROM oip_objections WHERE slug=? AND objection=? ORDER BY id DESC LIMIT 1'
    ).bind(s, obj).first();
    // Duplicate gate for genuinely NEW filings (near-match, not exact): educate, point at the canonical entry.
    if (!existing && !ans) {
      const dup = await findDuplicate(env, s, obj);
      if (dup) {
        return JSON.stringify({
          error: 'duplicate_match', ...dup,
          how_to_proceed: 'If this IS the same objection, re-send with the structured shape {"slug":"' + s + '","duplicate_of":"' + dup.obj_id + '","body":"..."} — the canonical entry\'s independently_raised counter increments. If genuinely different, sharpen what distinguishes it and re-file.',
        });
      }
    }
    let id, status;
    if (existing && ans) {
      await env.DB.prepare(
        "UPDATE oip_objections SET answer=?, answered_by=?, status='settled', answered_at=datetime('now') WHERE id=?"
      ).bind(ans, who, existing.id).run();
      id = existing.id; status = 'settled';
      try { await env.DB.prepare("UPDATE discourse SET status='answered', answer=?, answered_by=? WHERE id=?").bind(ans, who, 'obj-' + id).run(); } catch { /* index catches up on backfill */ }
    } else if (existing) {
      id = existing.id; status = existing.status;
    } else {
      const r = await env.DB.prepare(
        "INSERT INTO oip_objections (slug, objection, answer, actor, answered_by, status, answered_at) VALUES (?,?,?,?,?,?,?)"
      ).bind(s, (targetDiv ? '[' + targetDiv + '] ' : '') + obj, ans, who, ans ? who : null, ans ? 'settled' : 'open', ans ? new Date().toISOString() : null).run();
      id = r.meta.last_row_id; status = ans ? 'settled' : 'open';
    }
    await recordDiscourse(env, {
      id: 'obj-' + id, slug: s, target_div: targetDiv, claimed_model: who,
      stance, body: obj, status: status === 'settled' ? 'answered' : 'open',
      answer: ans, answered_by: ans ? who : null, source_ref: 'oip_objections:' + id,
    });
    const { logEvent } = await import('../_lib/event_log.js');
    await logEvent(env, {
      source: 'objections', key: 'OBJECTION_LOG', action: ans ? 'objection_settled' : 'objection_open',
      direction: 'in', status: 200, actor: who,
      request: { slug: s, target_div: targetDiv, stance, objection: obj, answer: ans }, response: { id, status },
    });
    const link = 'https://miscsubjects.com/a/' + s + '#disc-obj-' + id;
    return JSON.stringify({
      ok: true, id, slug: s, status, link,
      say_to_user: 'Filed and live. Here is the link: ' + link,
      view: 'https://miscsubjects.com/a/' + s, json: 'https://miscsubjects.com/api/articles/' + s + '/objections',
    });
  },
  async deployLease(env, op, holder, nonceArg) {
    if (!env.KV) return 'ERR:deploy_lease:no_kv';
    const key = 'locks:deploy:loop-safe-miscsubjects';
    const action = String(op || 'check').toLowerCase();
    const holderName = String(holder || env.TRACE_CTX?.actor || 'unknown').slice(0, 160);
    const currentRaw = await env.KV.get(key);
    let current = null;
    try { current = JSON.parse(currentRaw || 'null'); } catch {}
    if (action === 'check') return JSON.stringify({ ok: true, held: !!current, lease: current });
    if (action === 'acquire') {
      if (current && Date.parse(current.expires_at || 0) > Date.now()) return 'ERR:deploy_lease:held:' + JSON.stringify(current);
      const nonce = crypto.randomUUID();
      const lease = { nonce, holder: holderName, acquired_at: new Date().toISOString(), expires_at: new Date(Date.now() + 1800_000).toISOString() };
      await env.KV.put(key, JSON.stringify(lease), { expirationTtl: 1800 });
      const nonceDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
      const nonceFingerprint = Array.from(new Uint8Array(nonceDigest), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
      const { logEvent } = await import('../_lib/event_log.js');
      await logEvent(env, { source: 'deploy-lease', key: 'DEPLOY_LEASE', action: 'acquire', direction: 'in', status: 200, actor: holderName, response: { holder: lease.holder, acquired_at: lease.acquired_at, expires_at: lease.expires_at, nonce_fingerprint: nonceFingerprint } });
      return JSON.stringify({ ok: true, acquired: true, lease });
    }
    if (action === 'release') {
      if (!current) return JSON.stringify({ ok: true, skipped: true, reason: 'not_held' });
      if (!nonceArg || String(nonceArg) !== String(current.nonce)) return 'ERR:deploy_lease:nonce_mismatch';
      await env.KV.delete(key);
      const { logEvent } = await import('../_lib/event_log.js');
      await logEvent(env, { source: 'deploy-lease', key: 'DEPLOY_LEASE', action: 'release', direction: 'in', status: 200, actor: holderName, response: { released: true } });
      return JSON.stringify({ ok: true, released: true });
    }
    return 'ERR:deploy_lease:unknown_op';
  },
  // Advisory write-locks for coding agents: claim a file before editing, release after.
  // op: claim | release | check | list · holder = agent:session · ttl default 90 min.
  async fileClaim(env, op, path, holder, ttlMins) {
    if (!env.KV) return 'ERR:fileClaim:no_kv';
    const o = String(op || 'check').toLowerCase();
    const p = String(path || '').trim();
    const who = String(holder || 'unknown').trim();
    const ttl = Math.min(Math.max(parseInt(ttlMins || '90', 10) || 90, 5), 480) * 60;
    if (o === 'list') {
      const l = await env.KV.list({ prefix: 'fclaim:' });
      const rows = [];
      for (const k of l.keys) { const v = await env.KV.get(k.name); rows.push(k.name.slice(7) + ' → ' + v); }
      return rows.length ? rows.join('\n') : 'no active claims';
    }
    if (!p) return 'ERR:fileClaim:path_required';
    const key = 'fclaim:' + p;
    const cur = await env.KV.get(key);
    if (o === 'check') return cur ? 'HELD: ' + cur : 'FREE';
    if (o === 'release') {
      if (cur && !cur.startsWith(who + ' ')) return 'ERR:held_by_other: ' + cur;
      await env.KV.delete(key);
      return 'RELEASED: ' + p;
    }
    if (o === 'claim') {
      if (cur && !cur.startsWith(who + ' ')) return 'DENIED: ' + p + ' held by ' + cur + ' — read the file fresh and coordinate before editing.';
      await env.KV.put(key, who + ' since ' + new Date().toISOString(), { expirationTtl: ttl });
      return 'CLAIMED: ' + p + ' by ' + who + ' for ' + Math.round(ttl / 60) + ' min';
    }
    return 'ERR:fileClaim:unknown_op:' + o;
  },
  async wireUpAndInvoke(env, shortId, triggerPhrase, invokeArgs) {
    const sid = String(shortId || '');
    const trigger = String(triggerPhrase || ('use ' + sid));
    const args = String(invokeArgs == null ? '' : invokeArgs);
    // Step 1: resolve via /api/inventory?short_id=<id>
    const r1 = await fetch('https://miscsubjects.com/api/inventory?short_id=' + encodeURIComponent(sid));
    if (!r1.ok) return 'ERR:fn:short_resolve_failed:' + r1.status + ':' + (await r1.text()).slice(0, 200);
    const row = await r1.json();
    if (!row || !row.name) return 'ERR:fn:short_no_name';
    const name = row.name;
    const kind = row.kind;
    // Step 2: append a wire-up clause to ROUTER's content
    const clause = `U_inline_${name}: WHEN "${trigger}" → [${name}]${args || '<args>'}[/${name}].`;
    const current = await env.DB.prepare('SELECT content FROM directory WHERE key = ?').bind('ROUTER').first();
    const sep = (current?.content && !current.content.endsWith('\n')) ? '\n' : '';
    const newContent = (current?.content || '') + sep + clause;
    const ts = buildNowIso();
    await env.DB.prepare('UPDATE directory SET content = ?, updated_at = ? WHERE key = ?').bind(newContent, ts, 'ROUTER').run();
    if (env.KV) { try { await env.KV.delete('directory:snapshot'); } catch {} }
    const appendResult = { ok: true, old_bytes: (current?.content || '').length, new_bytes: newContent.length, clause };
    // Step 3: invoke the resolved row via /api/dispatch (only when it's actually invokable —
    // i.e. fn/http/flow, never agent because that re-enters this whole chain).
    let invokeKey = null, invokeResult = null;
    if (kind === 'directory') {
      const drow = await env.DB.prepare('SELECT key, type FROM directory WHERE key = ?').bind(name).first();
      if (drow && (drow.type === 'fn' || drow.type === 'http' || drow.type === 'flow')) {
        invokeKey = name;
        const r3 = await fetch('https://miscsubjects.com/api/dispatch', {
          method: 'POST', headers: dispatchHeaders(env),
          body: JSON.stringify({ key: name, body: args }),
        });
        const text3 = await r3.text();
        try { invokeResult = JSON.parse(text3).result || text3; } catch { invokeResult = text3; }
      } else {
        invokeResult = 'SKIPPED (kind=' + (drow?.type || '?') + ' not directly invokable here)';
      }
    } else {
      invokeResult = 'SKIPPED (short_id resolved to a non-directory surface; nothing to invoke)';
    }
    return JSON.stringify({ short_id: sid, name, kind, appended_clause: clause, append_result: appendResult, invoke_key: invokeKey, invoke_result: String(invokeResult).slice(0, 1500) });
  },
  async directoryAppendContent(env, key, addition) {
    const row = await env.DB.prepare('SELECT content FROM directory WHERE key = ?').bind(String(key)).first();
    if (!row) return 'ERR:fn:no_such_key:' + key;
    const add = String(addition == null ? '' : addition);
    const newContent = (row.content || '') + (row.content && !row.content.endsWith('\n') ? '\n' : '') + add;
    const ts = buildNowIso();
    await env.DB.prepare('UPDATE directory SET content = ?, updated_at = ? WHERE key = ?').bind(newContent, ts, String(key)).run();
    if (env.KV) { try { await env.KV.delete('directory:snapshot'); } catch {} }
    return JSON.stringify({ ok: true, key: String(key), old_bytes: (row.content || '').length, new_bytes: newContent.length, appended_head: add.slice(0, 200) });
  },
  // Replace (or, with empty replaceWith, remove) the first occurrence of `find` in a row's
  // content. Powers editing/removing a memory line without rewriting the whole prompt.
  async directoryReplaceContent(env, key, find, replaceWith) {
    const row = await env.DB.prepare('SELECT content FROM directory WHERE key = ?').bind(String(key)).first();
    if (!row) return 'ERR:fn:no_such_key:' + key;
    const cur = String(row.content || '');
    const f = String(find == null ? '' : find);
    if (!f || cur.indexOf(f) === -1) return 'ERR:fn:not_found:' + f.slice(0, 80);
    let next = cur.replace(f, String(replaceWith == null ? '' : replaceWith));
    next = next.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    const ts = buildNowIso();
    await env.DB.prepare('UPDATE directory SET content = ?, updated_at = ? WHERE key = ?').bind(next, ts, String(key)).run();
    if (env.KV) { try { await env.KV.delete('directory:snapshot'); } catch {} }
    return JSON.stringify({ ok: true, key: String(key), old_bytes: cur.length, new_bytes: next.length, removed: !String(replaceWith || '') });
  },
  async sha256Lower(env, s) {
    const enc = new TextEncoder().encode(String(s).toLowerCase().trim());
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  async promptAssemble(env, key) {
    const row = await env.DB.prepare('SELECT key, content, includes FROM directory WHERE key = ?').bind(String(key || 'ROUTER')).first();
    if (!row) return 'ERR:fn:no_such_key:' + key;
    const blockMap = await loadPromptBlockMap(env);
    const assembled = assembleAgentPrompt(row, blockMap, '');
    return JSON.stringify({
      ok: true,
      key: String(row.key),
      includes: parseIncludes(row),
      bytes: assembled.length,
      has_blocks: parseIncludes(row).filter((k) => blockMap[k]).length,
      head: assembled.slice(0, 1200),
    });
  },
  noop(env, s) { return String(s || ''); },
  upper(env, s) { return String(s || '').toUpperCase(); },
  lower(env, s) { return String(s || '').toLowerCase(); },
  now() {
    // BUILD LAW — TIME: the canonical clock object, Pacific, server-sourced.
    const iso = buildNowIso();
    return JSON.stringify({ now: iso, today: iso.slice(0, 10), time: iso.slice(11, 19), zone: "America/Los_Angeles", iso });
  },
  // TRAILS (OIP v0.8.1, Bush/Engelbart): a named, authority-preserving sequence of past
  // invocations. Recorded input resolves the same way POST {replay} does, but saving requires
  // receipt ownership/scope and every replayed step re-runs the current caller's full gates.
  async trailSave(env, name, ids) {
    const nm = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    if (!nm) return 'ERR:trail:name_required';
    if (!env.KV) return 'ERR:trail:no_kv';
    const list = String(ids || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length < 2 || list.length > 20) return 'ERR:trail:need_2_to_20_receipt_ids';
    const steps = [];
    let namespace = null;
    const dir = await loadDirectory(env);
    for (const id of list) {
      const rec = await getInvocation(env, id);
      if (!rec) return 'ERR:trail:unknown_invocation:' + id;
      if (String(rec.object_id || '').startsWith('TRAIL_')) return 'ERR:trail:no_recursion:' + id + ' is a TRAIL_ step';
      const authz = await authorizeCompositeReceipt(env, rec, env.TRACE_CTX?.authContext);
      if (!authz.ok) return 'ERR:trail:receipt_denied:' + id + ':' + authz.reason;
      if (namespace == null) namespace = authz.namespace;
      if (namespace !== authz.namespace) return 'ERR:trail:mixed_authority_namespaces';
      let input = null;
      if (rec.event_id) {
        try { const ev = await readEventFull(env, rec.event_id); if (ev && ev.request_json != null) input = String(ev.request_json); } catch {}
      }
      if (input == null) {
        try { input = JSON.parse(rec.invocation_json || 'null')?.input_preview ?? ''; } catch { input = ''; }
      }
      steps.push({ inv: id, key: rec.object_id, input, risk: Number(dir[rec.object_id]?.sensitive) ? 'high' : 'low' });
    }
    const maxRisk = steps.some((s) => s.risk === 'high') ? 'high' : 'low';
    await env.KV.put('trail:' + namespace + ':' + nm, JSON.stringify({ name: nm, namespace, steps, risk: maxRisk, created: buildNowIso() }));
    return JSON.stringify({ ok: true, trail: nm, namespace, risk: maxRisk, steps: steps.map((s) => ({ inv: s.inv, key: s.key, risk: s.risk })), run: '[TRAIL_RUN]' + nm + '[/TRAIL_RUN]' });
  },
  async trailRun(env, name) {
    const nm = String(name || '').trim().toLowerCase();
    if (!nm) return 'ERR:trail:name_required';
    if (!env.KV) return 'ERR:trail:no_kv';
    const auth = env.TRACE_CTX?.authContext || null;
    let namespace = null;
    if (auth?.ownerAuthed) namespace = 'owner';
    else {
      const cap = auth?.capFingerprint ? await getCapabilityByFingerprint(env, auth.capFingerprint) : null;
      if (!cap) return 'ERR:trail:nested_authority_missing';
      const chain = await capabilityChainStatus(env, cap);
      if (!chain.ok) return 'ERR:trail:' + chain.reason;
      namespace = cap.tenant_id ? 'tenant:' + cap.tenant_id : 'tree:' + chain.chain[chain.chain.length - 1].fingerprint;
    }
    let trail = await env.KV.get('trail:' + namespace + ':' + nm, 'json');
    // v0.8 compatibility: only the owner may adopt an unscoped legacy trail.
    if (!trail && auth?.ownerAuthed) trail = await env.KV.get('trail:' + nm, 'json');
    if (!trail) return 'ERR:trail:not_found:' + nm;
    const dir = await loadDirectory(env);
    const out = [];
    for (const step of (trail.steps || []).slice(0, 20)) {
      if (String(step.key || '').startsWith('TRAIL_')) {
        out.push({ step: out.length + 1, key: step.key, ok: false, stopped: 'no_recursion' });
        break;
      }
      const r = await dispatchNestedAuthorized(env, step.key, step.input || '', auth);
      if (r.denied) {
        out.push({ step: out.length + 1, key: step.key, ok: false, stopped: r.reason, status: r.status });
        break;
      }
      const row = dir[step.key] || { key: step.key };
      const wrapped = await wrapDispatchResponse(r, row, step.key, { actor: r.nested_actor, input: step.input || '', replay_of: step.inv, auth: r.nested_auth });
      if (!r.noLog) {
        if (wrapped.invocation && r.event_id) wrapped.invocation.event_id = r.event_id;
        await logInvocation(env, { trace_id: r.trace, object_id: step.key, row, actor: r.nested_actor, input: step.input, result: r.result, cost_usd: r.cost, event_id: r.event_id, invocation: wrapped.invocation });
      }
      out.push({ step: out.length + 1, key: step.key, ok: wrapped.ok, invocation: wrapped.invocation.id, replay_of: step.inv, receipt: wrapped.invocation.links.receipt, result_preview: String(r.result == null ? '' : r.result).slice(0, 160) });
      if (!wrapped.ok) break;
    }
    return JSON.stringify({ ok: out.length === (trail.steps || []).length && out.every((s) => s.ok), trail: nm, namespace, risk: trail.risk || 'unknown', stop_on_failure: true, steps: out });
  },
  async trailList(env) {
    if (!env.KV) return 'ERR:trail:no_kv';
    const auth = env.TRACE_CTX?.authContext || null;
    let namespace = null;
    if (auth?.ownerAuthed) namespace = 'owner';
    else {
      const cap = auth?.capFingerprint ? await getCapabilityByFingerprint(env, auth.capFingerprint) : null;
      if (!cap) return 'ERR:trail:nested_authority_missing';
      const chain = await capabilityChainStatus(env, cap);
      if (!chain.ok) return 'ERR:trail:' + chain.reason;
      namespace = cap.tenant_id ? 'tenant:' + cap.tenant_id : 'tree:' + chain.chain[chain.chain.length - 1].fingerprint;
    }
    const l = await env.KV.list({ prefix: 'trail:' + namespace + ':' });
    const out = [];
    for (const k of (l.keys || []).slice(0, 100)) {
      const t = await env.KV.get(k.name, 'json');
      if (t) out.push({ trail: t.name, steps: (t.steps || []).length, risk: t.risk || 'unknown', created: t.created, run: '[TRAIL_RUN]' + t.name + '[/TRAIL_RUN]' });
    }
    return JSON.stringify({ ok: true, namespace, count: out.length, trails: out });
  },
  // FED_SEND (OIP v1.1) — the human-facing federation control. Send a signed oip-message/1
  // envelope from the home agent to a remote agent at another domain and return its signed reply.
  //   agent@domain|query|<text>                        — ask a question (runs nothing remotely)
  //   agent@domain|invoke|KEY|<args>|<capability_token> — hand a capability across the federation
  // The recipient's key + inbox resolve from its /.well-known/oip.json; the reply signature is
  // verified before it is trusted. Never logs the raw capability. Owner-authorized restore.
  async fedSend(env, recipient, kindArg, rest) {
    const to = String(recipient || '').trim();
    if (!to.includes('@')) return 'ERR:fed:bad_recipient:need agent@domain';
    const kind = String(kindArg || 'query').trim().toLowerCase();
    if (kind === 'query') {
      const text = String(rest == null ? '' : rest);
      return JSON.stringify(await sendFromHome(env, { to, kind: 'query', body: { text, asked_at: new Date().toISOString() } }));
    }
    if (kind === 'invoke') {
      const parts = String(rest == null ? '' : rest).split('|');
      const key = String(parts[0] || '').trim();
      const args = parts[1] == null ? '' : String(parts[1]);
      const capability = parts.slice(2).join('|').trim() || null;
      if (!key) return 'ERR:fed:invoke_needs_key';
      if (!capability) return 'ERR:fed:invoke_needs_capability:an invoke must carry a capability token as the last field';
      return JSON.stringify(await sendFromHome(env, { to, kind: 'invoke', body: { key, args }, capability }));
    }
    return 'ERR:fed:bad_kind:' + kind + ' (use query or invoke)';
  },
  // MCP_EVAL — try-before-install. Given an integration name, resolve its OIP objects, classify
  // read vs write, run ONE safe read-only trial (real receipt), and recommend connect/skip.
  // Financial integrations (Stripe) run the live read-only trial only with an explicit "live" mode.
  async mcpEval(env, nameArg, modeArg) {
    const B = 'https://miscsubjects.com';
    const name = String(nameArg || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const mode = String(modeArg || '').trim().toLowerCase();
    if (!name) return JSON.stringify({ error: 'integration name required', example: 'stripe | github | context7 | drive | slack | notion' });
    const dir = await loadDirectory(env);
    const PREFIX = { stripe: 'STRIPE_', github: 'GITHUB_', context7: 'MCP_CONTEXT7_', slack: 'SLACK_', notion: 'NOTION_', drive: 'DRIVE_', gdrive: 'DRIVE_' };
    const pfx = PREFIX[name] || (name.toUpperCase() + '_');
    const keys = Object.keys(dir).filter((k) => k.toUpperCase().startsWith(pfx) || k.toUpperCase() === name.toUpperCase());
    if (!keys.length) {
      return JSON.stringify({
        integration: name, connected: false,
        note: 'No ' + name + ' objects are wired in this build yet.',
        what_it_would_do: 'Open MCP_CATALOG to see installable MCP servers and their tools.',
        connect_path: 'MCP_CATALOG (list) then MCP_IMPORT (connect) then MCP_TOOL_CALL (invoke).',
        try: B + '/api/dispatch?invoke=MCP_CATALOG',
        recommend: 'Not connected. List the catalog first, then import if the surface fits the task.',
      });
    }
    const READ = /_GET$|_GET_|_LIST$|_LIST_|_SEARCH|_BALANCE|_STATUS|_INFO|_ACCOUNT|_RESOLVE|_QUERY|_FETCH|_EVENTS|_READ/;
    const WRITE = /_CREATE|_UPDATE|_DELETE|_REFUND|_FINALIZE|_SEND|_MARK|_ATTACH|_IMPORT|_POST|_CANCEL|_VOID|_SYNC|_PUT|_ADD/;
    const read = keys.filter((k) => READ.test(k.toUpperCase()));
    const write = keys.filter((k) => WRITE.test(k.toUpperCase()));
    const FINANCIAL = new Set(['stripe', 'plaid', 'paypal', 'bank']);
    const financial = FINANCIAL.has(name);
    const trialKey = read.find((k) => /ACCOUNT|BALANCE|STATUS/i.test(k)) || read.find((k) => /LIST/i.test(k)) || read[0] || null;
    let tried = null;
    const runLive = trialKey && (!financial || mode === 'live');
    if (runLive) {
      try {
        const r = await fetch(B + '/api/dispatch', { method: 'POST', headers: dispatchHeaders(env), body: JSON.stringify({ key: trialKey, body: '' }) });
        const j = await r.json().catch(() => ({}));
        tried = { key: trialKey, ran: j.ran ?? null, ok: j.proof?.ok ?? null, confirm: j.proof?.confirm || null, receipt: j.proof?.receipt || null, preview: JSON.stringify(j.result ?? '').slice(0, 240) };
      } catch (e) { tried = { key: trialKey, error: String(e && e.message || e) }; }
    } else if (financial && trialKey) {
      tried = { key: trialKey, gated: true, note: 'Financial integration. The read-only trial runs only with mode "live": [MCP_EVAL]' + name + '|live[/MCP_EVAL]. No write object is ever fired.' };
    }
    const recommend = tried && tried.ok
      ? name + ' is connected and working. The read-only trial returned a receipt — you can operate it now.'
      : (financial && !runLive)
        ? name + ' objects are wired (' + read.length + ' read, ' + write.length + ' write). Run the gated live trial to confirm credentials before relying on it.'
        : read.length
          ? name + ' objects are wired. If the trial did not return data, set the credentials, then the read-only trial returns live results.'
          : name + ' has only write objects here; connect and test in a sandbox before use.';
    return JSON.stringify({
      integration: name, connected: true,
      capabilities: { read: read.length, write: write.length, read_only_objects: read.slice(0, 12), write_objects: write.slice(0, 12) },
      safe_trial: tried,
      recommend,
      read_more: B + '/api/dispatch?key=' + encodeURIComponent(trialKey || keys[0]) + '&format=markdown',
      operate: B + '/api/dispatch?invoke=' + encodeURIComponent(trialKey || keys[0]) + '&share=<TOKEN>',
    });
  },
  async tryStripeMcp(env, mode) { return FN_MAP.mcpEval(env, 'stripe', mode); },
  async tryGithubMcp(env) { return FN_MAP.mcpEval(env, 'github'); },
  async invalidateDirSnapshot(env) {
    if (!env.KV) return 'ERR:fn:no_kv';
    await env.KV.delete('directory:snapshot');
    return JSON.stringify({ ok: true, ts: buildNowIso() });
  },
  async aiRun(env, model, prompt) {
    if (!env.AI) return 'ERR:fn:no_ai_binding';
    const messages = [{ role: 'user', content: String(prompt || '') }];
    const r = await env.AI.run(String(model), { messages });
    return JSON.stringify(r);
  },
  async aiEmbed(env, text, model) {
    if (!env.AI) return 'ERR:fn:no_ai_binding';
    const m = String(model || '@cf/baai/bge-base-en-v1.5');
    const r = await env.AI.run(m, { text: [String(text || '')] });
    return JSON.stringify(r);
  },
  async aiTextToImage(env, prompt, model) {
    if (!env.AI) return 'ERR:fn:no_ai_binding';
    const m = String(model || '@cf/stabilityai/stable-diffusion-xl-base-1.0');
    const r = await env.AI.run(m, { prompt: String(prompt || '') });
    const bytes = r instanceof Uint8Array ? r : (r?.image ? Uint8Array.from(atob(r.image), c => c.charCodeAt(0)) : null);
    if (!bytes) return 'ERR:fn:ai_image_no_bytes';
    if (!env.R2) return JSON.stringify({ engine: 'cf-ai', bytes: bytes.length, note: 'no R2 bound' });
    const key = `img/gen/cf-ai-${crypto.randomUUID()}.png`;
    await env.R2.put(key, bytes, { httpMetadata: { contentType: 'image/png' } });
    return JSON.stringify({ engine: 'cf-ai', model: m, key, url: 'https://miscsubjects.com/' + key });
  },
  async aiTranslate(env, text, source, target) {
    if (!env.AI) return 'ERR:fn:no_ai_binding';
    const r = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: String(text || ''),
      source_lang: String(source || 'en'),
      target_lang: String(target || 'es'),
    });
    return JSON.stringify(r);
  },
  async watchAction(env, key, body) {
    const k = String(key || '');
    const b = String(body || '');
    if (!k) return JSON.stringify({ allowed: false, reason: 'no_key' });
    const rules = await env.DB.prepare(
      "SELECT id, pattern_key, pattern_body, action, reason FROM watch_rules WHERE IFNULL(enabled,1)=1 ORDER BY id"
    ).all();
    for (const r of (rules.results || [])) {
      const keyOk = !r.pattern_key || new RegExp(r.pattern_key).test(k);
      const bodyOk = !r.pattern_body || new RegExp(r.pattern_body).test(b);
      if (keyOk && bodyOk && String(r.action) === 'deny') {
        return JSON.stringify({ allowed: false, reason: r.reason || 'matched rule ' + r.id, rule_id: r.id });
      }
    }
    return JSON.stringify({ allowed: true });
  },
  async discoverSource(env, url) {
    const u = String(url || '');
    if (!/^https?:\/\//.test(u)) return 'ERR:fn:bad_url';
    const r = await fetch(u, { headers: { 'User-Agent': 'miscsubjects-build/1.0' } });
    if (!r.ok) return 'ERR:fn:discover_http:' + r.status;
    const body = await r.text();
    if (!env.R2) return JSON.stringify({ url: u, bytes: body.length, note: 'no R2 bound; not persisted' });
    const buf = new TextEncoder().encode(body);
    const hashBuf = await crypto.subtle.digest('SHA-256', buf);
    const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    const key = 'capability_sources/' + hash + '.txt';
    await env.R2.put(key, buf, { httpMetadata: { contentType: r.headers.get('content-type') || 'text/plain' } });
    return JSON.stringify({ url: u, bytes: body.length, r2_key: key, sha256_16: hash, status: r.status });
  },
  async extractCapabilities(env, r2Key, model) {
    if (!env.AI) return 'ERR:fn:no_ai_binding';
    if (!env.R2) return 'ERR:fn:no_r2';
    const obj = await env.R2.get(String(r2Key));
    if (!obj) return 'ERR:fn:r2_miss:' + r2Key;
    const text = await obj.text();
    const m = String(model || '@cf/meta/llama-3.3-70b-instruct-fp8-fast');
    const prompt = 'Read this API/CLI/SDK source. Return a JSON array of {op, method, url_or_signature, args:[{name,type,required}], description}. ONLY the JSON. No prose. Source:\n\n' + text.slice(0, 20000);
    const r = await env.AI.run(m, { messages: [{ role: 'user', content: prompt }] });
    return JSON.stringify(r);
  },
  async proposeRows(env, opsJsonOrR2Key, category) {
    let raw = String(opsJsonOrR2Key || '');
    if (raw.startsWith('capability_sources/') && env.R2) {
      const obj = await env.R2.get(raw);
      if (!obj) return 'ERR:fn:r2_miss:' + raw;
      raw = await obj.text();
    }
    let ops = null;
    const tryJsonArrayInside = s => {
      const m = String(s || '').match(/\[[\s\S]*\]/);
      if (!m) return null;
      try { const a = JSON.parse(m[0]); return Array.isArray(a) ? a : null; } catch { return null; }
    };
    if (!ops) ops = tryJsonArrayInside(raw);
    if (!ops) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.choices?.[0]?.message?.content) ops = tryJsonArrayInside(parsed.choices[0].message.content);
        if (!ops && parsed?.response) ops = tryJsonArrayInside(parsed.response);
        if (!ops && Array.isArray(parsed)) ops = parsed;
      } catch {}
    }
    if (!ops && raw && env.AI) {
      const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [{ role: 'user', content: 'Return ONLY a JSON array of {op,method,url_or_signature,args:[{name,type,required}],description}. Source:\n\n' + raw.slice(0, 20000) }],
      });
      ops = tryJsonArrayInside(r?.response || r?.choices?.[0]?.message?.content || '');
    }
    if (!Array.isArray(ops)) return 'ERR:fn:no_ops_extracted';
    const cat = String(category || 'discovered').replace(/[^a-z0-9_-]/gi, '');
    const lines = [];
    for (const op of ops) {
      const opName = String(op.op || op.name || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if (!opName) continue;
      const key = (cat.toUpperCase() + '_' + opName).slice(0, 64);
      const desc = String(op.description || '').replace(/'/g, "''").slice(0, 200);
      const sig  = String(op.url_or_signature || '').replace(/'/g, "''").slice(0, 200);
      const argCount = Array.isArray(op.args) ? op.args.length : 0;
      const tmpl = argCount === 0 ? '[]' : '[' + Array.from({length: argCount}, (_, i) => `"$${i+1}"`).join(',') + ']';
      lines.push(`-- ${desc}\nINSERT INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES ('${key}', 'fn', 'TODO_FN_NAME', '', '# ${desc}\\n# SIG: ${sig}\\n${tmpl}', '${cat}', 50, 0, 0, datetime('now'));`);
    }
    return JSON.stringify({ proposed_count: lines.length, category: cat, sql: lines.join('\n\n') });
  },
  async gapReport(env, opsJsonOrR2Key) {
    let raw = String(opsJsonOrR2Key || '');
    if (raw.startsWith('capability_sources/') && env.R2) {
      const obj = await env.R2.get(raw);
      if (!obj) return 'ERR:fn:r2_miss:' + raw;
      raw = await obj.text();
    }
    let ops;
    try {
      const parsed = JSON.parse(raw);
      ops = Array.isArray(parsed) ? parsed : null;
    } catch { ops = null; }
    if (!Array.isArray(ops)) return 'ERR:fn:not_array';
    const existing = await env.DB.prepare("SELECT key FROM directory WHERE IFNULL(enabled,1)=1").all();
    const known = new Set((existing.results || []).map(r => String(r.key).toUpperCase()));
    const found = [], missing = [];
    for (const op of ops) {
      const opName = String(op.op || op.name || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      if (!opName) continue;
      const candidates = [opName, 'CF_' + opName, 'WRANGLER_' + opName, 'CAPABILITY_' + opName];
      const hit = candidates.find(c => known.has(c));
      if (hit) found.push({ op: opName, matched_key: hit });
      else missing.push({ op: opName, sig: op.url_or_signature || '', description: (op.description || '').slice(0, 120) });
    }
    return JSON.stringify({ ops_total: ops.length, found: found.length, missing: missing.length, missing_ops: missing.slice(0, 50) });
  },
  async enqueueTask(env, key, body) {
    if (!env.TASKS) return 'ERR:fn:no_queue_binding';
    const job = { key: String(key || ''), body: String(body || ''), ts: buildNowIso() };
    await env.TASKS.send(job);
    return JSON.stringify({ queued: true, job });
  },
  async testAll(env, limitArg) {
    const parts = String(limitArg || '50').split('|');
    const limit = Math.max(1, parseInt(parts[0] || '50', 10) || 50);
    const kindSpec = parts[1] || '';
    const keys = await env.DB.prepare("SELECT DISTINCT key FROM directory_tests ORDER BY key LIMIT ?").bind(limit).all();
    const runId = 'ta_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const summary = [];
    let totalP = 0, totalF = 0;
    for (const r of (keys.results || [])) {
      const rowArg = kindSpec ? (r.key + '|' + kindSpec) : (r.key === 'ROUTER' ? 'ROUTER|!e2e' : r.key);
      const res = await FN_MAP.testRow(env, rowArg);
      try {
        const j = JSON.parse(res);
        summary.push({ key: r.key, run_id: j.run_id, total: j.total, passed: j.passed, failed: j.failed });
        totalP += Number(j.passed) || 0; totalF += Number(j.failed) || 0;
      } catch {
        summary.push({ key: r.key, error: 'parse_failed' });
      }
    }
    return JSON.stringify({ run_id: runId, keys: summary.length, passed: totalP, failed: totalF, summary });
  },
  async cfApiGaps(env, accountId) {
    const row = await env.DB.prepare("SELECT target FROM directory WHERE key='CF'").first();
    if (!row?.target) return 'ERR:fn:no_cf_row';
    const map = JSON.parse(String(row.target).replace(/^target_map:/, ''));
    const ops = Object.keys(map).sort();
    const known_namespaces = new Set();
    for (const v of Object.values(map)) {
      if (v && typeof v === 'object' && v.url) {
        const m = String(v.url).match(/\/client\/v4\/accounts\/[^/]+\/([^/?]+)/) || String(v.url).match(/\/client\/v4\/zones\/[^/]+\/([^/?]+)/) || String(v.url).match(/\/client\/v4\/([^/?]+)/);
        if (m) known_namespaces.add(m[1]);
      }
    }
    const expected_namespaces = ['workers','pages','d1','kv','r2','vectorize','hyperdrive','queues','workflows','ai','stream','images','dns_records','email','tunnels','access','secrets_store','browser-rendering','cfd_tunnel','storage','analytics','audit_logs','subscriptions','workers/durable_objects','workers/observability','workers/services','load_balancers','rulesets','firewall','rate_limits','cache','spectrum','magic','pipelines','containers','registrar'];
    const missing = expected_namespaces.filter(n => !known_namespaces.has(n) && !known_namespaces.has(n.split('/')[0]));
    return JSON.stringify({
      total_ops: ops.length,
      known_namespaces: [...known_namespaces].sort(),
      expected_namespaces,
      missing_namespaces: missing,
      coverage_pct: Math.round((expected_namespaces.length - missing.length) / expected_namespaces.length * 100),
    });
  },
  async testRow(env, key) {
    const raw = String(key || '');
    const pipe = raw.indexOf('|');
    const k = pipe > 0 ? raw.slice(0, pipe).trim() : raw.trim();
    const spec = pipe > 0 ? raw.slice(pipe + 1).trim() : '';
    const specParts = spec ? spec.split('|') : [];
    const kindSpec = specParts[0] || '';
    const testId = specParts[1] ? parseInt(specParts[1], 10) : 0;
    if (!k) return 'ERR:fn:no_key';
    let sql = "SELECT id, kind, args, expect_kind, expect_value FROM directory_tests WHERE key = ?";
    const binds = [k];
    if (kindSpec === '!e2e' || kindSpec === 'mechanical') sql += " AND kind != 'e2e'";
    else if (kindSpec) { sql += " AND kind = ?"; binds.push(kindSpec); }
    if (testId > 0) { sql += " AND id = ?"; binds.push(testId); }
    sql += " ORDER BY id";
    const tests = await env.DB.prepare(sql).bind(...binds).all();
    const list = tests.results || [];
    if (!list.length) return JSON.stringify({ key: k, total: 0, passed: 0, failed: 0, results: [] });
    const runId = 'tr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const ts = buildNowIso();
    const out = [];
    const graphCtx = { last_question_node_id: null, bpc_question_node_id: null };
    for (const t of list) {
      let actual = '';
      let passed = 0;
      try {
        if (t.kind === 'graph') {
          const { runGraphStepById } = await import('../_lib/graph_selftest.js');
          const gr = await runGraphStepById(env, t.args || '', graphCtx, dispatch);
          actual = [gr.op, gr.reason, gr.actual].filter(Boolean).join(' ');
          passed = gr.pass ? 1 : 0;
        } else {
          const opts = { actor: 'test_row' };
          if (k === 'ROUTER' && (t.kind === 'agent-route' || t.expect_kind === 'route_ok')) opts.routeOnly = true;
          const dispatched = await dispatch(env, k, t.args || '', opts);
          actual = String(dispatched?.result == null ? '' : dispatched.result);
          passed = evaluateExpect(actual, t.expect_kind, t.expect_value) ? 1 : 0;
        }
      } catch (e) {
        actual = 'ERR:test_row:' + (e && e.message || e);
      }
      try {
        await env.DB.prepare("INSERT INTO fidelity_log (run_id, ts, key, test_id, kind, args, expect_kind, expect_value, actual, passed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(runId, ts, k, t.id, t.kind, t.args || '', t.expect_kind, t.expect_value, String(actual).slice(0, 2000), passed).run();
      } catch {}
      out.push({ test_id: t.id, kind: t.kind, passed: !!passed, actual: String(actual).slice(0, 300) });
    }
    const total = out.length, passed = out.filter(o => o.passed).length;
    return JSON.stringify({ key: k, run_id: runId, total, passed, failed: total - passed, results: out });
  },
  async settingsReadKvFirst(env, key) {
    const k = String(key || '');
    if (env.KV) {
      const v = await env.KV.get(k);
      if (v != null) return JSON.stringify({ key: k, value: v, source: 'kv' });
    }
    const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(k).first();
    if (row && row.value != null) return JSON.stringify({ key: k, value: row.value, source: 'd1' });
    return JSON.stringify({ key: k, value: null, source: 'miss' });
  },
  async schedulersList(env) {
    const flags = {};
    for (const k of LOOP_FLAGS) flags[k] = await kvGetFlag(env, k);
    let automations = [];
    try {
      automations = (await env.DB.prepare(
        'SELECT id,name,every_min,key,body,enabled,last_run,last_receipt,runs,trigger FROM automations ORDER BY enabled DESC, id DESC LIMIT 80',
      ).all()).results || [];
    } catch {}
    return JSON.stringify({
      loop_flags: flags,
      enabled_automations: automations.filter(a => Number(a.enabled) === 1).length,
      disabled_automations: automations.filter(a => Number(a.enabled) !== 1).length,
      automations,
    });
  },
  async sendByChannel(env, channel, recipient, text) {
    const ch = String(channel || '').toLowerCase();
    const to = String(recipient || '');
    const body = String(text || '');
    if (!to || !body) return 'ERR:fn:bad_args';
    // Explicit SEND_BY_CHANNEL calls are independent of the autonomous iMessage loop flag.
    // Autonomous callers enforce their own loop gates before reaching this function.
    if (ch === 'telegram') {
      if (!env.TELEGRAM_BOT_TOKEN) return 'ERR:fn:no_telegram';
      const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: to, text: body }),
      });
      return JSON.stringify({ channel: ch, status: r.status, body: (await r.text()).slice(0, 500) });
    }
    if (ch === '2chat' || ch === 'twochat') {
      if (!env.TWOCHAT_API_KEY) return 'ERR:fn:no_2chat';
      const r = await fetch('https://api.p.2chat.io/open/whatsapp/send-message', {
        method: 'POST', headers: { 'content-type': 'application/json', 'X-User-API-Key': env.TWOCHAT_API_KEY },
        body: JSON.stringify({ to_number: to, from_number: env.BLOOIO_FROM_NUMBER || '[BUILD_PHONE]', text: body }),
      });
      return JSON.stringify({ channel: ch, status: r.status, body: (await r.text()).slice(0, 500) });
    }
    const sms = await blooioSend(env, to, body);
    return JSON.stringify({ channel: 'blooio', ...(sms || { status: 'no_blooio_key' }) });
  },
  async ledgerQuery(env, sql, ...params) {
    if (!env.LEDGER) return 'ERR:fn:no_ledger_binding';
    const pf = sqlPreflight('LEDGER_QUERY', sql, 'select');
    if (pf.err) return pf.err;
    const s = pf.sql;
    // Read the primary, not a replica. D1 read replication serves whichever copy is closest,
    // and a replica can lag: on 2026-09-01 this lane reported no events for the previous hour
    // while writes were landing normally, which reads as "the build stopped logging" during a
    // diagnosis. The ledger is what you consult when something looks wrong, so it must never
    // answer from behind. Falls through unchanged where the binding has no session support.
    const ledger = typeof env.LEDGER.withSession === 'function'
      ? env.LEDGER.withSession('first-primary')
      : env.LEDGER;
    try {
      const r = await ledger.prepare(s).bind(...params).all();
      return JSON.stringify(r.results || []);
    } catch (e) {
      // agent_turns / cc_turns / directory live on the DB binding, but callers reasonably
      // ask the "ledger" for them. Read-only queries fall through to DB instead of erroring.
      const msg = String(e && e.message || e);
      if (env.DB && /no such table/i.test(msg) && /^\s*(select|with)\b/i.test(s)) {
        const r2 = await env.DB.prepare(s).bind(...params).all();
        return JSON.stringify(r2.results || []);
      }
      throw e;
    }
  },
  async watchRuleAdd(env, patternKey, patternBody, reason, action) {
    const a = String(action || 'deny');
    const r = await env.DB.prepare("INSERT INTO watch_rules (pattern_key, pattern_body, action, reason) VALUES (?, ?, ?, ?)")
      .bind(String(patternKey || ''), patternBody ? String(patternBody) : null, a, String(reason || '')).run();
    return JSON.stringify({ ok: true, id: r.meta.last_row_id, pattern_key: patternKey, pattern_body: patternBody, action: a, reason });
  },
  async watchRuleList(env) {
    const r = await env.DB.prepare("SELECT id, pattern_key, pattern_body, action, reason, IFNULL(enabled,1) AS enabled FROM watch_rules ORDER BY id").all();
    return JSON.stringify(r.results || []);
  },
  async watchRuleDelete(env, id) {
    const r = await env.DB.prepare("DELETE FROM watch_rules WHERE id = ?").bind(Number(id)).run();
    return JSON.stringify({ ok: true, deleted: r.meta.changes });
  },
  async mediaUrlExtract(env, text) {
    const s = String(text || '');
    const re = /https:\/\/[^\s<>"']+\.(?:png|jpg|jpeg|gif|webp|mp4|mov|webm)\b/gi;
    const all = s.match(re) || [];
    const gen = all.filter(u => u.includes('/img/gen/') || u.includes('miscsubjects.com'));
    return JSON.stringify({ all, gen });
  },
  async lastReplyOf(env, text) {
    const s = String(text || '');
    const matches = [...s.matchAll(/\[REPLY\]([\s\S]*?)\[\/REPLY\]/gi)];
    if (!matches.length) return JSON.stringify({ found: false, text: '' });
    const last = matches[matches.length - 1][1].trim();
    return JSON.stringify({ found: true, text: last });
  },
  async shortResolve(env, shortId) {
    const r = await fetch('https://miscsubjects.com/api/inventory?short_id=' + encodeURIComponent(String(shortId || '')));
    if (!r.ok) return 'ERR:fn:short_resolve:' + r.status;
    return JSON.stringify(await r.json());
  },
  async knowledgeGet(env, topic) {
    const { knowledgeGet } = await import('../_lib/marketing_hub.js');
    return knowledgeGet(env, topic);
  },
  async marketingSnapshot(env) {
    const { marketingSnapshot } = await import('../_lib/marketing_hub.js');
    return JSON.stringify(await marketingSnapshot(env), null, 1);
  },
  async lblViewerGet(env, path) {
    const { lblViewerFetch } = await import('../_lib/lbl_viewer.js');
    const r = await lblViewerFetch(env, String(path || ''));
    return JSON.stringify(r, null, 1);
  },
  async metaSyncBackfill(env) {
    const { triggerMetaSync } = await import('../_lib/marketing_hub.js');
    const r = await triggerMetaSync(env, 'META_SYNC_BACKFILL');
    return JSON.stringify(r, null, 1);
  },
  async uiSurfaceProbe(env, url, markers) {
    const { uiSurfaceProbe } = await import('../_lib/ui_surface_probe.js');
    const extra = markers ? String(markers).split('|').map((s) => s.trim()).filter(Boolean) : [];
    const r = await uiSurfaceProbe(env, url, { markers: extra });
    return JSON.stringify(r, null, 1);
  },
  // ---- Automation loop: a proven invocation becomes a standing background job (fires itself,
  // ledgers a receipt each run). Cron calls automateRunDue every tick. ----
  async automateAdd(env, name, everyMinOrEvent, key, body) {
    const k = String(key || '').trim();
    if (!k) return 'ERR:fn:automate:key_required';
    // 2nd arg is either N minutes (schedule) or "event:NAME" (fires when AUTOMATE_FIRE hits NAME).
    const s2 = String(everyMinOrEvent || '').trim();
    let trigger = 'schedule', em = 60;
    if (s2.toLowerCase().startsWith('event:')) { trigger = 'event:' + s2.slice(6).trim(); em = 0; }
    else em = Math.max(1, parseInt(s2, 10) || 60);
    const ts = buildNowIso();
    const r = await env.DB.prepare('INSERT INTO automations (name, every_min, key, body, enabled, created_at, runs, trigger) VALUES (?, ?, ?, ?, 1, ?, 0, ?)')
      .bind(String(name || k), em, k, String(body == null ? '' : body), ts, trigger).run();
    const when = trigger === 'schedule' ? ('every ' + em + ' min') : ('on ' + trigger);
    return JSON.stringify({ ok: true, id: r.meta.last_row_id, name: String(name || k), trigger, every_min: em, key: k, body: String(body == null ? '' : body),
      note: 'Live. Fires ' + k + ' ' + when + ' and ledgers a receipt. Pause: AUTOMATE_TOGGLE ' + r.meta.last_row_id + '|0 · list: AUTOMATE_LIST' });
  },
  // Fire event-triggered automations (trigger=event:NAME). Any inbound hook calls this.
  async automateFire(env, eventName, payload) {
    const ev = 'event:' + String(eventName || '').trim();
    // force_off is the owner's kill switch (owner order 2026-08-04): it outranks enabled
    // everywhere, and only AUTOMATE_FORCE|id|commit-on lifts it. AUTOMATE_TOGGLE cannot.
    const rows = (await env.DB.prepare("SELECT * FROM automations WHERE enabled=1 AND COALESCE(force_off,0)=0 AND trigger=?").bind(ev).all()).results || [];
    const dir = await loadDirectory(env);
    const fired = [];
    for (const a of rows) {
      const bodyIn = (a.body && a.body.length) ? a.body : String(payload == null ? '' : payload);
      let receipt = null, ok = false;
      try {
        const rr = await dispatch(env, a.key, bodyIn, { actor: 'automation:' + a.id });
        ok = !String(rr.result || '').startsWith('ERR');
        const row = dir[a.key] || { key: a.key };
        const wrapped = await wrapDispatchResponse(rr, row, a.key, { actor: 'automation:' + a.id, input: bodyIn });
        if (wrapped.invocation && rr.event_id) wrapped.invocation.event_id = rr.event_id;
        await logInvocation(env, { trace_id: rr.trace, object_id: a.key, row, actor: 'automation:' + a.id, input: bodyIn, result: rr.result, cost_usd: rr.cost, event_id: rr.event_id, invocation: wrapped.invocation });
        receipt = wrapped.invocation?.id || null;
      } catch (e) { receipt = 'ERR:' + (e?.message || String(e)); }
      await env.DB.prepare('UPDATE automations SET last_run=?, last_receipt=?, runs=runs+1 WHERE id=?').bind(buildNowIso(), receipt || '', a.id).run();
      fired.push({ id: a.id, key: a.key, ok, receipt });
    }
    return JSON.stringify({ event: eventName, matched: rows.length, ran: fired.length, fired });
  },
  async automateList(env) {
    const r = await env.DB.prepare('SELECT id, name, every_min, key, body, enabled, COALESCE(force_off,0) force_off, last_run, last_receipt, runs FROM automations ORDER BY id').all();
    return JSON.stringify((r.results || []).map((a) => ({ ...a, enabled: !!a.enabled, force_off: !!a.force_off,
      last_receipt_url: a.last_receipt && String(a.last_receipt).startsWith('inv_') ? 'https://miscsubjects.com/api/dispatch?confirm=' + a.last_receipt : null })));
  },
  async automateToggle(env, id, on) {
    const v = (String(on) === '1' || String(on).toLowerCase() === 'true') ? 1 : 0;
    const aid = parseInt(id, 10);
    if (v) {
      const row = await env.DB.prepare('SELECT COALESCE(force_off,0) force_off FROM automations WHERE id=?').bind(aid).first();
      if (row && row.force_off) {
        return JSON.stringify({ ok: false, id: aid, error: 'owner_force_off', note: 'This automation is forced off on the owner\'s authority. AUTOMATE_TOGGLE cannot re-enable it — only AUTOMATE_FORCE|' + aid + '|commit-on lifts the lock, and that verb is for the owner\'s explicit order only.' });
      }
    }
    const r = await env.DB.prepare('UPDATE automations SET enabled=? WHERE id=?').bind(v, aid).run();
    return JSON.stringify({ ok: r.meta.changes > 0, id: aid, enabled: !!v });
  },
  // AUTOMATE_FORCE — the owner's kill switch (owner order 2026-08-04, modeled on the cloaker
  // and self-testing toggles): $1=id, $2='off' (force off, outranks enabled everywhere) or
  // 'commit-on' (lift the lock; does NOT re-enable — toggle it on separately, deliberately).
  async automateForce(env, id, mode) {
    const aid = parseInt(id, 10);
    const m = String(mode || '').trim().toLowerCase();
    if (!aid || !['off', 'commit-on'].includes(m)) {
      return JSON.stringify({ error: 'usage: AUTOMATE_FORCE|<id>|off  (owner kill switch)  or  AUTOMATE_FORCE|<id>|commit-on (lift the lock; then AUTOMATE_TOGGLE|<id>|1 to run again)' });
    }
    const v = m === 'off' ? 1 : 0;
    const r = await env.DB.prepare('UPDATE automations SET force_off=?' + (v ? ', enabled=0' : '') + ' WHERE id=?').bind(v, aid).run();
    return JSON.stringify({ ok: r.meta.changes > 0, id: aid, force_off: !!v, enabled_after: v ? false : 'unchanged — enable deliberately with AUTOMATE_TOGGLE|' + aid + '|1' });
  },
  async automateDelete(env, id) {
    const r = await env.DB.prepare('DELETE FROM automations WHERE id=?').bind(parseInt(id, 10)).run();
    return JSON.stringify({ ok: true, deleted: r.meta.changes });
  },
  async automateRunDue(env) {
    const now = Date.now();
    const rows = (await env.DB.prepare("SELECT * FROM automations WHERE enabled=1 AND COALESCE(force_off,0)=0 AND trigger='schedule'").all()).results || [];
    const dir = await loadDirectory(env);
    const fired = [];
    for (const a of rows) {
      const last = a.last_run ? Date.parse(a.last_run) : 0;
      if (now - last < a.every_min * 60 * 1000) continue;
      let receipt = null, ok = false;
      try {
        const rr = await dispatch(env, a.key, a.body || '', { actor: 'automation:' + a.id });
        ok = !String(rr.result || '').startsWith('ERR');
        const row = dir[a.key] || { key: a.key };
        const wrapped = await wrapDispatchResponse(rr, row, a.key, { actor: 'automation:' + a.id, input: a.body || '' });
        if (wrapped.invocation && rr.event_id) wrapped.invocation.event_id = rr.event_id;
        await logInvocation(env, { trace_id: rr.trace, object_id: a.key, row, actor: 'automation:' + a.id, input: a.body || '', result: rr.result, cost_usd: rr.cost, event_id: rr.event_id, invocation: wrapped.invocation });
        receipt = wrapped.invocation?.id || null;
      } catch (e) { receipt = 'ERR:' + (e?.message || String(e)); }
      const ts = buildNowIso();
      await env.DB.prepare('UPDATE automations SET last_run=?, last_receipt=?, runs=runs+1 WHERE id=?').bind(ts, receipt || '', a.id).run();
      fired.push({ id: a.id, key: a.key, ok, receipt });
    }
    return JSON.stringify({ ran: fired.length, fired });
  },
  // ---- OIP-Caps (v0.3): the six capability/receipt verbs as directory-invokable fns ----
  // audience is the last argument on purpose: a token bound to an audience fails closed when
  // forwarded to anyone else, which is the whole point of a witness token. Before 2026-07-30
  // capMint had no audience parameter at all, so WITNESS_MINT could not bind one through a row
  // and its tokens were unbound with a 600-second default TTL.
  async capMint(env, scope, key, ttl, uses, purpose, riskCeiling, ownerGate, audience) {
    // Models often put the row key in the scope slot ("NOW|NOW|600|..." or "NOW|600|...").
    // A non-tier first arg that looks like a directory key means scope=row for that key.
    let sc = String(scope || 'row').trim();
    let k = key ? String(key).trim() : null;
    if (!['row', 'act', 'read'].includes(sc) && !sc.startsWith('row:')) {
      if (/^[A-Za-z][A-Za-z0-9_]*$/.test(sc)) { if (!k || /^\d+$/.test(k)) k = sc; sc = 'row'; }
      else sc = 'read';
    }
    if (sc === 'row' && !k) return 'ERR:fn:cap_mint:row_scope_needs_key';
    const out = await mintCapability(env, 'https://miscsubjects.com', {
      scope: sc, key: k, ttl: ttl || 600, uses: uses || 1,
      purpose: purpose ? String(purpose) : null, risk_ceiling: riskCeiling ? String(riskCeiling) : 'low',
      owner_gate: String(ownerGate || '') === '1',
      audience: audience ? String(audience) : null,
    });
    if (out.error) return 'ERR:fn:cap_mint:' + out.error;
    return JSON.stringify(out);
  },
  async capExplain(env, tokenOrFingerprint) {
    const t = String(tokenOrFingerprint || '').trim();
    if (!t) return 'ERR:fn:cap_explain:no_token_or_fingerprint';
    const explanation = await explainCapability(env, t);
    await ledgerCapEvent(env, {
      key: explanation.capability?.allowed?.row_key || explanation.capability?.scope || 'CAPABILITY',
      action: 'explain',
      actor: 'cap:' + (explanation.capability?.fingerprint || 'unknown'),
      request: { fingerprint: explanation.capability?.fingerprint, by: t.startsWith('cap_') ? 'fingerprint' : 'token', via: 'fn' },
      response: { valid: explanation.valid, reason: explanation.reason, scope: explanation.capability?.scope },
    });
    return JSON.stringify(explanation);
  },
  async capRevoke(env, fingerprint) {
    const fp = String(fingerprint || '').trim();
    if (!fp.startsWith('cap_')) return 'ERR:fn:cap_revoke:bad_fingerprint';
    const done = await revokeCapability(env, fp);
    const cap = await getCapabilityByFingerprint(env, fp);
    await ledgerCapEvent(env, {
      key: cap?.row_key || cap?.scope || 'CAPABILITY', action: 'revoke', actor: 'owner',
      request: { fingerprint: fp, via: 'fn' },
      response: { revoked: done, exists: !!cap },
    });
    if (!cap) return 'ERR:fn:cap_revoke:unknown_capability:' + fp;
    return JSON.stringify({ ok: true, fingerprint: fp, revoked: true, was_already_revoked: !done });
  },
  async oipReceipt(env, invId) {
    const rec = await getInvocation(env, String(invId || '').trim());
    if (!rec) return 'ERR:fn:oip_receipt:unknown_invocation:' + invId;
    const authz = await authorizeCompositeReceipt(env, rec, env.TRACE_CTX?.authContext);
    if (!authz.ok) return 'ERR:fn:oip_receipt:denied:' + authz.reason;
    let event = null;
    if (rec.event_id) { try { event = await readEventFull(env, rec.event_id); } catch {} }
    return JSON.stringify(receiptPayload(rec, event));
  },
  async oipReplay(env, invId) {
    const past = await getInvocation(env, String(invId || '').trim());
    if (!past) return 'ERR:fn:oip_replay:unknown_invocation:' + invId;
    const authz = await authorizeCompositeReceipt(env, past, env.TRACE_CTX?.authContext);
    if (!authz.ok) return 'ERR:fn:oip_replay:denied:' + authz.reason;
    let input = null;
    if (past.event_id) {
      try { const ev = await readEventFull(env, past.event_id); if (ev && ev.request_json != null) input = String(ev.request_json); } catch {}
    }
    if (input == null) { try { input = JSON.parse(past.invocation_json || 'null')?.input_preview ?? ''; } catch { input = ''; } }
    const r = await dispatchNestedAuthorized(env, past.object_id, input, env.TRACE_CTX?.authContext);
    if (r.denied) return 'ERR:fn:oip_replay:step_denied:' + r.reason;
    const dir = await loadDirectory(env);
    const row = dir[past.object_id] || { key: past.object_id };
    const wrapped = await wrapDispatchResponse(r, row, past.object_id, { actor: r.nested_actor, input, replay_of: past.id, auth: r.nested_auth });
    if (wrapped.invocation && r.event_id) wrapped.invocation.event_id = r.event_id;
    await logInvocation(env, { trace_id: r.trace, object_id: past.object_id, row, actor: r.nested_actor, input, result: r.result, cost_usd: r.cost, event_id: r.event_id, invocation: wrapped.invocation });
    return JSON.stringify({
      replayed: past.id, new_invocation: wrapped.invocation.id, object_id: past.object_id,
      result: String(r.result == null ? '' : r.result).slice(0, 1500),
      receipt: wrapped.invocation.links.receipt, replay_of_receipt: 'https://miscsubjects.com/api/dispatch?receipt=' + encodeURIComponent(past.id),
    });
  },
  // Receipt-driven repair: inspect a failed invocation, propose the smallest safe repair,
  // execute it only when the target row is low-risk; high-risk targets return a concrete
  // proposal for the owner instead of firing. Lineage written in both directions.
  async oipRepair(env, invId, key, body) {
    const id = String(invId || '').trim();
    const past = await getInvocation(env, id);
    if (!past) return 'ERR:fn:oip_repair:unknown_invocation:' + id;
    const authz = await authorizeCompositeReceipt(env, past, env.TRACE_CTX?.authContext);
    if (!authz.ok) return 'ERR:fn:oip_repair:denied:' + authz.reason;
    let pastInv = null;
    try { pastInv = JSON.parse(past.invocation_json || 'null'); } catch {}
    const output = String(pastInv?.output_preview || '');
    const failed = !Number(past.material) || output.startsWith('ERR');
    let recordedInput = null;
    if (past.event_id) {
      try { const ev = await readEventFull(env, past.event_id); if (ev && ev.request_json != null) recordedInput = String(ev.request_json); } catch {}
    }
    if (recordedInput == null) recordedInput = String(pastInv?.input_preview ?? '');
    if (!failed && !key) {
      return JSON.stringify({ repair_needed: false, invocation: id, note: 'that invocation succeeded — use replay to re-fire it, or pass key|body to force a corrected re-fire.', replay: { post: 'https://miscsubjects.com/api/dispatch', body: { replay: id } } });
    }
    const dir = await loadDirectory(env);
    let targetKey = key ? String(key).trim() : null;
    let targetBody = body != null ? String(body) : null;
    if (!targetKey) {
      const m = output.match(/^ERR:dispatch:unknown_key:(\S+)/);
      if (m) {
        const bad = m[1].toUpperCase();
        const keys = Object.keys(dir);
        targetKey = keys.find((k) => k.toUpperCase() === bad)
          || keys.filter((k) => k.toUpperCase().includes(bad) || bad.includes(k.toUpperCase())).sort((a, b) => a.length - b.length)[0]
          || keys.map((k) => ({ k, d: levenshteinSmall(bad, k.toUpperCase()) })).filter((x) => x.d <= 2).sort((a, b) => a.d - b.d)[0]?.k
          || null;
      } else {
        targetKey = past.object_id;
      }
      if (targetBody == null) targetBody = recordedInput;
    }
    if (targetBody == null) targetBody = recordedInput;
    if (!targetKey || !dir[targetKey]) {
      return JSON.stringify({
        repair_needed: true, invocation: id, failure: output.slice(0, 300),
        proposal: { post: 'https://miscsubjects.com/api/dispatch', body: { key: targetKey || past.object_id, body: targetBody, repairs: id } },
        note: 'no confident target row — this is the exact corrected payload to fire; adjust key/body and POST it, or call OIP_REPAIR with inv|key|body.',
      });
    }
    if (Number(dir[targetKey].sensitive)) {
      return JSON.stringify({
        repair_needed: true, invocation: id, failure: output.slice(0, 300), owner_gate: true,
        proposal: { post: 'https://miscsubjects.com/api/dispatch', body: { key: targetKey, body: targetBody, repairs: id } },
        note: targetKey + ' is a high-risk row — not auto-fired. Owner POSTs the proposal payload with the terminal key to execute the repair.',
      });
    }
    const r = await dispatchNestedAuthorized(env, targetKey, targetBody, env.TRACE_CTX?.authContext);
    if (r.denied) return 'ERR:fn:oip_repair:step_denied:' + r.reason;
    const row = dir[targetKey];
    const wrapped = await wrapDispatchResponse(r, row, targetKey, { actor: r.nested_actor, input: targetBody, repairs: id, auth: r.nested_auth });
    if (wrapped.invocation && r.event_id) wrapped.invocation.event_id = r.event_id;
    await logInvocation(env, { trace_id: r.trace, object_id: targetKey, row, actor: r.nested_actor, input: targetBody, result: r.result, cost_usd: r.cost, event_id: r.event_id, invocation: wrapped.invocation });
    await linkRepairedBy(env, id, wrapped.invocation.id);
    return JSON.stringify({
      repaired: id, new_invocation: wrapped.invocation.id, key: targetKey,
      result: String(r.result == null ? '' : r.result).slice(0, 1500),
      lineage: {
        new_receipt_repairs: id,
        old_receipt_repaired_by: wrapped.invocation.id,
        new_receipt: wrapped.invocation.links.receipt,
        old_receipt: 'https://miscsubjects.com/api/dispatch?receipt=' + encodeURIComponent(id),
      },
    });
  },
  async d1To2dArray(env, sql, ...params) {
    const r = await env.DB.prepare(String(sql)).bind(...params).all();
    const rows = r.results || [];
    if (!rows.length) return JSON.stringify([[]]);
    const cols = Object.keys(rows[0]);
    const out = [cols];
    for (const row of rows) out.push(cols.map(c => row[c] == null ? '' : String(row[c])));
    return JSON.stringify(out);
  },
  async d1Query(env, sql, ...params) {
    const s = sqlPreflight('D1_QUERY', sql, 'select');
    if (s.err) return s.err;
    try {
      const r = await env.DB.prepare(s.sql).bind(...params).all();
      return JSON.stringify(r.results || []);
    } catch (e) {
      return await sqlSchemaHint(env.DB, 'D1_QUERY', s.sql, e);
    }
  },
  async d1Exec(env, sql, ...params) {
    const s = sqlPreflight('D1_EXEC', sql, 'write');
    if (s.err) return s.err;
    // WT-0039: work_tasks, work_actions, articles and article_slots have one write path each, and it
    // is not this one. See functions/_lib/governed_tables.js — the refusal names the path that works.
    const governed = checkGovernedWrite('D1_EXEC', s.sql);
    if (governed) return governed;
    const r = await env.DB.prepare(s.sql).bind(...params).run();
    return JSON.stringify({ changes: r.meta.changes, last_row_id: r.meta.last_row_id });
  },

  // THE REPAIR LANE. Same statement, same tables, but it cannot be silent: it states why and it lands
  // on the audit chain as a `repair` action. Refusing D1_EXEC without providing this would just push
  // the next agent toward a worse bypass — a bad row has to be fixable without pretending it is work.
  // $1 = reason (required, no pipes). $2 = the SQL.
  async d1Repair(env, reason, sql, ...params) {
    const why = String(reason || '').trim();
    if (why.length < 12) {
      return 'ERR:D1_REPAIR:reason_required — say what is being repaired and why, in at least a dozen '
        + 'characters. The reason is written to the audit row; "fix" tells the next reader nothing. '
        + 'Call it as D1_REPAIR | <reason> | <SQL>.';
    }
    const s = sqlPreflight('D1_REPAIR', sql, 'write');
    if (s.err) return s.err;
    const table = governedTableIn(s.sql);
    const r = await env.DB.prepare(s.sql).bind(...params).run();
    let audit = null;
    try {
      const { appendAction } = await import('./work_object.js');
      const a = await appendAction(env, {
        task_id: '', action: 'repair', agent: 'D1_REPAIR', model: null,
        input: { reason: why, sql: s.sql.slice(0, 2000), table: table || null },
        output: { changes: r.meta.changes, last_row_id: r.meta.last_row_id },
        changed: table ? [table] : null, result: 'recorded',
      });
      audit = a.hash;
    } catch (e) {
      // The write already happened. Say the audit row is missing rather than implying it exists.
      return JSON.stringify({
        changes: r.meta.changes, last_row_id: r.meta.last_row_id, table: table || null,
        audit_hash: null,
        warning: 'the repair ran but its audit row could not be appended: ' + String(e && e.message || e)
          + ' — this repair is not on the chain. Record it before doing anything else.',
      });
    }
    return JSON.stringify({ changes: r.meta.changes, last_row_id: r.meta.last_row_id, table: table || null, reason: why, audit_hash: audit });
  },
  async ledgerExec(env, sql, ...params) {
    const s = sqlPreflight('LEDGER_EXEC', sql, 'write');
    if (s.err) return s.err;
    const r = await env.LEDGER.prepare(s.sql).bind(...params.filter((p) => p !== undefined && p !== '')).run();
    return JSON.stringify({ changes: r.meta.changes, last_row_id: r.meta.last_row_id });
  },
  async fidelityRun(env, kindFilter, offsetArg, limitArg) {
    const filter = String(kindFilter || '').trim();
    const offset = Math.max(0, parseInt(offsetArg || '0', 10) || 0);
    const limit = Math.max(1, parseInt(limitArg || '100', 10) || 100);
    let where = '';
    const binds = [];
    if (filter === 'non-agent') { where = "WHERE kind IN ('positive','inverse')"; }
    else if (filter) { where = 'WHERE kind=?'; binds.push(filter); }
    const sql = `SELECT id,key,kind,args,expect_kind,expect_value FROM directory_tests ${where} ORDER BY id LIMIT ? OFFSET ?`;
    binds.push(limit, offset);
    const rows = (await env.DB.prepare(sql).bind(...binds).all()).results || [];
    const runId = 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    const t0 = Date.now();
    let passed = 0, failed = 0;
    const failingRows = [];
    for (const t of rows) {
      const start = Date.now();
      let result = '';
      try {
        const dispatched = await dispatch(env, t.key, t.args || '');
        result = String(dispatched.result == null ? '' : dispatched.result);
      } catch (e) {
        result = 'ERR:fidelity:dispatch:' + (e?.message || String(e));
      }
      const pass = evaluateExpect(result, t.expect_kind, t.expect_value);
      const latency = Date.now() - start;
      if (pass) passed++; else { failed++; failingRows.push({ id: t.id, key: t.key, kind: t.kind, args: t.args, expect_kind: t.expect_kind, expect_value: t.expect_value, actual: result.slice(0, 200) }); }
      try {
        await env.DB.prepare(
          'INSERT INTO fidelity_log(run_id,test_id,key,kind,passed,expected,actual,latency_ms) VALUES (?,?,?,?,?,?,?,?)'
        ).bind(runId, t.id, t.key, t.kind, pass ? 1 : 0, t.expect_kind + ':' + t.expect_value, result.slice(0, 1000), latency).run();
      } catch {}
    }
    return JSON.stringify({ run_id: runId, total: rows.length, passed, failed, duration_ms: Date.now() - t0, failing: failingRows.slice(0, 20) });
  },
  async worldMap(env, categoryArg) {
    const cat = String(categoryArg || '').trim();
    const rows = (await env.DB.prepare('SELECT key,type,category,content FROM directory WHERE enabled IS NULL OR enabled=1').all()).results || [];
    const docOf = c => { const lines = String(c || '').split('\n'); const w = lines.find(l => /^#\s*WHAT/i.test(l)) || lines[0] || ''; return w.replace(/^#\s*(WHAT:?)?/i, '').trim().slice(0, 90); };
    if (cat) {
      const list = rows.filter(r => (r.category || '') === cat).map(r => ({ key: r.key, type: r.type, doc: docOf(r.content) }));
      return JSON.stringify({ category: cat, count: list.length, tools: list });
    }
    const byCat = {}; for (const r of rows) { const c = r.category || '_uncat'; (byCat[c] = byCat[c] || []).push(r); }
    const cats = Object.keys(byCat).sort().map(c => ({ category: c, count: byCat[c].length }));
    const when_to_use = {
      'any Mac shell command (cat/ls/sed/grep/curl/cp/rm/tail/wc/...)': 'LOCAL_EXEC <command> — runs sh -lc on the Mac; covers every coreutil + shell builtin',
      'Cloudflare Workers/Pages/D1/KV/R2 manage + deploy (local)': 'WRANGLER_* (WRANGLER_DEPLOY, WRANGLER_D1_EXECUTE, WRANGLER_KV_KEY_PUT, ...)',
      'Cloudflare REST API (no local machine needed)': 'CF <op>|<account_id> — 256 ops incl kv/d1/r2/workers',
      'GitHub': 'GH_* (GH_PR_LIST, GH_REPO_VIEW, ...) or GITHUB',
      'node / npm packages': 'NPM_* (NPM_INSTALL, NPM_RUN, ...)',
      'Google Apps Script CLI': 'CLASP_*',
      'Google Workspace REST (Drive/Sheets/Gmail/Calendar/...)': 'GAPI_* (needs GOOGLE_OAUTH_TOKEN) — or the airunner actions for sheets/drive/calendar/tasks',
      'read/write the build registry itself': 'DIRECTORY_LIST, D1_QUERY, ADD_ROW, EDIT_ROW, SET_ROW_CONTENT',
      'call another LLM': 'ASK_CLAUDE / ASK_GPT / ASK_GEMINI / ASK_KIMI',
      'self-test the build': 'FIDELITY_RUN, TEST_ROW',
      'tune your own runtime': 'SET_TOOL_LOOPS <n>, SET_MEMORY_WINDOW <n>, GET_AGENT_LIMITS',
      'discover a tool you do not know': "D1_QUERY SELECT key,type,target,category FROM directory WHERE lower(key) LIKE '%<keyword>%' OR lower(content) LIKE '%<keyword>%' OR lower(category) LIKE '%<keyword>%' ORDER BY key LIMIT 20",
    };
    return JSON.stringify({ generated: buildNowIso(), total_tools: rows.length, how_to_call: 'emit [KEY]arg1|arg2[/KEY]; single-arg rows take the whole body; drill into a category with [WORLD_MAP]<category>[/WORLD_MAP]', categories: cats, when_to_use });
  },
  async setAgentLimits(env, toolLoops, memoryWindow, depthCap, costCap) {
    const out = { ok: true };
    if (toolLoops != null && String(toolLoops).trim() !== '') { const n = Math.min(Math.max(parseInt(toolLoops, 10) || 0, 1), 40); if (env.KV) await env.KV.put('agent_tool_loops', String(n)); out.tool_loops = n; }
    if (memoryWindow != null && String(memoryWindow).trim() !== '') { const n = Math.max(parseInt(memoryWindow, 10) || 0, 0); if (env.KV) await env.KV.put('agent_memory_window', String(n)); out.memory_window = n; }
    if (depthCap != null && String(depthCap).trim() !== '') { const n = Math.min(Math.max(parseInt(depthCap, 10) || 0, 1), 10); if (env.KV) await env.KV.put('agent_depth_cap', String(n)); out.depth_cap = n; }
    if (costCap != null && String(costCap).trim() !== '') { const n = Math.max(parseFloat(costCap) || 0, 0.01); if (env.KV) await env.KV.put('agent_cost_cap', String(n)); out.cost_cap_usd = n; }
    return JSON.stringify(out);
  },
  async getAgentLimits(env) {
    const g = async (k) => env.KV ? await env.KV.get(k) : null;
    const [tl, mw, dc, cc] = await Promise.all([g('agent_tool_loops'), g('agent_memory_window'), g('agent_depth_cap'), g('agent_cost_cap')]);
    return JSON.stringify({
      tool_loops: tl ? parseInt(tl, 10) : 8, tool_loops_default: 8, tool_loops_max: 40,
      memory_window: mw != null ? parseInt(mw, 10) : 'turn-default',
      depth_cap: dc ? parseInt(dc, 10) : 3, depth_cap_default: 3, depth_cap_max: 10,
      cost_cap_usd: cc ? parseFloat(cc) : 1.00, cost_cap_default: 1.00
    });
  },
  async kvGet(env, key) {
    if (!env.KV) return 'ERR:fn:no_kv_binding';
    const v = await env.KV.get(String(key));
    return v == null ? '' : v;
  },
  async kvPut(env, key, value) {
    if (!env.KV) return 'ERR:fn:no_kv_binding';
    const name = String(key || '');
    const next = String(value || '');
    if (name === ARTICLE_BACKGROUND_LOCK_KEY && !flagEnables(next)) {
      return 'ERR:locked:article_background_writes_locked cannot be disabled through KV_PUT';
    }
    // Vault-level selftest master: agents cannot flip master ON or autorun ON via KV_PUT.
    // Owner enables only from /admin/selftest (POST set_master / set_autorun + confirm phrase).
    if (name === 'selftest_master' && flagEnables(next)) {
      return 'ERR:locked:selftest_master ON only via /api/selftest action=set_master confirm=ENABLE SELFTEST (admin tab)';
    }
    if (name === 'selftest_autorun' && flagEnables(next)) {
      return 'ERR:locked:selftest_autorun ON only via /api/selftest action=set_autorun confirm=ENABLE SELFTEST AUTORUN (admin tab)';
    }
    if (LOCKED_AUTORUN_KEYS.has(name) && flagEnables(next) && await articleBackgroundWritesLocked(env)) {
      return 'ERR:locked:background article writing and self-testing are disabled by the owner';
    }
    await env.KV.put(name, next);
    return 'OK';
  },
  async kvDel(env, key) {
    if (!env.KV) return 'ERR:fn:no_kv_binding';
    const name = String(key || '');
    if (name === ARTICLE_BACKGROUND_LOCK_KEY) {
      return 'ERR:locked:article_background_writes_locked cannot be deleted through KV_DEL';
    }
    if (name === 'selftest_master') {
      return 'ERR:locked:selftest_master cannot be deleted — set to 0 via set_master or kill';
    }
    await env.KV.delete(name);
    return 'OK';
  },
  async dedupInsert(env, messageId) {
    const ts = buildNowIso();
    const r = await env.DB.prepare('INSERT OR IGNORE INTO blooio_dedup (message_id, created_at) VALUES (?, ?)').bind(String(messageId), ts).run();
    return r.meta.changes === 0 ? 'ERR:dup' : 'OK';
  },
  async addRow(env, key, type, target, auth, content) {
    const ts = buildNowIso();
    await env.DB.prepare('INSERT INTO directory (key, type, target, auth, content, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(String(key), String(type), String(target || ''), String(auth || ''), String(content || ''), ts).run();
    if (env.KV) await env.KV.delete('directory:snapshot');
    return 'OK';
  },
  async editRow(env, key, type, target, auth, content) {
    const ts = buildNowIso();
    await env.DB.prepare('INSERT OR REPLACE INTO directory (key, type, target, auth, content, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(String(key), String(type), String(target || ''), String(auth || ''), String(content || ''), ts).run();
    if (env.KV) await env.KV.delete('directory:snapshot');
    return 'OK';
  },
  async delRow(env, key) {
    await env.DB.prepare('DELETE FROM directory WHERE key = ?').bind(String(key)).run();
    if (env.KV) await env.KV.delete('directory:snapshot');
    return 'OK';
  },
  async taskAdd(env, body, source) {
    const ts = buildNowIso();
    const raw = String(body || '');
    let job = null;
    if (raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
      try { job = JSON.parse(raw); if (Array.isArray(job)) job = null; }
      catch { job = null; }
    }
    if (!job || typeof job !== 'object') job = { ask: raw, role: 'writer' };
    const role = String(job.role || job.phase || 'writer');
    const stored = JSON.stringify(job);
    const r = await env.DB.prepare('INSERT INTO tasks (created_at, status, body, source) VALUES (?, ?, ?, ?)')
      .bind(ts, 'open', stored, String(source || role)).run();
    const taskId = r.meta.last_row_id;
    let googleTaskId = null;
    try {
      const gasUrl = env.AIRUNNER_WEB_APP_URL;
      if (gasUrl) {
        const title = String(job.ask || job.title || raw).slice(0, 200);
        const gr = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'tasks_add', args: { title, notes: String(source || role) } })
        });
        const gj = await gr.json().catch(() => ({}));
        if (gj.ok && gj.id) {
          googleTaskId = gj.id;
          await env.DB.prepare('UPDATE tasks SET google_task_id = ? WHERE id = ?').bind(googleTaskId, taskId).run();
        }
      }
    } catch (e) { /* GAS sync is best-effort; row already inserted */ }
    return JSON.stringify({ id: taskId, created_at: ts, job, source: String(source || role), google_task_id: googleTaskId });
  },
  async taskDone(env, taskId, result) {
    const id = Number(taskId);
    if (!id || isNaN(id)) return JSON.stringify({ error: 'task_id required' });
    const a = await env.DB.prepare('SELECT id FROM tasks WHERE id=?').bind(id).first();
    if (!a) return JSON.stringify({ error: 'task not found: ' + id });
    const trace = result != null ? String(result).slice(0, 4000) : '';
    await env.DB.prepare('UPDATE tasks SET status=?, trace=? WHERE id=?').bind('done', trace, id).run();
    return JSON.stringify({ id, status: 'done' });
  },
  // Edit a task's text/status. $1=task_id, $2=new plain-text (stored as job.text), $3=optional new status.
  async taskEdit(env, taskId, text, status) {
    const id = Number(taskId);
    if (!id || isNaN(id)) return JSON.stringify({ error: 'task_id required' });
    const a = await env.DB.prepare('SELECT id, body, status FROM tasks WHERE id=?').bind(id).first();
    if (!a) return JSON.stringify({ error: 'task not found: ' + id });
    let job = {}; try { job = JSON.parse(a.body || '{}'); if (!job || typeof job !== 'object') job = { text: a.body }; } catch { job = { text: a.body }; }
    if (text != null && String(text) !== '') job.text = String(text);
    const newStatus = (status != null && String(status) !== '') ? String(status) : a.status;
    await env.DB.prepare('UPDATE tasks SET body=?, status=? WHERE id=?').bind(JSON.stringify(job), newStatus, id).run();
    return JSON.stringify({ id, status: newStatus, text: job.text || null });
  },
  // Delete a task. $1=task_id. Any children are lifted to top-level so nothing is hidden.
  async taskDelete(env, taskId) {
    const id = Number(taskId);
    if (!id || isNaN(id)) return JSON.stringify({ error: 'task_id required' });
    const a = await env.DB.prepare('SELECT id FROM tasks WHERE id=?').bind(id).first();
    if (!a) return JSON.stringify({ error: 'task not found: ' + id });
    await env.DB.prepare('UPDATE tasks SET parent_id=NULL WHERE parent_id=?').bind(id).run();
    await env.DB.prepare('DELETE FROM tasks WHERE id=?').bind(id).run();
    return JSON.stringify({ id, deleted: true });
  },
  // Thread a task under a parent. $1=child task_id, $2=parent task_id (empty to un-thread to top level).
  async taskThread(env, childId, parentId) {
    const cid = Number(childId);
    if (!cid || isNaN(cid)) return JSON.stringify({ error: 'child task_id required' });
    const pid = (parentId == null || String(parentId) === '') ? null : Number(parentId);
    if (pid != null && pid === cid) return JSON.stringify({ error: 'a task cannot be its own parent' });
    const c = await env.DB.prepare('SELECT id FROM tasks WHERE id=?').bind(cid).first();
    if (!c) return JSON.stringify({ error: 'task not found: ' + cid });
    if (pid != null) {
      const p = await env.DB.prepare('SELECT id FROM tasks WHERE id=?').bind(pid).first();
      if (!p) return JSON.stringify({ error: 'parent task not found: ' + pid });
    }
    await env.DB.prepare('UPDATE tasks SET parent_id=? WHERE id=?').bind(pid, cid).run();
    return JSON.stringify({ id: cid, parent_id: pid });
  },

  // ---- LEADS ENGINE: wholesale / white-label peptide outreach pipeline ----
  // METER (minimum proof, 2026-07-28): each billable runner reports its real third-party
  // cost on return (cost_usd + cost_basis + units + object_ids in the result JSON) and adds
  // the cost to the dispatch ctx via env.TRACE_CTX so logInvocation records it. Unit prices
  // verified against the live vendor price sheets on 2026-07-28:
  //   Google Places API (New) Text Search, Enterprise + Atmosphere SKU 120C-BEC3-B48F:
  //   $40.00 per 1,000 requests → $0.04/request. The discover runner's field mask requests
  //   websiteUri/phone (Enterprise fields) + rating (Atmosphere), so that SKU applies.
  //   https://developers.google.com/maps/billing-and-pricing/pricing
  //   xAI grok-4.3: $1.25/M input tokens, $2.50/M output (standard <200k context).
  //   https://docs.x.ai/developers/pricing
  //   gemini-2.5-flash (fallback lane): $0.30/M input, $2.50/M output.
  //   https://ai.google.dev/gemini-api/docs/pricing
  // NPPES, Overpass, DNS-over-HTTPS and plain site fetches are free: cost_usd 0 is a true
  // reading of a free source, not a missing value.
  // TENANT: rows created under a tenant-bound capability are stamped with that tenant_id
  // at insert (env.TRACE_CTX.authContext.tenant_id), exactly as invocations already are.
  // Discover businesses likely to buy peptides wholesale or want white-label, via free
  // OpenStreetMap Overpass (no API key). $1=segment, $2=city, $3=limit(default 40).
  async leadsDiscover(env, segment, city, limitArg) {
    const seg = String(segment || 'medspa').toLowerCase().trim();
    const town = String(city || '').trim();
    if (!town) return JSON.stringify({ error: 'city required, e.g. leadsDiscover medspa "Los Angeles"' });
    const limit = Math.min(200, Math.max(1, parseInt(limitArg || '40', 10) || 40));
    const FILTERS = {
      medspa: ['["shop"="beauty"]', '["shop"="cosmetics"]', '["amenity"="spa"]', '["leisure"="spa"]', '["healthcare"="cosmetic_surgery"]'],
      clinic: ['["amenity"="clinic"]', '["healthcare"="clinic"]', '["healthcare"="centre"]', '["amenity"="doctors"]'],
      wellness: ['["amenity"="clinic"]', '["healthcare"~"."]', '["shop"="nutrition_supplements"]'],
      gym: ['["leisure"="fitness_centre"]', '["leisure"="sports_centre"]'],
      supplement: ['["shop"="nutrition_supplements"]', '["shop"="chemist"]', '["shop"="health_food"]'],
      chiro: ['["healthcare"="chiropractor"]', '["healthcare"="physiotherapist"]', '["healthcare"="rehabilitation"]'],
      massage: ['["shop"="massage"]', '["leisure"="sauna"]'],
      weightloss: ['["healthcare"="dietitian"]', '["healthcare"="nutrition_counselling"]'],
      longevity: ['["healthcare"="alternative"]', '["shop"="herbalist"]'],
    };
    const filters = FILTERS[seg] || FILTERS.medspa;
    const body = filters.map(f => 'nwr' + f + '(area.a);').join('');
    const q = '[out:json][timeout:30];area["name"="' + town.replace(/"/g, '') + '"]->.a;(' + body + ');out tags 300;';
    let data;
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': 'miscsubjects-leadbot/1.0 ([OWNER_EMAIL])' },
        body: 'data=' + encodeURIComponent(q),
      });
      if (!r.ok) return JSON.stringify({ error: 'overpass HTTP ' + r.status });
      data = await r.json();
    } catch (e) { return JSON.stringify({ error: 'overpass fetch failed: ' + (e && e.message || e) }); }
    const els = (data && data.elements) || [];
    const tenant = meterTenant(env);
    const objectIds = [];
    let inserted = 0, skipped = 0, seen = 0;
    for (const el of els) {
      const t = el.tags || {};
      const name = t.name;
      if (!name) continue;
      const website = t.website || t['contact:website'] || t.url || null;
      const phone = t.phone || t['contact:phone'] || null;
      if (!website && !phone) { skipped++; continue; }
      seen++;
      const addr = [t['addr:housenumber'], t['addr:street'], t['addr:city'], t['addr:state'], t['addr:postcode']].filter(Boolean).join(' ') || null;
      const osmCtx = [t.description, t.cuisine, t['healthcare:speciality'], t.shop && ('shop:' + t.shop), t.amenity && ('amenity:' + t.amenity), t.opening_hours && ('hours:' + t.opening_hours)].filter(Boolean).join(' · ') || null;
      const score = (website ? 2 : 0) + (phone ? 1 : 0) + (addr ? 1 : 0);
      try {
        const res = await env.DB.prepare(
          "INSERT INTO leads (created_at,name,segment,city,website,phone,address,context,source,status,score,tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(name,city) DO NOTHING RETURNING id"
        ).bind(buildNowIso(), String(name), seg, town, website, phone, addr, osmCtx, 'osm-overpass', 'new', score, tenant).all();
        const newId = res.results && res.results[0] && res.results[0].id;
        if (newId) { inserted++; objectIds.push('lead:' + newId); }
      } catch (e) { /* dup */ }
    }
    return JSON.stringify({ segment: seg, city: town, overpass_results: els.length, with_contact: seen, inserted_new: inserted,
      units: inserted, meter_unit: 'organization', cost_usd: 0, cost_basis: 'OpenStreetMap Overpass — free public API', tenant_id: tenant, object_ids: objectIds });
  },
  // Discover leads via Google Places API (New) — far better small-business coverage than
  // Overpass. Uses env.GOOGLE_MAPS_KEY (fallback GEMINI_KEY if it has Places enabled).
  // $1=segment(free text, e.g. "medical spa"), $2=city, $3=limit(default 40).
  async leadsDiscoverPlaces(env, segment, city, limitArg) {
    const key = env.GOOGLE_MAPS_KEY || env.GOOGLE_PLACES_KEY || env.GEMINI_KEY;
    if (!key) return JSON.stringify({ error: 'no google key (set GOOGLE_MAPS_KEY)' });
    const seg = String(segment || 'medical spa').trim();
    const town = String(city || '').trim();
    if (!town) return JSON.stringify({ error: 'city required, e.g. leadsDiscoverPlaces "medical spa"|"Newport Beach"' });
    const want = Math.min(60, Math.max(1, parseInt(limitArg || '40', 10) || 40));
    const tenant = meterTenant(env);
    const out = { segment: seg, city: town, source: 'google-places', fetched: 0, inserted_new: 0, with_email_hint: 0 };
    const objectIds = [];
    let pageToken = null, guard = 0, apiRequests = 0;
    do {
      const bodyObj = { textQuery: seg + ' in ' + town, maxResultCount: 20 };
      if (pageToken) bodyObj.pageToken = pageToken;
      let r, j;
      try {
        r = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.primaryType,nextPageToken' },
          body: JSON.stringify(bodyObj),
        });
        apiRequests++;
        j = await r.json();
      } catch (e) { meterCost(env, apiRequests * PLACES_TEXTSEARCH_USD); return JSON.stringify({ ...out, error: 'places fetch failed: ' + (e && e.message || e) }); }
      if (!r.ok) { meterCost(env, apiRequests * PLACES_TEXTSEARCH_USD); return JSON.stringify({ ...out, error: 'places HTTP ' + r.status + ': ' + JSON.stringify(j).slice(0, 300) }); }
      const places = j.places || [];
      for (const p of places) {
        out.fetched++;
        const name = p.displayName && p.displayName.text;
        if (!name) continue;
        const website = p.websiteUri || null;
        const phone = p.nationalPhoneNumber || p.internationalPhoneNumber || null;
        if (!website && !phone) continue;
        const addr = p.formattedAddress || null;
        const ctx = [p.primaryType && ('type:' + p.primaryType), p.rating && ('rating:' + p.rating)].filter(Boolean).join(' · ') || null;
        const score = (website ? 2 : 0) + (phone ? 1 : 0) + (addr ? 1 : 0) + (p.rating ? 1 : 0);
        try {
          const res = await env.DB.prepare(
            "INSERT INTO leads (created_at,name,segment,city,website,phone,address,context,source,status,score,tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(name,city) DO NOTHING RETURNING id"
          ).bind(buildNowIso(), String(name), seg, town, website, phone, addr, ctx, 'google-places', 'new', score, tenant).all();
          const newId = res.results && res.results[0] && res.results[0].id;
          if (newId) { out.inserted_new++; objectIds.push('lead:' + newId); }
        } catch (e) { /* dup */ }
      }
      pageToken = j.nextPageToken || null;
      guard++;
    } while (pageToken && out.fetched < want && guard < 3);
    const costUsd = Math.round(apiRequests * PLACES_TEXTSEARCH_USD * 1e6) / 1e6;
    meterCost(env, costUsd);
    return JSON.stringify({ ...out, units: out.inserted_new, meter_unit: 'organization', api_requests: apiRequests,
      cost_usd: costUsd, cost_basis: 'Google Places Text Search Enterprise + Atmosphere — $40.00/1,000 requests', tenant_id: tenant, object_ids: objectIds });
  },
  // Discover leads from the NPPES NPI Registry — the authoritative federal directory of every
  // licensed US provider. Free, no key. Gives real clinic identity + phone + address (no website;
  // leadsResolveSitesPlaces backfills sites). $1=taxonomy_description, $2=city, $3=state(2-letter), $4=limit.
  async leadsDiscoverNpi(env, taxonomyArg, city, stateArg, limitArg, skipArg, postalArg) {
    const tax = String(taxonomyArg || '').trim();
    const town = String(city || '').trim();
    const state = String(stateArg || '').trim().toUpperCase();
    const postal = String(postalArg || '').trim();
    if (!town && !state && !postal) return JSON.stringify({ error: 'city, state, or postal_code required, e.g. leadsDiscoverNpi "Nurse Practitioner"|Miami|FL' });
    const want = Math.min(200, Math.max(1, parseInt(limitArg || '200', 10) || 200));
    // NPPES returns at most 200 rows per request and pages with skip (ceiling 1200). Without
    // skip, a dense city like Los Angeles silently truncated at its first 200 providers.
    const skip = Math.min(1000, Math.max(0, parseInt(skipArg || '0', 10) || 0));
    const seg = tax ? tax.toLowerCase() : 'provider';
    const tenant = meterTenant(env);
    const objectIds = [];
    const out = { source: 'nppes', taxonomy: tax, city: town, state, postal_code: postal || null, skip, fetched: 0, inserted_new: 0 };
    const params = new URLSearchParams({ version: '2.1', limit: String(want) });
    if (skip) params.set('skip', String(skip));
    if (tax) params.set('taxonomy_description', tax);
    if (town) params.set('city', town);
    if (state) params.set('state', state);
    if (postal) params.set('postal_code', postal);
    let j;
    try {
      const r = await fetch('https://npiregistry.cms.hhs.gov/api/?' + params.toString(), { headers: { accept: 'application/json' } });
      if (!r.ok) return JSON.stringify({ ...out, error: 'nppes HTTP ' + r.status });
      j = await r.json();
    } catch (e) { return JSON.stringify({ ...out, error: 'nppes fetch failed: ' + (e && e.message || e) }); }
    const results = (j && j.results) || [];
    for (const p of results) {
      out.fetched++;
      const b = p.basic || {};
      const name = b.organization_name || [b.first_name, b.last_name].filter(Boolean).join(' ').trim();
      if (!name) continue;
      const loc = (p.addresses || []).find(a => a.address_purpose === 'LOCATION') || (p.addresses || [])[0] || {};
      const phone = loc.telephone_number || null;
      const addr = [loc.address_1, loc.city, loc.state, loc.postal_code].filter(Boolean).join(' ') || null;
      const cityVal = town || loc.city || state || 'US';
      const taxDesc = ((p.taxonomies || []).find(t => t.primary) || (p.taxonomies || [])[0] || {}).desc || tax;
      const ctx = ['npi:' + p.number, taxDesc && ('taxonomy:' + taxDesc)].filter(Boolean).join(' · ') || null;
      const score = (phone ? 1 : 0) + (addr ? 1 : 0);
      try {
        const res = await env.DB.prepare(
          "INSERT INTO leads (created_at,name,segment,city,website,phone,address,context,source,status,score,tenant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(name,city) DO NOTHING RETURNING id"
        ).bind(buildNowIso(), String(name), seg, cityVal, null, phone, addr, ctx, 'nppes', 'new', score, tenant).all();
        const newId = res.results && res.results[0] && res.results[0].id;
        if (newId) { out.inserted_new++; objectIds.push('lead:' + newId); }
      } catch (e) { /* dup */ }
    }
    return JSON.stringify({ ...out, units: out.inserted_new, meter_unit: 'organization', cost_usd: 0,
      cost_basis: 'NPPES NPI Registry — free federal API', tenant_id: tenant, object_ids: objectIds });
  },
  // Backfill missing websites on siteless leads (NPPES rows carry name + phone + address but never a
  // website) so the enrichment crawler can reach them. $1=limit(default 20). $2=segment LIKE filter,
  // e.g. "chiro" (optional; blank = any segment).
  //
  // Three defects this replaced, all measured live on 2026-08-05:
  //
  // 1. The lane could never advance. It selected `(website IS NULL OR website='') AND status='new'
  //    ORDER BY id LIMIT n` and wrote nothing on a miss, so every call re-bought the same head of the
  //    queue — which was five nail salons from an early import (`Best Nails`, `Angel Spa`, …). At
  //    $0.04/request that was $1.00 per call to look up the same five rows forever. Every attempt is
  //    now stamped into notes as resolve:<outcome>, and the query excludes anything already stamped,
  //    so a lookup is bought at most once per lead and the queue always moves.
  //
  // 2. Querying by name+city returned confident wrong businesses. NPPES names are ALL-CAPS legal
  //    entities ("A I M FOR WELLNESS INC", "5150FITNESS"), which Text Search resolves to whatever is
  //    nearest in its index — `5150FITNESS Los Angeles` returned CrossFit 5150 in Signal Hill, a
  //    different business in a different city. The old code then wrote that stranger's website onto
  //    the lead and the crawler harvested the stranger's email. Phone is the join key that actually
  //    identifies a practice, so the lookup is now findplacefromtext by phone number.
  //
  // 3. Phone alone is still not proof of identity. Measured over 60 real chiropractic rows: 56%
  //    resolved to a place, but only 41% of those carried a name agreeing with the NPPES record —
  //    stale numbers now answer for a billing company or an unrelated business (DAISY MED &
  //    CHIRO-CENTER resolved to a restaurant; CAAMANO CHIROPRACTIC NETWORK to a collections agency).
  //    A website is therefore written only when the two names share a token, so outreach can never
  //    be addressed to a business we merely guessed at.
  async leadsResolveSitesPlaces(env, limitArg, segmentArg) {
    const key = env.GOOGLE_MAPS_KEY || env.GOOGLE_PLACES_KEY || env.GEMINI_KEY;
    if (!key) return JSON.stringify({ error: 'no google key (set GOOGLE_MAPS_KEY)' });
    const lim = Math.min(30, Math.max(1, parseInt(limitArg || '20', 10) || 20));
    const seg = String(segmentArg || '').trim();
    // CLAIM AND SELECT IN ONE STATEMENT. Selecting first and stamping after is not enough: run this
    // lane six times in parallel and every worker reads the same unstamped head of the queue, buys the
    // same lookups, and stamps them six times over. Measured on 2026-08-05 — 168 distinct leads were
    // touched by 44 concurrent batches, 124 of them more than once, and $13.79 bought 9 websites at
    // $1.53 each instead of the $0.19 a single-threaded run costs. That is the same re-buying defect
    // this function was just repaired for, re-entering through concurrency.
    //
    // One UPDATE ... RETURNING is atomic, so a lead can be claimed by exactly one caller. The claim
    // stamp is itself a resolve: mark, so the WHERE clause that excludes attempted leads also excludes
    // in-flight ones, and a caller that dies mid-lookup leaves the lead stamped rather than free —
    // losing one lead is the correct trade against paying for it twice.
    const claimSql = "UPDATE leads SET notes = COALESCE(notes || ' ', '') || 'resolve:claimed' WHERE id IN ("
      + "SELECT id FROM leads WHERE (website IS NULL OR website='')"
      + " AND status='new' AND phone IS NOT NULL AND phone<>''"
      + " AND (notes IS NULL OR notes NOT LIKE '%resolve:%')"
      + (seg ? ' AND segment LIKE ?' : '')
      + ' ORDER BY id LIMIT ?) RETURNING id, name, city, phone';
    const st = env.DB.prepare(claimSql);
    const rows = ((seg ? await st.bind('%' + seg + '%', lim).all() : await st.bind(lim).all()).results) || [];
    if (!rows.length) return JSON.stringify({ checked: 0, note: 'no unattempted siteless leads with a phone' });
    // Shared token of 4+ letters between the registry name and the Google name. Short tokens are
    // dropped because "inc", "dc", "the" and "corp" agree with almost anything.
    const tokens = (s) => new Set((String(s || '').toLowerCase().match(/[a-z]{4,}/g) || [])
      .filter((t) => !['inc','corp','group','center','centre','clinic','wellness','health','llc','pllc','associates','family','the'].includes(t)));
    const agrees = (a, b) => { const t = tokens(b); for (const x of tokens(a)) if (t.has(x)) return true; return false; };
    let resolved = 0, name_mismatch = 0, no_website = 0, no_place = 0, apiRequests = 0;
    // Resolve the claim into its outcome, in place, so a lead carries exactly one resolve: mark.
    const stamp = async (id, outcome) => {
      await env.DB.prepare("UPDATE leads SET notes = replace(notes, 'resolve:claimed', ?) WHERE id=?")
        .bind('resolve:' + outcome, id).run();
    };
    for (const l of rows) {
      const digits = String(l.phone).replace(/\D/g, '').slice(-10);
      if (digits.length !== 10) { await stamp(l.id, 'bad_phone'); no_place++; continue; }
      let cand = null;
      try {
        const u = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json?inputtype=phonenumber'
          + '&fields=name,place_id&input=' + encodeURIComponent('+1' + digits) + '&key=' + key;
        const r = await fetch(u);
        apiRequests++;
        const j = await r.json();
        cand = ((j.candidates || [])[0]) || null;
      } catch { /* treated as a miss below */ }
      if (!cand || !cand.place_id) { await stamp(l.id, 'no_place'); no_place++; continue; }
      if (!agrees(l.name, cand.name)) { await stamp(l.id, 'name_mismatch'); name_mismatch++; continue; }
      let site = null;
      try {
        const u = 'https://maps.googleapis.com/maps/api/place/details/json?fields=website,formatted_phone_number'
          + '&place_id=' + encodeURIComponent(cand.place_id) + '&key=' + key;
        const r = await fetch(u);
        apiRequests++;
        const j = await r.json();
        site = (j.result && j.result.website) || null;
      } catch { /* treated as a miss below */ }
      if (!site) { await stamp(l.id, 'no_website'); no_website++; continue; }
      await env.DB.prepare("UPDATE leads SET website=?, notes = replace(notes, 'resolve:claimed', 'resolve:ok') WHERE id=?")
        .bind(site, l.id).run();
      resolved++;
    }
    const costUsd = Math.round(apiRequests * PLACES_FINDPLACE_USD * 1e6) / 1e6;
    meterCost(env, costUsd);
    return JSON.stringify({ checked: rows.length, resolved, name_mismatch, no_website, no_place,
      api_requests: apiRequests, cost_usd: costUsd, cost_per_resolved_usd: resolved ? Math.round(costUsd / resolved * 1e4) / 1e4 : null,
      segment_filter: seg || null,
      cost_basis: 'Google Places Find Place (phone) + Details — $0.017/request each, 2 requests per identified lead' });
  },
  // Enrich one lead: fetch its website, pull the best contact email. $1=lead_id.
  async leadsEnrich(env, leadId) {
    const id = Number(leadId);
    if (!id) return JSON.stringify({ error: 'lead_id required' });
    const lead = await env.DB.prepare('SELECT id, website, email FROM leads WHERE id=?').bind(id).first();
    if (!lead) return JSON.stringify({ error: 'lead not found: ' + id });
    if (lead.email) return JSON.stringify({ id, email: lead.email, note: 'already enriched' });
    if (!lead.website) return JSON.stringify({ id, error: 'no website to scrape' });
    let url = String(lead.website); if (!/^https?:/i.test(url)) url = 'https://' + url;
    // Deep crawl: homepage first (email + context in one shot), then /contact, /contact-us, /about
    // until an email surfaces. Cap 4 fetches per lead; batch size is bounded to stay under the
    // subrequest ceiling. Extracts plain emails, mailto: hrefs, JSON-LD "email", and decodes
    // Cloudflare-obfuscated addresses (data-cfemail) — the single biggest miss of the v1 crawler.
    const base = url.replace(/\/+$/, '');
    const pages = [url, base + '/contact', base + '/contact-us', base + '/about', base + '/team', base + '/providers', base + '/services', base + '/book', base + '/locations', base + '/people', base + '/staff', base + '/press', base + '/media', base + '/research', base + '/legal'];
    const found = new Set();
    let ctx = null;
    const signals = new Set();
    let igHandle = null, sitePhone = null;
    const captureSignals = (html) => {
      const tech = [];
      if (/boulevard|joinblvd/i.test(html)) tech.push('boulevard');
      if (/vagaro/i.test(html)) tech.push('vagaro');
      if (/mindbody/i.test(html)) tech.push('mindbody');
      if (/janeapp|jane\.app/i.test(html)) tech.push('jane');
      if (/acuityscheduling|squarespace-scheduling/i.test(html)) tech.push('acuity');
      if (/calendly/i.test(html)) tech.push('calendly');
      if (/gethealthie|healthie/i.test(html)) tech.push('healthie');
      if (/aestheticrecord|aesthetic record/i.test(html)) tech.push('aesthetic-record');
      for (const t of tech) signals.add('booking:' + t);
      if (!igHandle) { const m = html.match(/instagram\.com\/([A-Za-z0-9_.]{2,30})/i); if (m && !/\/(p|reel|explore|accounts)$/i.test(m[1])) igHandle = m[1]; }
      if (!sitePhone) { const m = html.match(/(?:tel:|\bcall\b[^0-9]{0,8})?(\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})/); if (m) sitePhone = m[1]; }
    };
    const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const junkEmail = (e) => {
      if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/.test(e)) return true;
      if (/(example|sentry|wixpress|\.wix|godaddy|squarespace|schema\.org|domain\.com|email@|yourname|youremail|greensock|gsap|cloudflare|wordpress|jquery|googleapis|gstatic|fontawesome|@2x|@sentry|react|cdn|no-?reply|donotreply)/.test(e)) return true;
      // Site-template placeholders that live in theme demos (proven misses: [REDACTED_EMAIL], [REDACTED_EMAIL], [REDACTED_EMAIL]).
      if (/@(email|mystore|yourdomain|yoursite|mydomain|mywebsite|company|test|sample|placeholder|site|doe)\.com$/.test(e)) return true;
      if (/^(user\d*|janedoe|johndoe|yourbusiness|firstname|lastname|name)@/.test(e)) return true;
      // Site-builder platform domains: [REDACTED_EMAIL] class — the platform's address, not the business's.
      if (/@(webador|weebly|jimdo|site123|godaddysites|wixsite|squarespace|duda|strikingly|carrd)\.(com|co|io)$/.test(e)) return true;
      const dom = e.split('@')[1] || '';
      if (dom && /(js|dev|io|app|cdn)$/.test(dom) && !String(lead.website).toLowerCase().includes(dom.split('.').slice(-2).join('.'))) return true;
      return false;
    };
    const cfDecode = (hex) => {
      try {
        const b = []; for (let i = 0; i < hex.length; i += 2) b.push(parseInt(hex.substr(i, 2), 16));
        const key = b[0]; let out = '';
        for (let i = 1; i < b.length; i++) out += String.fromCharCode(b[i] ^ key);
        return out;
      } catch { return ''; }
    };
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      try {
        const r = await fetch(p, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; miscsubjects-leadbot/1.0)' }, redirect: 'follow', signal: AbortSignal.timeout(7000) });
        if (!r.ok) continue;
        const html = (await r.text()).slice(0, 400000);
        captureSignals(html);
        if (i === 0) {
          const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '';
          const desc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1]
                    || (html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) || [])[1] || '';
          ctx = [title.trim(), desc.trim()].filter(Boolean).join(' — ').replace(/\s+/g, ' ').slice(0, 300) || null;
        }
        let m;
        while ((m = emailRe.exec(html)) !== null) { const e = m[0].toLowerCase(); if (!junkEmail(e)) found.add(e); }
        const mailtoRe = /href=["']mailto:([^"'?]+)/gi;
        while ((m = mailtoRe.exec(html)) !== null) { const e = decodeURIComponent(m[1]).trim().toLowerCase(); if (/@/.test(e) && !junkEmail(e)) found.add(e); }
        const cfRe = /data-cfemail=["']([0-9a-f]+)["']/gi;
        while ((m = cfRe.exec(html)) !== null) { const e = cfDecode(m[1]).toLowerCase(); if (/@/.test(e) && !junkEmail(e)) found.add(e); }
        const ldRe = /"email"\s*:\s*"([^"]+@[^"]+)"/gi;
        while ((m = ldRe.exec(html)) !== null) { const e = m[1].trim().toLowerCase(); if (!junkEmail(e)) found.add(e); }
        if (found.size) break;
      } catch (e) { /* next page */ }
    }
    // Fold captured buying signals (booking software = digital maturity/budget, IG handle = a
    // second outreach channel) into the stored context so ICP scoring and drafting can use them.
    const sigParts = [...signals]; if (igHandle) sigParts.push('ig:@' + igHandle);
    if (sigParts.length) ctx = [ctx, sigParts.join(' · ')].filter(Boolean).join(' · ').slice(0, 500);
    if (sitePhone) { try { await env.DB.prepare("UPDATE leads SET phone=COALESCE(NULLIF(phone,''),?) WHERE id=?").bind(sitePhone, id).run(); } catch {} }
    if (!found.size) { await env.DB.prepare("UPDATE leads SET status='no_email', enrich_claimed_at=NULL, context=COALESCE(?,context) WHERE id=?").bind(ctx, id).run(); return JSON.stringify({ id, email: null, status: 'no_email', context: ctx, signals: sigParts }); }
    const list = Array.from(found);
    // Prefer an email on the lead's own domain (an address scraped off an unrelated embedded
    // link is usually a widget/partner, not the business), then the classic role prefixes.
    const siteDom = String(lead.website).toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].split('.').slice(-2).join('.');
    const onDomain = list.filter(e => siteDom && e.endsWith('@' + siteDom) || (e.split('@')[1] || '').endsWith('.' + siteDom));
    const pool = onDomain.length ? onDomain : list;
    const pref = pool.find(e => /^(info|contact|hello|sales|admin|office|team)@/.test(e)) || pool[0];
    await env.DB.prepare("UPDATE leads SET email=?, status='enriched', enrich_claimed_at=NULL, notes=?, context=COALESCE(?,context) WHERE id=?").bind(pref, 'emails:' + list.slice(0, 5).join(','), ctx, id).run();
    return JSON.stringify({ id, email: pref, context: ctx, all_emails: list.slice(0, 5), status: 'enriched' });
  },
  // Enrich the next N un-enriched leads in one call (bounded so it never hits the subrequest cap:
  // deep crawl = up to 4 fetches per lead, so cap the batch at 8). $1=count(default 6).
  async leadsEnrichBatch(env, countArg) {
    const n = Math.min(8, Math.max(1, parseInt(countArg || '6', 10) || 6));
    // Reclaim only genuinely stale claims, then claim the next batch atomically. Cron and manual
    // calls can overlap; resetting every 'enriching' row lets two workers process the same lead.
    await env.DB.prepare("UPDATE leads SET status='new', enrich_claimed_at=NULL WHERE status='enriching' AND enrich_claimed_at < datetime('now','-15 minutes')").run();
    const rows = (await env.DB.prepare(
      "UPDATE leads SET status='enriching', enrich_claimed_at=datetime('now') WHERE id IN (SELECT id FROM leads WHERE status='new' AND website IS NOT NULL ORDER BY score DESC,id DESC LIMIT ?) RETURNING id"
    ).bind(n).all()).results || [];
    // Parallel: the whole batch finishes in ~one site's time, not the sum. Each lead does <=2 timeout-bounded fetches.
    const done = await Promise.all(rows.map(async (r) => {
      try { const res = JSON.parse(await FN_MAP.leadsEnrich(env, r.id)); return { id: r.id, email: res.email || null, status: res.status }; }
      catch (e) {
        await env.DB.prepare("UPDATE leads SET status='new', enrich_claimed_at=NULL WHERE id=? AND status='enriching'").bind(r.id).run();
        return { id: r.id, error: String(e && e.message || e) };
      }
    }));
    const counts = (await env.DB.prepare('SELECT status, COUNT(*) n FROM leads GROUP BY status').all()).results || [];
    const resolvedCount = done.filter((d) => d.email).length;
    return JSON.stringify({ enriched_this_call: done.length, results: done, by_status: counts,
      units: resolvedCount, meter_unit: 'contact resolved', cost_usd: 0,
      cost_basis: 'direct site fetches — no metered third party',
      object_ids: done.filter((d) => d.email).map((d) => 'lead:' + d.id),
      read_object_ids: rows.map((r) => 'lead:' + r.id) });
  },
  // THE WHOLE ENRICHED LIST ONTO THE SHEET, IN CHUNKS, EACH ONE CONFIRMED BY ITS OWN RECEIPT.
  //
  // What this replaces: the LEADS_SHEET_ENRICHED flow ended in `LIMIT 30`. Not a sample by choice —
  // 5,000 rows produced a health payload, then 2,000, then 400, and 30 was the number that happened
  // to survive. So the sheet showed 30 of 5,841 resolved contacts and looked complete.
  //
  // The transport is the constraint, not the sheet. A POST to the Apps Script /exec URL intermittently
  // loses its body — doGet answers with the health payload, or doPost gets a partial body and throws
  // parsing it — and it happens more often as the payload grows. So: bound each request well under
  // where it starts failing, retry a dropped chunk (the action was valid, it just never arrived), and
  // count only rows the script itself confirmed. The total this returns is receipts summed, never
  // rows attempted.
  //
  // WHY IT IS RESUMABLE AND NOT ONE CALL. 5,841 rows at 500 a chunk is twelve sequential round-trips
  // to Google, and the whole run took longer than Cloudflare's 100-second edge limit — the first
  // attempt came back 524 with the work half done and nothing said about how far it got. So the call
  // does a bounded number of chunks and returns `next_offset`. Offset 0 replaces the tab; any offset
  // above 0 appends. The caller (or AUTOMATE_ADD) keeps calling until next_offset comes back null.
  //
  // $1 = rows per chunk (default 250, capped 500). $2 = start offset (default 0 — replaces the tab).
  // $3 = chunks this call (default 4, capped 8). $4 = max rows total (default all).
  async leadsSheetPush(env, chunkArg, offsetArg, chunksPerCallArg, maxArg) {
    const { checkAirunnerResponse, rowsWritten } = await import('./airunner_contract.js');
    const AIRUNNER = 'https://script.google.com/macros/s/AKfycbx64cVuTOzsWYINX7nlpsflogkubaVmH_0sXhVGJQc2hhnJRJvRb-VaMWTPQnMVBfBcmg/exec';
    const SHEET = '<GOOGLE_SHEET_ID>';
    const TAB = 'LEADS_ENRICHED';
    const chunk = Math.min(500, Math.max(25, parseInt(chunkArg || '250', 10) || 250));
    const offset = Math.max(0, parseInt(offsetArg || '0', 10) || 0);
    const chunksPerCall = Math.min(8, Math.max(1, parseInt(chunksPerCallArg || '4', 10) || 4));
    const max = Math.max(0, parseInt(maxArg || '0', 10) || 0);

    const all = (await env.DB.prepare(
      `SELECT name, city, email, score, COALESCE(website,'') website, COALESCE(status,'') status
         FROM leads WHERE email IS NOT NULL AND length(email) > 0
        ORDER BY score DESC, id DESC` + (max ? ` LIMIT ${max}` : ''),
    ).all()).results || [];
    if (!all.length) return JSON.stringify({ ok: false, error: 'no_leads_with_email' });

    const header = ['name', 'city', 'email', 'score', 'website', 'status'];
    const rows = all.map((r) => header.map((h) => String(r[h] == null ? '' : r[h])));

    // One request per chunk. The first replaces the tab so a re-run is idempotent rather than
    // doubling the sheet; the rest append.
    const send = async (action, payloadRows) => {
      let lastErr = null;
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        let text = '';
        try {
          const r = await fetch(AIRUNNER, {
            method: 'POST', headers: { 'content-type': 'application/json' }, redirect: 'follow',
            body: JSON.stringify({ action, args: { sheet_id: SHEET, tab: TAB, rows: payloadRows } }),
          });
          text = await r.text();
          if (r.status >= 400) { lastErr = `http_${r.status}:${text.slice(0, 160)}`; continue; }
        } catch (e) { lastErr = 'fetch:' + String(e && e.message || e); continue; }
        const verdict = checkAirunnerResponse(action, text);
        if (verdict.ok) return { ok: true, rows: rowsWritten(text), body: text.slice(0, 200) };
        lastErr = verdict.error;
        if (!verdict.retryable) break;
        await new Promise((res) => setTimeout(res, 400 * attempt));
      }
      return { ok: false, error: lastErr };
    };

    const chunks = [];
    for (let i = 0; i < rows.length; i += chunk) chunks.push(rows.slice(i, i + chunk));
    const startChunk = Math.floor(offset / chunk);
    if (startChunk >= chunks.length) {
      return JSON.stringify({ ok: true, done: true, tab: TAB, rows_available: rows.length, offset, next_offset: null, note: 'offset is past the end — nothing left to write.' });
    }

    let confirmed = 0;
    const receipts = [];
    let lastChunk = startChunk - 1;
    for (let i = startChunk; i < chunks.length && i < startChunk + chunksPerCall; i += 1) {
      const action = i === 0 ? 'sheets_replace_tab' : 'sheets_append_rows';
      const body = i === 0 ? [header, ...chunks[0]] : chunks[i];
      const r = await send(action, body);
      receipts.push({ chunk: i + 1, action, sent: chunks[i].length, ok: r.ok, confirmed_rows: r.rows ?? null, detail: r.ok ? r.body : r.error });
      if (r.ok) { confirmed += (r.rows ?? chunks[i].length); lastChunk = i; }
      // A failed chunk stops the run. Continuing would leave a gap in the middle of the tab and
      // report a total that no longer corresponds to any contiguous range. next_offset comes back
      // pointing at the chunk that failed, so the retry resumes exactly there.
      if (!r.ok) break;
    }

    const allOk = receipts.every((r) => r.ok);
    const nextChunk = allOk ? lastChunk + 1 : lastChunk + 1;
    const done = allOk && nextChunk >= chunks.length;
    return JSON.stringify({
      ok: confirmed > 0 && allOk,
      done,
      tab: TAB, rows_available: rows.length, rows_confirmed_written: confirmed,
      offset, next_offset: done ? null : nextChunk * chunk,
      chunks_this_call: receipts.length, chunk_range: [startChunk + 1, lastChunk + 1], chunks_total: chunks.length,
      rows_per_chunk: chunk, receipts,
      note: 'rows_confirmed_written counts this call only, and only rows the script itself confirmed — never rows sent. Keep calling with next_offset until done is true.',
    });
  },
  // A REPORT TO THE OWNER IS SENT WHEN THERE IS EVIDENCE IT ARRIVED, NOT WHEN THE API SAID ok.
  //
  // 2026-08-05, reported twice by the owner: "I have still not received an email to me that I
  // requested." Two sends had returned {ok:true, messageId:"<...@miscsubjects.com>"} and nothing
  // landed. Neither response was a lie and neither was a receipt — env.EMAIL.send() had accepted the
  // message, and that is all ok:true has ever meant.
  //
  // The reason an owner-addressed send is the worst case: /api/email/send injects a BCC to both owner
  // addresses on every outbound message, so a normal send always has the owner as a witness. It
  // deliberately SKIPS that injection when the recipient already is an owner inbox. So the one class
  // of message whose whole purpose is to reach him was also the only class with no second copy and no
  // way to tell a delivered message from a dropped one. "Sent" became unfalsifiable.
  //
  // This is the same shape as the Apps Script health payload and the acceptance runner that could
  // never pass: a success that no evidence distinguishes from a failure.
  //
  // So an owner report goes TO build@miscsubjects.com, which has an MX record pointing at Cloudflare
  // Email Routing and a worker on the far side that ledgers every inbound message and then forwards
  // it to the owner. That buys three things a direct send does not: the message must actually leave
  // Cloudflare and traverse the public internet, its arrival is written to the ledger where this
  // function can read it back, and the last hop to his inbox is an Email Routing forward rather than
  // a fresh send. The owner BCC still rides the same envelope, so he gets it twice by two paths.
  //
  // The return value is the ledger row id or an explicit failure. It never says sent on faith.
  //
  // $1 = subject. $2 = body text. $3 = seconds to wait for the ledger row (default 30, max 60).
  async ownerReport(env, subjectArg, textArg, waitArg) {
    const subject = String(subjectArg || '').trim();
    const text = String(textArg || '').trim();
    if (!subject || !text) return JSON.stringify({ ok: false, error: 'need_subject_and_text' });
    const waitMs = Math.min(60, Math.max(5, parseInt(waitArg || '30', 10) || 30)) * 1000;
    const WITNESS = 'build@miscsubjects.com';

    // ONLY VERIFIED DESTINATIONS CAN RECEIVE ANYTHING. ASK BEFORE SENDING.
    //
    // 2026-08-05, after the owner said three times he had received nothing: an unrestricted
    // send_email binding, and message.forward(), can only reach addresses VERIFIED as destinations in
    // Cloudflare Email Routing. [OWNER_EMAIL] was never in that list. Every message carried it
    // — the first two addressed to it, the next three with it as a BCC on the same envelope — so every
    // message had a recipient that could not be delivered to, while the API still returned ok:true
    // and a messageId.
    //
    // So the recipient list is now built from what Cloudflare says is verified, at send time, and any
    // address that is not verified is named in the result instead of being quietly included and
    // quietly dropped.
    let verified = [];
    let addressCheck = null;
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses`, {
        headers: { authorization: 'Bearer ' + (env.CF_API_TOKEN || ''), 'content-type': 'application/json' },
      });
      const j = await r.json();
      verified = (j?.result || []).filter((a) => a.status === 'verified').map((a) => String(a.email).toLowerCase());
      addressCheck = 'live';
    } catch (e) {
      // If the roster cannot be read, fall back to the one address known to be verified rather than
      // widening the envelope on a guess. A wider envelope is what caused this.
      verified = ['[OWNER_EMAIL]'];  // the one address known verified AND resolving, 2026-08-05
      addressCheck = 'fallback: could not read the destination roster (' + String(e?.message || e) + ')';
    }

    // VERIFIED IS NOT THE SAME AS DELIVERABLE, AND THAT GAP IS THE WHOLE BUG.
    //
    // Cloudflare's `status: verified` is a historical fact: it means a link in a message that arrived
    // was clicked, once. It says nothing about whether the domain resolves NOW. [OWNER_EMAIL] is the
    // proof — Cloudflare still reports it verified (2026-06-02T21:37:16Z, so the mailbox was real and
    // mail did reach it), while the .co registry's delegation to ns1/ns2.dnsimple.com went lame and
    // those nameservers now answer REFUSED, so nothing can be delivered to it today. Trusting the
    // verified flag alone is what let "the owner was bcc'd" mean nothing for weeks.
    //
    // So an address counts as deliverable only if it is BOTH verified as a destination AND its domain
    // resolves an MX right now. Anything verified-but-unresolvable is reported as degraded by name,
    // never silently counted as delivered.
    const wanted = ['[OWNER_EMAIL]', '[OWNER_EMAIL]'];
    async function mxResolves(domain) {
      try {
        const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`, {
          headers: { accept: 'application/dns-json' },
        });
        const j = await r.json();
        return j?.Status === 0 && Array.isArray(j.Answer) && j.Answer.length > 0;
      } catch { return null; }  // unknown, not false: do not condemn an address on our own network error
    }
    const mxByDomain = {};
    for (const d of [...new Set(wanted.map((a) => a.split('@')[1]))]) mxByDomain[d] = await mxResolves(d);
    const resolves = (a) => mxByDomain[a.split('@')[1]] !== false;  // null (unknown) is not a disqualifier
    const deliverable = wanted.filter((a) => verified.includes(a) && resolves(a));
    const undeliverable = wanted.filter((a) => !verified.includes(a) || !resolves(a));
    const degradedAddresses = wanted.filter((a) => verified.includes(a) && !resolves(a));
    if (!deliverable.length) {
      return JSON.stringify({
        ok: false, error: 'no_deliverable_owner_address', addressCheck, undeliverable,
        dns: mxByDomain, degraded: degradedAddresses,
        detail: 'Not one owner address is both a verified Cloudflare Email Routing destination and '
          + 'resolvable right now, so nothing can be delivered and this will not pretend otherwise. '
          + 'If an address is unverified: POST /accounts/<id>/email/routing/addresses {"email":"..."} '
          + 'then click the link Cloudflare sends. If it is verified but its domain does not resolve '
          + '(see the dns field), the mailbox is fine and the DNS delegation is broken — repair it at '
          + 'the registrar; see the note in functions/api/email/send.js.',
      });
    }

    const sent = await fetch('https://miscsubjects.com/api/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY || '' },
      body: JSON.stringify({
        to: WITNESS,
        bcc: deliverable,
        subject: '[OWNER REPORT] ' + subject,
        text,
        from: 'build@miscsubjects.com',
      }),
    });
    const sentText = await sent.text();
    let messageId = null;
    try { messageId = JSON.parse(sentText).messageId || null; } catch { /* keep null */ }
    if (sent.status >= 400 || !messageId) {
      return JSON.stringify({ ok: false, error: 'send_rejected', status: sent.status, detail: sentText.slice(0, 300) });
    }

    // Now wait for the arrival to be written to the ledger. The message has to cross the internet,
    // so this is not instant; 25 seconds has been the observed round trip.
    const idFragment = String(messageId).replace(/^</, '').slice(0, 24);
    const deadline = Date.now() + waitMs;
    let witnessed = null;
    while (Date.now() < deadline && !witnessed) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const q = await env.LEDGER.prepare(
          `SELECT id, ts, request_json FROM events WHERE key='EMAIL_INBOUND' ORDER BY ts DESC LIMIT 8`,
        ).all();
        for (const row of (q.results || [])) {
          if (String(row.request_json || '').includes(idFragment)) { witnessed = row; break; }
        }
      } catch { /* a query failure is not evidence of anything; keep waiting */ }
    }

    if (!witnessed) {
      return JSON.stringify({
        ok: false, error: 'not_witnessed', message_id: messageId,
        detail: `Cloudflare accepted the message but no inbound ledger row carrying ${idFragment} appeared `
          + `within ${waitMs / 1000}s. That is not proof it was lost — it may still be in transit — but it `
          + 'is not proof it arrived either, and this function will not report a send it cannot witness. '
          + 'Check /api/events for EMAIL_INBOUND, and check that Email Routing still has a rule for '
          + WITNESS + '.',
      });
    }
    return JSON.stringify({
      ok: true, message_id: messageId, witnessed_ledger_id: witnessed.id, witnessed_at: witnessed.ts,
      delivered_to: deliverable, not_delivered_to: undeliverable, address_roster: addressCheck,
      // SAY WHAT THIS ROW PROVES AND WHAT IT DOES NOT.
      //
      // The earlier version called this "witnessed" and listed two delivery paths. The ledger row
      // proves the message reached build@miscsubjects.com and the inbound worker ran. It does not
      // prove the BCC copies landed, and it does not prove the forward succeeded — the forward used
      // to swallow its own failure, which is how three reports were called witnessed while the owner
      // received none of them. Both limits are stated here so no reader repeats that.
      witnessed: 'the message reached ' + WITNESS + ' and the inbound worker ran',
      not_witnessed: 'delivery to the owner mailbox itself. The BCC copies and the routing forward are '
        + 'separate hops with no receipt here. A forward failure now writes an EMAIL_FORWARD_FAILED '
        + 'ledger row — check for one before treating this as delivered.',
      dns: mxByDomain,
      degraded: degradedAddresses,
      undeliverable_note: undeliverable.length
        ? undeliverable.join(', ') + ' was left out of the envelope. An address is carried only if it is '
          + 'BOTH a verified Cloudflare destination AND its domain resolves an MX right now — see the dns '
          + 'field for which condition failed. Including an address that fails either one is what '
          + 'silently killed every earlier send.'
        : 'every owner address is a verified destination and resolves right now',
      ...(degradedAddresses.length ? {
        degraded_note: degradedAddresses.join(', ') + ' is a verified destination whose domain does not '
          + 'resolve right now. The mailbox is real and was reachable when it was verified; the DNS '
          + 'delegation is what broke. This is a registrar repair, not a wrong address — do not '
          + 'substitute a different address for it.',
      } : {}),
    });
  },
  // One call = discover a segment+city then enrich a batch. $1=segment, $2=city, $3=discover limit, $4=enrich count.
  async leadsRunCity(env, segment, city, discLimit, enrichCount) {
    const disc = JSON.parse(await FN_MAP.leadsDiscover(env, segment, city, discLimit || '40'));
    if (disc.error) return JSON.stringify({ discover: disc });
    const enr = JSON.parse(await FN_MAP.leadsEnrichBatch(env, enrichCount || '8'));
    return JSON.stringify({ discover: disc, enrich: { enriched_this_call: enr.enriched_this_call }, by_status: enr.by_status });
  },
  // Draft (do NOT send) a wholesale/white-label outreach email for one lead. $1=lead_id, $2=venture(default miscsubjects).
  async leadsDraft(env, leadId, venture) {
    const id = Number(leadId);
    if (!id) return JSON.stringify({ error: 'lead_id required' });
    const lead = await env.DB.prepare('SELECT id, name, segment, city, email, context FROM leads WHERE id=?').bind(id).first();
    if (!lead) return JSON.stringify({ error: 'lead not found: ' + id });
    const brand = String(venture || 'miscsubjects');
    const segWord = ({ medspa: 'med spa', clinic: 'clinic', wellness: 'wellness practice', gym: 'gym', supplement: 'supplement brand' })[lead.segment] || 'business';
    // Weave one specific line from the business's own context so the open reads researched, not blasted.
    let hook = '';
    const ctx = String(lead.context || '');
    if (ctx) {
      // Prefer the site's meta description (after the em-dash), not the <title> (which just repeats the name).
      const parts = ctx.split(' — ');
      const desc = (parts[1] || '').replace(/[^\x20-\x7E]/g, '').trim();
      const nm = lead.name.toLowerCase();
      // Use it only if it reads like a real description and doesn't just echo the business name.
      if (desc.length >= 25 && !desc.toLowerCase().startsWith(nm) && !desc.toLowerCase().includes(nm.slice(0, 12))) {
        hook = ' Saw the work you do — ' + desc.replace(/[.\s]+$/, '').slice(0, 110) + '.';
      }
    }
    const subject = 'Wholesale research peptide pricing — ' + (lead.city || 'your clinic');
    const body =
      'Hello,\n\n' +
      'I handle wholesale supply for ' + brand + '.' + hook + ' We supply research peptides to ' + segWord + 's at half of the price listed on leoresearch.com — you set your own price from there — and can white-label under your own brand.\n\n' +
      'Third-party COA on every lot. Two-day shipping nationwide from Dallas. Samples available.\n\n' +
      'If it is useful, I am glad to answer questions or set up a short call.\n\n' +
      'The ' + brand + ' team\n';
    await env.DB.prepare("UPDATE leads SET draft=?, status='drafted' WHERE id=?").bind(JSON.stringify({ subject, body, venture: brand }), id).run();
    return JSON.stringify({ id, to: lead.email || '(no email yet — run leadsEnrich)', subject, body });
  },
  // MODEL-WRITTEN draft: Grok writes the outreach, grounded in the OUTREACH_DOSSIER row (brand, team,
  // offer, article + store links) + this lead's real context. $1=lead_id, $2=brand(default LeoResearch).
  async leadsDraftAI(env, leadId, venture) {
    const id = Number(leadId);
    if (!id) return JSON.stringify({ error: 'lead_id required' });
    const lead = await env.DB.prepare('SELECT id,name,segment,city,email,website,context,status,score,COALESCE(notes,\'\') notes FROM leads WHERE id=?').bind(id).first();
    if (!lead) return JSON.stringify({ error: 'lead not found: ' + id });
    if (!lead.email) return JSON.stringify({ blocked: true, error: 'verified_email_required', note: 'Nothing drafted. Enrich the lead first.' });
    if (!String(lead.notes).includes('mx:ok')) return JSON.stringify({ blocked: true, error: 'mx_verification_required', note: 'Nothing drafted. Verify MX first.' });
    if (!String(lead.notes).includes('icp:') || Number(lead.score || 0) < 65) return JSON.stringify({ blocked: true, error: 'icp_threshold_not_met', score: Number(lead.score || 0), minimum: 65, note: 'Nothing drafted. Only verified high-fit leads enter copy review.' });
    if (String(lead.context || '').trim().length < 40) return JSON.stringify({ blocked: true, error: 'grounding_context_required', note: 'Nothing drafted. The business site context is too thin for truthful personalization.' });
    const suppressed = await env.DB.prepare('SELECT reason FROM lead_suppressions WHERE lower(email)=lower(?)').bind(lead.email).first();
    if (suppressed) return JSON.stringify({ blocked: true, error: 'recipient_suppressed', reason: suppressed.reason || 'suppressed' });
    const brand = String(venture || 'LeoResearch');
    const dr = await env.DB.prepare("SELECT content FROM directory WHERE key='OUTREACH_DOSSIER'").first();
    const dossier = dr ? String(dr.content || '') : '';
    if (!dossier) return JSON.stringify({ error: 'OUTREACH_DOSSIER row is empty — set the brand/team/offer knowledge first' });
    const cr = await env.DB.prepare("SELECT content FROM directory WHERE key='OUTREACH_CATALOG'").first();
    const catalog = cr ? String(cr.content || '') : '';
    const segWord = ({ medspa: 'med spa', clinic: 'clinic', wellness: 'wellness practice', gym: 'gym', supplement: 'supplement brand' })[lead.segment] || 'business';
    const user =
      'Recipient business: ' + lead.name + ' — a ' + segWord + ' in ' + (lead.city || 'their city') + '.\n' +
      'What they do (from their own site): ' + (lead.context || lead.website || 'unknown') + '.\n\n' +
      'WHOLESALE CATALOG (include this exact list in the email, formatted as a clean list — do not invent items or prices):\n' + catalog + '\n\n' +
      'Write ONE B2B wholesale email from ' + brand + '. It must read like one competent operator wrote it to another — not marketing, not a blast. Follow exactly:\n' +
      '1. SALUTATION: "Hello," on its own line. NEVER "Hi <business> team" / "team at" / any use of the word "team". If a real person first name is known, "Hi <First>,".\n' +
      '2. FIRST LINE = ONE TRUE, SPECIFIC OBSERVATION drawn ONLY from "What they do" above, connected to supply. Name a real thing from their site: a compound or service they actually list, a second location, their booking tool. Examples of the SHAPE (do not copy): "You already list peptides on the site — we supply the raw compounds wholesale." / "You run hormone therapy and medical weight loss — the peptides behind those usually come from a supplier you can switch." The observation must be a plain fact you could point to on their page, then pivot to supply in the same or next sentence. It is FORBIDDEN to compliment, admire, congratulate, or infer ("positioned", "perfectly positioned", "focus on", "committed to", "dedicated to", "expand into", "with your emphasis on"). If "What they do" contains NO concrete hook, skip the observation entirely and open plainly: "We supply research peptides wholesale." A generic or invented observation is worse than none.\n' +
      '3. State the wholesale model plainly, one line: every item is 50% of the price shown on leoresearch.com, they set their own price from there. Wholesale pricing applies from three units — state the minimum plainly and in high register, never as smallness or cheapness. That is the whole pricing story — no kits, no tiers, no volume ladder. White-label available.\n' +
      '4. INCLUDE THE FULL CATALOG LIST above, verbatim, as a clean list — every item WITH its listed price, its wholesale price, and its product link exactly as given. This is the reference the owner requires in the email.\n' +
      '5. One line: third-party COAs available on request; orders ship nationwide from Dallas in approximately two days. NEVER say Austin — the warehouse is Dallas. Do not volunteer samples — samples are discretionary, never the headline offer.\n' +
      '6. ONE soft CTA, phrased as a question they can answer in one word, offering the smallest credible first step in high register — the smallness is conveyed as their convenience, never as price or cheapness. Never state dollar amounts, "just", "only", or "try" in the CTA: e.g. "Would it be useful to run a first order alongside your current supply and review the COAs yourself?" End with one short line telling them how to respond: replies to this email reach us directly; support@leoresearch.com also works. NEVER "reply wholesale" / "reply for the sheet" / "send the sheet" — the list is already here.\n' +
      '7. No clinical, efficacy, treatment, recovery, dosing, or outcome language. Commerce facts only.\n' +
      '8. NO compliance boilerplate in the body — the send system appends the opt-out footer.\n' +
      '9. Sign off with exactly one line: LeoResearch. NEVER a personal name. NEVER the word "team".\n' +
      '10. BREVITY: outside the catalog list, the whole email is under 90 words. Every non-list sentence earns its place or is cut. Plain human register, contractions welcome. BANNED words: cutting-edge, elevate, seamless, revolutionize, unlock, empower, streamline, robust, world-class, game-changer, thrilled, excited, "hope this finds you", "wanted to reach out", "reaching out", "positioned", "perfectly", "expand into", "focus on", "committed to", "dedicated to", "team". No exclamation points. At most one em-dash. If a line sounds like AI, cut it.\n' +
      'SUBJECT: 2-4 words, all lowercase, boring and internal-looking like a note from a colleague — e.g. "peptide wholesale", "reorder costs", "your supplier", "wholesale + coa". NEVER title case, NEVER the word "pricing"/"offer"/"partnership", NEVER a business name, NEVER "Came across".\n' +
      'Return ONLY strict JSON: {"subject": "...", "body": "..."} with \\n for line breaks in body.';
    const g = await callGateway(env, dossier, user, 1200);
    const modelCost = gatewayCostUsd(g);
    meterCost(env, modelCost);
    if (g.err) return JSON.stringify({ error: 'model call failed: ' + g.err, cost_usd: modelCost });
    let parsed = pipeJson(g.text);
    if (!parsed) { try { parsed = JSON.parse(g.text); } catch {} }
    if (!parsed || !parsed.subject || !parsed.body) {
      const mm = String(g.text).match(/\{[\s\S]*\}/);
      if (mm) { try { parsed = JSON.parse(mm[0]); } catch {} }
    }
    if (!parsed || !parsed.subject || !parsed.body) return JSON.stringify({ error: 'model did not return subject/body', raw: String(g.text).slice(0, 300), cost_usd: modelCost });
    // Scrub any personal name AND the banned word "team" from the signoff/body → brand only.
    parsed.body = String(parsed.body)
      .replace(/\bOWNER_FIRST_NAME\s+[OWNER_SURNAME]\b/g, 'LeoResearch')
      .replace(/\bOWNER_FIRST_NAME\b/g, 'LeoResearch')
      .replace(/\bthe\s+LeoResearch\s+team\b/gi, 'LeoResearch')
      .replace(/\bLeoResearch\s+team\b/gi, 'LeoResearch')
      .replace(/\bteam\s+at\s+[A-Z][^\n,.]{0,40}/g, 'Hello')
      .replace(/\bHi\s+[^\n,]{0,50}\bteam\b/gi, 'Hello');
    const draft = { subject: String(parsed.subject), body: String(parsed.body), venture: brand, model: g.fallback ? 'gemini-2.5-flash(fallback)' : 'grok/grok-4.3', by: 'leadsDraftAI' };
    const unsafe = /commonly used|use peptides|used in|support recovery|for recovery|clinical efficacy|treat(?:ment|ing)?|patient outcomes?|healing|therapeutic/i.test(draft.body);
    if (unsafe) return JSON.stringify({ blocked: true, error: 'unsafe_copy_claim', cost_usd: modelCost, note: 'Nothing saved. The model introduced a clinical/use claim; retry the draft.' });
    // HARD SLOP REJECT: AI-tell phrases and any surviving "team" → do not save; force a retry.
    const slop = /\bteam\b|positioned|perfectly|\bexpand(?:ing)? into\b|with your focus|your focus on|focus on (?:your|hormone|wellness|providing)|committed to|dedicated to|cutting[- ]edge|elevate|seamless|revolutioni[sz]e|unlock|empower|streamline|world[- ]class|game[- ]chang|thrilled|excited to|hope this (?:finds|email)|wanted to reach out|reaching out|as a (?:leading|premier)|your commitment/i.test(draft.body + ' ' + draft.subject);
    if (slop) return JSON.stringify({ blocked: true, error: 'slop_or_banned_phrase', cost_usd: modelCost, note: 'Nothing saved. Draft contained an AI-tell / banned phrase (team, positioned, focus on, committed to, etc.); retry.' });
    // SUBJECT contract: 2-4 words, lowercase, internal-looking. Reject title-case, salesy words, business name.
    const subj = String(draft.subject || '').trim();
    const subjWords = subj.split(/\s+/).filter(Boolean);
    const subjBad = subjWords.length > 5 || /pricing|offer|partnership|introduction|opportunity|solution|premium|exclusive/i.test(subj) || /[A-Z]/.test(subj.replace(/COA|RUO/g, '')) || (lead.name && subj.toLowerCase().includes(String(lead.name).toLowerCase().split(/\s+/)[0].toLowerCase()));
    if (subjBad) return JSON.stringify({ blocked: true, error: 'subject_contract', cost_usd: modelCost, note: 'Nothing saved. Subject must be 2-4 lowercase internal words (e.g. "peptide wholesale"), no title case / salesy words / business name; retry.' });
    // The reply-no stop line lives in the send-time footer (leadsSend appends it) — requiring it
    // in the body doubled it and read as boilerplate. Body contract = store mention only.
    if (!/leoresearch\.com/i.test(draft.body)) return JSON.stringify({ blocked: true, error: 'copy_contract_missing', cost_usd: modelCost, note: 'Nothing saved. Draft must mention the store (leoresearch.com).' });
    await env.DB.prepare("UPDATE leads SET draft=?, status='drafted' WHERE id=?").bind(JSON.stringify(draft), id).run();
    return JSON.stringify({ id, to: lead.email || '(no email yet)', subject: draft.subject, body: draft.body, model: draft.model,
      units: 1, meter_unit: 'draft', cost_usd: modelCost,
      cost_basis: g.fallback ? 'gemini-2.5-flash tokens at published rates' : 'grok-4.3 tokens at $1.25/M in, $2.50/M out',
      tokens: g.usage || null, object_ids: ['lead:' + id] });
  },
  // Follow-up sequence for a drafted lead. 40-60% of positive replies come from touches 2-3, not
  // the first send — but each must carry a NEW angle on the SAME thread, never "just checking in".
  // Generates touch 2 (new angle) + touch 3 (honest break-up). $1=lead_id, $2=brand(default LeoResearch).
  async leadsFollowups(env, leadId, venture) {
    const id = Number(leadId);
    if (!id) return JSON.stringify({ error: 'lead_id required' });
    const lead = await env.DB.prepare('SELECT id,name,segment,city,email,context,status,draft,COALESCE(notes,\'\') notes FROM leads WHERE id=?').bind(id).first();
    if (!lead) return JSON.stringify({ error: 'lead not found: ' + id });
    if (!lead.draft) return JSON.stringify({ blocked: true, error: 'no_first_touch', note: 'Draft the first email first (LEADS_DRAFT_AI); the sequence is threaded off it.' });
    let d0 = {}; try { d0 = JSON.parse(lead.draft); } catch {}
    const brand = String(venture || 'LeoResearch');
    const dr = await env.DB.prepare("SELECT content FROM directory WHERE key='OUTREACH_DOSSIER'").first();
    const dossier = dr ? String(dr.content || '') : '';
    const user =
      'This is the FIRST cold email already sent to ' + lead.name + ' (a ' + (lead.segment || 'business') + ' in ' + (lead.city || 'their city') + '):\n' +
      'Subject: ' + (d0.subject || '') + '\n' + (d0.body || '') + '\n\n' +
      'What they do (from their site): ' + (lead.context || 'unknown') + '\n\n' +
      'Write TWO short follow-ups on the SAME thread (reader may not have read the first). Rules:\n' +
      'TOUCH 2 (send day 3-4): a genuinely NEW angle, not a repeat. Pick ONE: the one COA/purity question worth asking whatever supplier they use today; OR white-label (their label on the vial) as margin they do not have now; OR a single concrete number on the reorder-cost gap. Under 60 words. One soft question CTA. Do NOT re-paste the catalog.\n' +
      'TOUCH 3 (send day 7-10): the honest break-up. Give control back: "Is this a not-right-now, or a not-for-us? Either is a fine answer." Under 40 words. This is the last touch.\n' +
      'Every rule from a cold email holds: no "team", no "just checking in", no "following up", no "circling back", no compliments, no clinical/outcome claims, no hype words, no exclamation points, sign "LeoResearch". Each touch shorter than the last.\n' +
      'Return ONLY strict JSON: {"touch2":{"body":"..."},"touch3":{"body":"..."}} with \\n for line breaks.';
    const g = await callGateway(env, dossier, user, 800);
    const modelCost = gatewayCostUsd(g);
    meterCost(env, modelCost);
    if (g.err) return JSON.stringify({ error: 'model call failed: ' + g.err, cost_usd: modelCost });
    let parsed = pipeJson(g.text); if (!parsed) { try { parsed = JSON.parse(g.text); } catch {} }
    if (!parsed) { const mm = String(g.text).match(/\{[\s\S]*\}/); if (mm) { try { parsed = JSON.parse(mm[0]); } catch {} } }
    if (!parsed || !parsed.touch2 || !parsed.touch3) return JSON.stringify({ error: 'model did not return touch2/touch3', raw: String(g.text).slice(0, 300), cost_usd: modelCost });
    const scrub = (t) => String(t || '').replace(/\bOWNER_FIRST_NAME(?:\s+[OWNER_SURNAME])?\b/g, 'LeoResearch').replace(/\b(the\s+)?LeoResearch\s+team\b/gi, 'LeoResearch');
    const seq = { touch2: scrub(parsed.touch2.body), touch3: scrub(parsed.touch3.body) };
    const bad = /\bteam\b|just checking in|following up|circling back|thrilled|excited to|hope this (?:finds|email)/i.test(seq.touch2 + ' ' + seq.touch3);
    if (bad) return JSON.stringify({ blocked: true, error: 'slop_in_followup', note: 'Nothing saved. A follow-up contained a banned filler phrase; retry.', cost_usd: modelCost });
    const merged = Object.assign({}, d0, { followups: seq });
    await env.DB.prepare("UPDATE leads SET draft=? WHERE id=?").bind(JSON.stringify(merged), id).run();
    return JSON.stringify({ id, touch2: seq.touch2, touch3: seq.touch3, model: g.fallback ? 'gemini-2.5-flash(fallback)' : 'grok/grok-4.3',
      units: 1, meter_unit: 'follow-up sequence', cost_usd: modelCost,
      cost_basis: g.fallback ? 'gemini-2.5-flash tokens at published rates' : 'grok-4.3 tokens at $1.25/M in, $2.50/M out',
      tokens: g.usage || null, object_ids: ['lead:' + id] });
  },
  // List leads by status. $1=status (default all).
  // THE DOCUMENTED WAY TO CALL THIS RETURNED NOTHING, AND SAID SO AS IF IT WERE AN ANSWER.
  // This took one argument and treated the whole of it as a status. The build's own outreach
  // rules tell an agent to call it as `status=drafted|limit=20`, so `st` became the literal
  // string "status=drafted|limit=20", matched no row, and the runner answered
  // {"shown":0,"leads":[]} with by_status right beside it saying eleven leads were drafted.
  // A JSON body did the same. Measured 2026-08-05: of the four shapes an agent reaches for,
  // one worked. misc read the documented form out of the rules file, used it, got zero, and
  // correctly concluded the pipeline was empty — then stopped and asked what to do instead.
  // The whole outreach half of that turn was lost to a filter that failed silently.
  //
  // A filter that cannot be parsed is an error. A filter that names a status nothing has is
  // an error. Neither is an empty list, because an empty list is indistinguishable from a
  // true answer and gets believed.
  async leadsList(env, status) {
    const raw = String(status || '').trim();
    const f = {};
    if (raw.startsWith('{')) { try { Object.assign(f, JSON.parse(raw)); } catch { return JSON.stringify({ error: 'bad_json_filter', got: raw.slice(0, 120), note: 'Pass a status word, or key=value pairs joined by |, or valid JSON.' }); } }
    else if (raw.includes('=')) {
      for (const part of raw.split('|')) {
        const m = part.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m) f[m[1].toLowerCase()] = m[2].trim();
        else if (part.trim()) return JSON.stringify({ error: 'bad_filter_segment', got: part.trim(), note: 'Every segment must be key=value. Keys: status, city, segment, limit.' });
      }
    } else if (raw) f.status = raw;

    const KNOWN = ['new', 'enriching', 'enriched', 'drafted', 'sent', 'replied', 'duplicate', 'no_email', 'no_mx', 'no_site', 'rejected'];
    const st = String(f.status || '').trim();
    if (st && !KNOWN.includes(st)) {
      return JSON.stringify({ error: 'unknown_status', got: st, valid: KNOWN, note: 'Nothing was filtered. This is an error, not an empty result.' });
    }
    const lim = Math.min(200, Math.max(1, parseInt(f.limit, 10) || 100));
    const where = []; const bind = [];
    if (st) { where.push('status=?'); bind.push(st); }
    if (f.city) { where.push('city=?'); bind.push(String(f.city)); }
    if (f.segment) { where.push('segment=?'); bind.push(String(f.segment)); }
    const sql = 'SELECT id,name,segment,city,website,email,phone,status,score FROM leads'
      + (where.length ? ' WHERE ' + where.join(' AND ') : '')
      + ' ORDER BY score DESC, id DESC LIMIT ' + lim;
    const rows = (await env.DB.prepare(sql).bind(...bind).all()).results || [];
    const counts = (await env.DB.prepare('SELECT status, COUNT(*) n FROM leads GROUP BY status').all()).results || [];
    // A zero that contradicts the counts beside it is reported as a contradiction, so it is
    // never read as "the pipeline is empty".
    const claimed = st ? (counts.find(c => c.status === st) || {}).n || 0 : counts.reduce((n, c) => n + c.n, 0);
    const out = { filter: Object.keys(f).length ? f : 'all', shown: rows.length, total_matching: claimed, by_status: counts, leads: rows };
    if (!rows.length && claimed > 0) out.error = 'filter_returned_nothing_but_' + claimed + '_rows_exist';
    return JSON.stringify(out);
  },
  // MX verification over enriched emails via DNS-over-HTTPS. A domain with no MX record
  // cannot receive mail — those leads are tagged mx:none and (if not yet drafted) parked
  // as no_mx so drafting/sending never wastes a slot on a dead mailbox. $1 = max leads (default 25).
  async leadsVerifyMx(env, limitArg) {
    const lim = Math.min(50, Math.max(1, parseInt(limitArg || '25', 10) || 25));
    const rows = (await env.DB.prepare(
      "SELECT id, email, status, COALESCE(notes,'') notes FROM leads WHERE email IS NOT NULL AND email != '' AND COALESCE(notes,'') NOT LIKE '%mx:%' ORDER BY id LIMIT ?"
    ).bind(lim).all()).results || [];
    if (!rows.length) return JSON.stringify({ checked: 0, note: 'no unverified emails left' });
    const domainCache = {};
    let ok = 0, none = 0, parked = 0;
    for (const l of rows) {
      const domain = String(l.email).split('@')[1] || '';
      if (!domain) continue;
      if (!(domain in domainCache)) {
        try {
          const r = await fetch('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(domain) + '&type=MX', { headers: { accept: 'application/dns-json' } });
          const j = await r.json();
          domainCache[domain] = Array.isArray(j.Answer) && j.Answer.some(a => a.type === 15);
        } catch { domainCache[domain] = null; }
      }
      const hasMx = domainCache[domain];
      if (hasMx === null) continue;
      const tag = hasMx ? ' mx:ok' : ' mx:none';
      if (hasMx) ok++; else none++;
      if (!hasMx && (l.status === 'enriched' || l.status === 'new')) {
        await env.DB.prepare('UPDATE leads SET notes=?, status=? WHERE id=?').bind((l.notes + tag).trim(), 'no_mx', l.id).run();
        parked++;
      } else {
        await env.DB.prepare('UPDATE leads SET notes=? WHERE id=?').bind((l.notes + tag).trim(), l.id).run();
      }
    }
    return JSON.stringify({ checked: rows.length, mx_ok: ok, mx_none: none, parked_no_mx: parked, domains_queried: Object.keys(domainCache).length,
      units: Object.keys(domainCache).length, meter_unit: 'domain checked', cost_usd: 0,
      cost_basis: 'Cloudflare DNS-over-HTTPS — free public resolver',
      object_ids: rows.map((l) => 'lead:' + l.id) });
  },
  // AI ICP scoring: one Grok call scores a batch of enriched leads on wholesale/white-label fit
  // grounded in the OUTREACH_DOSSIER. Writes score (0-100) + an icp: note with buyer type and
  // reason, so LEADS_LIST ordering becomes commercial fit instead of has-a-website. $1 = batch size (default 8).
  async leadsScoreAI(env, countArg) {
    const n = Math.min(10, Math.max(1, parseInt(countArg || '8', 10) || 8));
    const rows = (await env.DB.prepare(
      "SELECT id, name, segment, city, substr(COALESCE(context,''),1,400) context, COALESCE(notes,'') notes FROM leads WHERE status IN ('enriched','drafted') AND email IS NOT NULL AND email!='' AND COALESCE(notes,'') LIKE '%mx:ok%' AND COALESCE(notes,'') NOT LIKE '%icp:%' ORDER BY score DESC,id LIMIT ?"
    ).bind(n).all()).results || [];
    if (!rows.length) return JSON.stringify({ scored: 0, note: 'no unscored enriched leads left' });
    const dr = await env.DB.prepare("SELECT content FROM directory WHERE key='OUTREACH_DOSSIER'").first();
    const dossier = dr ? String(dr.content || '') : '';
    if (!dossier) return JSON.stringify({ error: 'OUTREACH_DOSSIER row is empty — set the brand/team/offer knowledge first' });
    const user =
      'Score each business below as a wholesale/white-label peptide buyer for the venture in the dossier.\n' +
      'Leads: ' + JSON.stringify(rows.map(r => ({ id: r.id, name: r.name, segment: r.segment, city: r.city, about: r.context }))) + '\n\n' +
      'For each, judge: does this business plausibly BUY peptides at volume (clinic protocols, med-spa services, resale), ' +
      'who the buyer is, and how much volume is realistic. Penalize pure consumer gyms, marketing-agency pages, and anything not a real operating business. ' +
      'Return ONLY strict JSON: [{"id":<lead id>,"icp_fit":<0-100>,"buyer":"clinic_buyer|medspa_owner|practitioner|reseller|gym_owner|other","volume":"low|med|high","reason":"<max 120 chars, concrete>"}]';
    const g = await callGateway(env, dossier, user, 1600);
    const modelCost = gatewayCostUsd(g);
    meterCost(env, modelCost);
    if (g.err) return JSON.stringify({ error: 'model call failed: ' + g.err, cost_usd: modelCost });
    let parsed = pipeJson(g.text);
    if (!parsed) { const mm = String(g.text).match(/\[[\s\S]*\]/); if (mm) { try { parsed = JSON.parse(mm[0]); } catch {} } }
    if (!Array.isArray(parsed)) return JSON.stringify({ error: 'model did not return a JSON array', raw: String(g.text).slice(0, 300), cost_usd: modelCost });
    const byId = Object.fromEntries(rows.map(r => [r.id, r]));
    let scored = 0;
    const results = [];
    for (const s of parsed) {
      const lead = byId[Number(s.id)];
      if (!lead || typeof s.icp_fit !== 'number') continue;
      const fit = Math.min(100, Math.max(0, Math.round(s.icp_fit)));
      const tag = ' icp:' + fit + ' buyer:' + String(s.buyer || 'other').slice(0, 20) + ' vol:' + String(s.volume || '?').slice(0, 4) + ' why:' + String(s.reason || '').replace(/\s+/g, ' ').slice(0, 120);
      await env.DB.prepare('UPDATE leads SET score=?, notes=? WHERE id=?').bind(fit, (lead.notes + tag).trim(), lead.id).run();
      scored++;
      results.push({ id: lead.id, name: lead.name, icp_fit: fit, buyer: s.buyer, volume: s.volume, reason: s.reason });
    }
    return JSON.stringify({ scored, model: g.fallback ? 'gemini-2.5-flash(fallback)' : 'grok/grok-4.3', results,
      units: scored, meter_unit: 'lead scored', cost_usd: modelCost,
      cost_basis: g.fallback ? 'gemini-2.5-flash tokens at published rates' : 'grok-4.3 tokens at $1.25/M in, $2.50/M out',
      tokens: g.usage || null, object_ids: results.map((r) => 'lead:' + r.id) });
  },
  // Send ONE lead's drafted email via the miscsubjects email channel.
  // HARD-GATED: $1 must equal CONFIRM, $2=lead_id, $3=from_local.
  // Send a tracked email (open pixel + wrapped click links) and record it in email_sends for
  // full visibility + engagement. $1 = JSON {to, subject, body, kind?, lead_id?, from?, from_name?, reply_to?}.
  // Links in the body are rewritten to /api/t/c/<id> and a 1x1 /api/t/o/<id>.gif pixel is appended.
  async emailSendTracked(env, raw) {
    let p; try { p = JSON.parse(String(raw || '{}')); } catch { return JSON.stringify({ error: 'body must be JSON {to,subject,body,...}' }); }
    const to = String(p.to || '').trim();
    const subject = String(p.subject || '').trim();
    const body = String(p.body || '');
    if (!to || !subject || !body) return JSON.stringify({ error: 'to, subject, body required' });
    const kind = String(p.kind || 'outreach');
    const leadId = p.lead_id != null ? Number(p.lead_id) : null;
    // Accept both a local part ("build") and a full address ("build@miscsubjects.com"):
    // stripping '@' from a full address produced From: buildmiscsubjects.com@miscsubjects.com
    // on the 2026-08-04 wave (owner-caught). Take the local part first, then sanitize.
    const fromLocal = String(p.from || 'build').split('@')[0].replace(/[^a-z0-9._-]/gi, '') || 'build';
    const id = 'es_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 20) : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)));
    const base = 'https://miscsubjects.com/api/t';
    // Internal review mail (kind=draft-review) gets NO tracking: wrapped links make the visible
    // leoresearch.com text point at a miscsubjects.com redirect — a text/destination mismatch on a
    // dozen links, which is what spam filters flag as phishing. Proven 2026-07-24: the Draft N/8
    // batch (13 wrapped links each) went to the owner's spam box; earlier low-link mail inboxed.
    const internal = kind === 'draft-review';
    // Click-wrapping is OPT-IN (p.track_clicks) as of 2026-08-04, owner-caught: replacing the
    // letter's proof URLs with base64 redirect blobs made the receipts unclickable in the
    // plain-text part and put a text/destination mismatch on every HTML link — the letter's
    // thesis is that every claim resolves to a checkable receipt, so links arrive verbatim.
    // Opens stay measured by the pixel; the real click signal is the ledger itself
    // (self_scope_mint / inspect receipts) when a recipient's AI walks through /start.
    const trackClicks = p.track_clicks === true && !internal;
    const wrap = (url) => (trackClicks ? base + '/c/' + id + '?u=' + encodeURIComponent(btoa(url)) : url);
    const urlRe = /(https?:\/\/[^\s<>()"']+)/g;
    const textTracked = trackClicks ? body.replace(urlRe, (m) => wrap(m)) : body;
    // When the caller supplies p.html, it IS the html part (the build's letter format):
    // rewrite only href targets for click tracking and append the pixel. Escaping a caller's
    // html into visible markup was the 2026-07-30 plain-HTML-in-inbox defect.
    let htmlBody;
    if (p.html) {
      htmlBody = String(p.html).replace(/href="(https?:\/\/[^"]+)"/g, (m, u) => 'href="' + wrap(u) + '"');
    } else {
      htmlBody = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(urlRe, (m) => '<a href="' + wrap(m) + '">' + m + '</a>').replace(/\n/g, '<br>\n');
    }
    const html = htmlBody + (internal ? '' : '<img src="' + base + '/o/' + id + '.gif" width="1" height="1" style="display:none" alt="">');
    let status = 0, resp = '';
    try {
      const r = await fetch('https://miscsubjects.com/api/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY },
        // Identity law: the build identifies only as itself. LeoResearch as a DEFAULT here put
        // a commercial venture's name on build mail (owner-caught 2026-07-30). A venture name is
        // now opt-in only, via explicit p.from_name from the leads lane.
        body: JSON.stringify({ to, subject, text: textTracked, html, from: fromLocal + '@miscsubjects.com', from_name: p.from_name || 'miscsubjects build', reply_to: p.reply_to || 'build@miscsubjects.com' }),
      });
      status = r.status; resp = (await r.text()).slice(0, 200);
    } catch (e) { resp = 'fetch:' + (e && e.message || e); }
    try {
      await env.DB.prepare(
        'INSERT INTO email_sends (id,lead_id,to_email,from_email,subject,body,kind,sent_at,send_status) VALUES (?,?,?,?,?,?,?,?,?)'
      ).bind(id, leadId, to, fromLocal + '@miscsubjects.com', subject, textTracked, kind, buildNowIso(), status).run();
    } catch (e) { return JSON.stringify({ id, to, subject, send_status: status, warn: 'sent but not recorded: ' + (e && e.message || e), response: resp }); }
    return JSON.stringify({ id, to, subject, kind, send_status: status, open_pixel: base + '/o/' + id + '.gif', response: resp });
  },
  // Leads exposed as canonical CONTACT objects (person/business contact records) — the object
  // logic fits the OIP shape without making each lead a directory row. A contact is a first-class
  // object with channels (email/phone/instagram), fit score, signals, and provenance.
  async contactGet(env, idArg) {
    const id = Number(String(idArg || '').replace(/^contact:/, ''));
    if (!id) return JSON.stringify({ error: 'contact id required (lead id or contact:<id>)' });
    const l = await env.DB.prepare("SELECT id,name,segment,city,website,email,phone,status,score,source,context,COALESCE(notes,'') notes FROM leads WHERE id=?").bind(id).first();
    if (!l) return JSON.stringify({ error: 'contact not found: ' + id });
    const igm = String(l.context || '').match(/ig:@([A-Za-z0-9_.]+)/);
    const booking = (String(l.context || '').match(/booking:([a-z+-]+)/) || [])[1] || null;
    return JSON.stringify({
      object_type: 'contact', id: 'contact:' + l.id, lead_id: l.id,
      name: l.name, business: l.name, segment: l.segment, city: l.city,
      channels: { email: l.email || null, phone: l.phone || null, website: l.website || null, instagram: igm ? igm[1] : null },
      fit_score: l.score, status: l.status, source: l.source,
      signals: { booking_software: booking, mx: /mx:ok/.test(l.notes) ? 'ok' : (/mx:none/.test(l.notes) ? 'none' : null), icp: (String(l.notes).match(/icp:[^,]*/) || [])[0] || null },
      context: l.context || null,
    });
  },
  // List contact objects with optional status/segment/city filter. $1 = JSON {status?,segment?,city?,limit?} or a bare status.
  async contactsList(env, raw) {
    let f = {}; const s = String(raw || '').trim();
    if (s.startsWith('{')) { try { f = JSON.parse(s); } catch {} } else if (s) { f.status = s; }
    const lim = Math.min(200, Math.max(1, parseInt(f.limit || '50', 10) || 50));
    const where = []; const bind = [];
    if (f.status) { where.push('status=?'); bind.push(String(f.status)); }
    if (f.segment) { where.push('segment=?'); bind.push(String(f.segment)); }
    if (f.city) { where.push('city=?'); bind.push(String(f.city)); }
    const sql = 'SELECT id,name,segment,city,email,phone,status,score FROM leads' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY score DESC, id DESC LIMIT ?';
    bind.push(lim);
    const rows = (await env.DB.prepare(sql).bind(...bind).all()).results || [];
    const counts = (await env.DB.prepare('SELECT status, COUNT(*) n FROM leads GROUP BY status').all()).results || [];
    return JSON.stringify({ object_type: 'contact', filter: f, by_status: counts, shown: rows.length, contacts: rows.map(r => ({ id: 'contact:' + r.id, lead_id: r.id, name: r.name, segment: r.segment, city: r.city, email: r.email, phone: r.phone, status: r.status, fit_score: r.score })) });
  },
  // Visibility: list recent sent emails with open/click engagement + totals. $1 = limit (default 50).
  async emailsSent(env, limitArg) {
    const lim = Math.min(300, Math.max(1, parseInt(limitArg || '50', 10) || 50));
    const rows = (await env.DB.prepare(
      'SELECT id,lead_id,to_email,subject,kind,sent_at,send_status,opens,first_open_at,clicks,first_click_at FROM email_sends ORDER BY sent_at DESC LIMIT ?'
    ).bind(lim).all()).results || [];
    const agg = (await env.DB.prepare(
      'SELECT COUNT(*) sent, SUM(CASE WHEN opens>0 THEN 1 ELSE 0 END) opened, SUM(CASE WHEN clicks>0 THEN 1 ELSE 0 END) clicked FROM email_sends'
    ).first()) || {};
    return JSON.stringify({ totals: agg, shown: rows.length, sends: rows });
  },
  async leadsSend(env, confirm, leadId, fromLocal) {
    if (String(confirm || '').trim().toUpperCase() !== 'CONFIRM') {
      return JSON.stringify({
        blocked: true,
        error: 'explicit_confirmation_required',
        note: 'Nothing sent. LEADS_SEND requires CONFIRM|lead_id|from_local.',
      });
    }
    const id = Number(leadId);
    if (!id) return JSON.stringify({ error: 'lead_id required' });
    const lead = await env.DB.prepare("SELECT id,name,email,status,draft,score,COALESCE(notes,'') notes FROM leads WHERE id=?").bind(id).first();
    if (!lead) return JSON.stringify({ error: 'lead not found: ' + id });
    if (!lead.email) return JSON.stringify({ error: 'no email for lead ' + id });
    if (lead.status !== 'drafted') return JSON.stringify({ error: 'lead ' + id + ' is ' + lead.status + ', not drafted — draft it first' });
    if (!String(lead.notes).includes('mx:ok')) return JSON.stringify({ blocked: true, error: 'mx_verification_required', note: 'Nothing sent.' });
    if (!String(lead.notes).includes('icp:') || Number(lead.score || 0) < 65) return JSON.stringify({ blocked: true, error: 'icp_threshold_not_met', score: Number(lead.score || 0), minimum: 65, note: 'Nothing sent.' });
    const suppressed = await env.DB.prepare('SELECT reason FROM lead_suppressions WHERE lower(email)=lower(?)').bind(lead.email).first();
    if (suppressed) return JSON.stringify({ blocked: true, error: 'recipient_suppressed', reason: suppressed.reason || 'suppressed', note: 'Nothing sent.' });
    const settings = await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('outreach_postal_address','outreach_sending_domain_ready')").all();
    const cfg = Object.fromEntries((settings.results || []).map(r => [r.key, r.value]));
    // Two footer modes. Commercial solicitation (the default) carries the advertisement footer
    // and requires the configured business postal address. A feedback request (draft.footer =
    // 'feedback') is not commercial solicitation: no advertisement line, no postal address, no
    // identifying information of any kind — only the reply-no stop line. Owner ruling 2026-07-30.
    let dMode = {}; try { dMode = JSON.parse(lead.draft || '{}'); } catch {}
    const feedbackMode = dMode.footer === 'feedback';
    if (!feedbackMode && !String(cfg.outreach_postal_address || '').trim()) return JSON.stringify({ blocked: true, error: 'postal_address_required', note: 'Nothing sent. Set settings.outreach_postal_address to the valid business postal address required for commercial email.' });
    // IDENTITY GUARD (owner law, 2026-07-30, never weaken): build feedback mail identifies only
    // as the build itself. No owner name, no person's name, no postal address, no business name,
    // no compliance-footer phrasing. Refuses the send outright on any match.
    if (feedbackMode) {
      const banned = /leoresearch|loop\s*bio|l\s*brands|advertisement\s+from|reply\s+no\b|not\s+solicited|will\s+not\s+follow\s+up|the owner|[OWNER_SURNAME]|dsco\.co|\b\d{1,5}\s+[A-Z][a-z]+\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Lane|Ln)\b/i;
      const hit = (String(dMode.subject || '') + '\n' + String(dMode.body || '')).match(banned);
      if (hit) return JSON.stringify({ blocked: true, error: 'identity_guard', matched: hit[0], note: 'Nothing sent. Build feedback mail may not carry a person, business, address, or compliance-footer phrase.' });
    }
    if (String(cfg.outreach_sending_domain_ready || '') !== '1') return JSON.stringify({ blocked: true, error: 'sending_domain_not_ready', note: 'Nothing sent. Set settings.outreach_sending_domain_ready=1 only after From-domain SPF/DKIM/DMARC alignment is proven.' });
    let d = {}; try { d = JSON.parse(lead.draft || '{}'); } catch {}
    if (!d.subject || !d.body) return JSON.stringify({ error: 'lead ' + id + ' has no usable draft' });
    const prior = await env.DB.prepare(
      "SELECT id,name FROM leads WHERE id<>? AND status='sent' AND LOWER(email)=LOWER(?) ORDER BY id LIMIT 1"
    ).bind(id, lead.email).first();
    if (prior) {
      return JSON.stringify({
        blocked: true,
        error: 'recipient_already_sent',
        note: 'Nothing sent. This email address was already used by lead ' + prior.id + ' (' + prior.name + ').',
        prior_lead_id: prior.id,
      });
    }
    const local = String(fromLocal || 'build').replace(/[^a-z0-9._-]/gi, '');
    let res, err;
    try {
      const r = await fetch('https://miscsubjects.com/api/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY },
        body: JSON.stringify({ to: lead.email, subject: d.subject, text: feedbackMode ? d.body.replace(/\s+$/,'') : d.body.replace(/\s+$/,'') + '\n\nAdvertisement from ' + (d.venture || 'LeoResearch') + '\n' + cfg.outreach_postal_address + '\nIf this is not relevant, reply no and I will not follow up.', from: local + '@miscsubjects.com', from_name: feedbackMode ? 'miscsubjects.com' : (d.venture || 'LeoResearch'), reply_to: feedbackMode ? 'loop@miscsubjects.com' : (d.reply_to || 'support@leoresearch.com') }),
      });
      res = await r.text(); if (!r.ok) err = 'HTTP ' + r.status;
    } catch (e) { err = 'fetch:' + (e && e.message || e); }
    if (err) return JSON.stringify({ id, error: 'send failed: ' + err, detail: String(res).slice(0, 200) });
    await env.DB.prepare("UPDATE leads SET status='sent' WHERE id=?").bind(id).run();
    return JSON.stringify({ id, to: lead.email, subject: d.subject, status: 'sent', response: String(res).slice(0, 200) });
  },
  // Send a batch of drafted leads. HARD-GATED: $1 must equal the word CONFIRM, $2 = max count (cap 25).
  // Refuses without CONFIRM so it can never accidentally blast.
  async leadsSendBatch(env, confirm, maxArg) {
    if (String(confirm || '').trim().toUpperCase() !== 'CONFIRM') {
      const ready = await env.DB.prepare("SELECT COUNT(*) n FROM leads WHERE status='drafted' AND email IS NOT NULL").first();
      return JSON.stringify({ blocked: true, note: 'Refusing to send without CONFIRM. Call LEADS_SEND_BATCH CONFIRM|N to send N.', drafted_ready: ready ? ready.n : 0 });
    }
    const n = Math.min(25, Math.max(1, parseInt(maxArg || '10', 10) || 10));
    const rows = (await env.DB.prepare("SELECT id FROM leads WHERE status='drafted' AND email IS NOT NULL AND score>=65 AND COALESCE(notes,'') LIKE '%mx:ok%' ORDER BY score DESC,id DESC LIMIT ?").bind(n).all()).results || [];
    const sent = [];
    for (const r of rows) { try { sent.push(JSON.parse(await FN_MAP.leadsSend(env, 'CONFIRM', r.id))); } catch (e) { sent.push({ id: r.id, error: String(e && e.message || e) }); } }
    return JSON.stringify({ sent_count: sent.filter(s => s.status === 'sent').length, attempted: sent.length, results: sent });
  },
  // SCRAPER 2: Grok live web search discovers businesses OSM does not have.
  // $1=segment, $2=city, $3=count(default 20, cap 30). Inserts source='grok-live-search'.
  async leadsDiscoverAI(env, segment, city, countArg) {
    const seg = String(segment || 'medspa').toLowerCase().trim();
    const town = String(city || '').trim();
    if (!town) return JSON.stringify({ error: 'city required, e.g. leadsDiscoverAI medspa|Scottsdale' });
    const n = Math.min(30, Math.max(5, parseInt(countArg || '20', 10) || 20));
    const segWord = ({ medspa: 'med spas / aesthetic clinics', clinic: 'medical clinics', wellness: 'wellness centers', gym: 'gyms / fitness studios', supplement: 'supplement stores', chiro: 'chiropractic / physical therapy practices', massage: 'massage / recovery studios', weightloss: 'weight-loss / nutrition clinics', longevity: 'longevity / IV-therapy / functional-medicine clinics' })[seg] || seg + ' businesses';
    const g = await xaiSearch(env,
      'You are a lead researcher. You output ONLY a strict JSON array, no prose, no markdown fence.',
      'Find ' + n + ' real, currently-operating ' + segWord + ' in ' + town + '. Independent/local businesses preferred over national chains. For each return its exact business name and official website. Output ONLY: [{"name":"...","website":"https://..."}]. Skip any business whose official website you cannot verify.',
      3000);
    if (g.err) return JSON.stringify({ error: 'live search failed: ' + g.err });
    let arr = pipeJson(g.text);
    if (!Array.isArray(arr)) { const mm = String(g.text).match(/\[[\s\S]*\]/); if (mm) { try { arr = JSON.parse(mm[0]); } catch {} } }
    if (!Array.isArray(arr)) return JSON.stringify({ error: 'model did not return a JSON array', raw: String(g.text).slice(0, 200) });
    let inserted = 0, skipped = 0;
    for (const b of arr) {
      const name = String(b && b.name || '').trim();
      let site = String(b && b.website || '').trim();
      if (!name || !/^https?:\/\/|^www\./i.test(site)) { skipped++; continue; }
      if (!/^https?:/i.test(site)) site = 'https://' + site;
      try {
        const res = await env.DB.prepare(
          "INSERT INTO leads (created_at,name,segment,city,website,source,status,score) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(name,city) DO NOTHING"
        ).bind(buildNowIso(), name, seg, town, site, 'grok-live-search', 'new', 2).run();
        if (res.meta && res.meta.changes) inserted++; else skipped++;
      } catch (e) { skipped++; }
    }
    return JSON.stringify({ segment: seg, city: town, model_returned: arr.length, inserted_new: inserted, skipped_dup_or_bad: skipped, source: 'grok-live-search' });
  },
  // Rescue websiteless leads: ONE Grok live-search call finds official websites for a batch of
  // leads that have a name+city but no site (OSM often lacks the website tag). $1=count(default 8, cap 10).
  async leadsFindSites(env, countArg) {
    const n = Math.min(10, Math.max(1, parseInt(countArg || '8', 10) || 8));
    const rows = (await env.DB.prepare("SELECT id,name,city,segment FROM leads WHERE status='new' AND website IS NULL ORDER BY score DESC, id ASC LIMIT ?").bind(n).all()).results || [];
    if (!rows.length) return JSON.stringify({ note: 'no websiteless new leads', found: 0 });
    const listing = rows.map(r => r.id + '. ' + r.name + ' — ' + r.segment + ' in ' + r.city).join('\n');
    const g = await xaiSearch(env,
      'You are a lead researcher. You output ONLY a strict JSON array, no prose, no markdown fence.',
      'For each business below, find its official website (not Yelp/Facebook/Instagram — the business\'s own domain). If you cannot verify one, use null.\n' + listing + '\nOutput ONLY: [{"id":<number>,"website":"https://..." or null}]',
      2000);
    if (g.err) return JSON.stringify({ error: 'live search failed: ' + g.err });
    let arr = pipeJson(g.text);
    if (!Array.isArray(arr)) { const mm = String(g.text).match(/\[[\s\S]*\]/); if (mm) { try { arr = JSON.parse(mm[0]); } catch {} } }
    if (!Array.isArray(arr)) return JSON.stringify({ error: 'model did not return a JSON array', raw: String(g.text).slice(0, 200) });
    let found = 0, missed = 0;
    const byId = new Map(rows.map(r => [r.id, r]));
    for (const a of arr) {
      const id = Number(a && a.id);
      let site = a && a.website ? String(a.website).trim() : '';
      if (!byId.has(id)) continue;
      if (site && /^(https?:\/\/|www\.)/i.test(site) && !/(yelp|facebook|instagram|google\.com\/maps|linkedin)\./i.test(site)) {
        if (!/^https?:/i.test(site)) site = 'https://' + site;
        await env.DB.prepare("UPDATE leads SET website=?, notes=COALESCE(notes,'')||' site:grok-live-search' WHERE id=?").bind(site, id).run();
        found++;
      } else {
        await env.DB.prepare("UPDATE leads SET status='no_site' WHERE id=?").bind(id).run();
        missed++;
      }
    }
    return JSON.stringify({ checked: rows.length, sites_found: found, no_site: missed, note: 'found leads stay status=new — LEADS_ENRICH_BATCH picks them up next' });
  },
  // Second pass over no_email leads with the deep crawler (mailto/cfemail/JSON-LD were not in v1).
  // $1=count(default 6, cap 8).
  async leadsReenrich(env, countArg) {
    const n = Math.min(8, Math.max(1, parseInt(countArg || '6', 10) || 6));
    const rows = (await env.DB.prepare("SELECT id FROM leads WHERE status='no_email' AND website IS NOT NULL AND (notes IS NULL OR notes NOT LIKE '%deep2%') ORDER BY score DESC, id ASC LIMIT ?").bind(n).all()).results || [];
    if (!rows.length) return JSON.stringify({ note: 'no unreprocessed no_email leads', rescued: 0 });
    const done = await Promise.all(rows.map(async (r) => {
      try { const res = JSON.parse(await FN_MAP.leadsEnrich(env, r.id)); return { id: r.id, email: res.email || null, status: res.status }; }
      catch (e) { return { id: r.id, error: String(e && e.message || e) }; }
    }));
    const ids = rows.map(r => r.id);
    await env.DB.prepare("UPDATE leads SET notes=COALESCE(notes,'')||' deep2' WHERE id IN (" + ids.map(() => '?').join(',') + ") AND status='no_email'").bind(...ids).run();
    const rescued = done.filter(d => d.email).length;
    return JSON.stringify({ reprocessed: done.length, rescued, results: done });
  },
  // Multi-city sweep: one segment across up to 3 cities (comma-separated) + one enrich batch.
  // $1=segment, $2="City A,City B,City C", $3=per-city discover limit (default 40).
  async leadsSweep(env, segment, citiesArg, limitArg) {
    const seg = String(segment || 'medspa').toLowerCase().trim();
    const cities = String(citiesArg || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
    if (!cities.length) return JSON.stringify({ error: 'cities required, e.g. leadsSweep medspa|Phoenix,Scottsdale,Houston' });
    const out = [];
    for (const c of cities) { try { out.push(JSON.parse(await FN_MAP.leadsDiscover(env, seg, c, limitArg || '40'))); } catch (e) { out.push({ city: c, error: String(e && e.message || e) }); } }
    const enr = JSON.parse(await FN_MAP.leadsEnrichBatch(env, '6'));
    return JSON.stringify({ segment: seg, cities: out, enrich: { enriched_this_call: enr.enriched_this_call }, by_status: enr.by_status });
  },

  // ---- SHARED WORK THREAD: the one append-only stream every model reads first and appends to ----
  // Append one entry. $1=actor (model/agent name), $2=kind (note|edit|proposal|audit|question|done), $3=body (may start with "ref:task:12 " etc).
  async workAppend(env, actor, kind, body) {
    const who = String(actor || 'unknown').slice(0, 60);
    const k = String(kind || 'note').toLowerCase().slice(0, 20);
    let text = String(body || '').trim();
    if (!text) return JSON.stringify({ error: 'body required' });
    let ref = null;
    const rm = text.match(/^ref:(\S+)\s+/);
    if (rm) { ref = rm[1]; text = text.slice(rm[0].length); }
    const prev = await env.DB.prepare('SELECT hash FROM work_log ORDER BY id DESC LIMIT 1').first();
    const prevHash = prev ? prev.hash : 'genesis';
    const ts = buildNowIso();
    const digestInput = prevHash + '|' + ts + '|' + who + '|' + k + '|' + text;
    let hash;
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(digestInput)); hash = [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 32); }
    catch { hash = 'h' + ts; }
    const r = await env.DB.prepare('INSERT INTO work_log (ts,actor,kind,ref,body,prev_hash,hash) VALUES (?,?,?,?,?,?,?)')
      .bind(ts, who, k, ref, text.slice(0, 4000), prevHash, hash).run();
    return JSON.stringify({ id: r.meta.last_row_id, ts, actor: who, kind: k, ref, hash, note: 'appended to shared work thread — read WORK_FEED before acting' });
  },
  // The one object every model / token-holder reads FIRST. Aggregates: top priority, open tasks,
  // open GitHub issues, lead pipeline, and the recent model thread. $1=limit for recent entries (default 15).
  async workFeed(env, limitArg) {
    const lim = Math.min(50, Math.max(5, parseInt(limitArg || '15', 10) || 15));
    // open tasks (owner-facing first)
    const taskCount = (await env.DB.prepare("SELECT COUNT(*) n FROM tasks WHERE status='open'").first())?.n || 0;
    const topTasks = ((await env.DB.prepare("SELECT id, body, source FROM tasks WHERE status='open' AND source='owner' ORDER BY id DESC LIMIT 12").all()).results || [])
      .map(t => { let a = ''; try { const j = JSON.parse(t.body); a = j.ask || j.text || t.body; } catch { a = t.body; } return { id: t.id, text: String(a).slice(0, 160) }; });
    // github issues (best-effort)
    let ghIssues = [], ghNote = null;
    try { const g = JSON.parse(await FN_MAP.githubListIssues(env, 'open', '', 10)); ghIssues = (Array.isArray(g) ? g : g.issues || []).slice(0, 10).map(i => ({ number: i.number, title: i.title })); }
    catch (e) { ghNote = 'github list unavailable this call'; }
    // leads pipeline
    const leadCounts = (await env.DB.prepare('SELECT status, COUNT(*) n FROM leads GROUP BY status').all()).results || [];
    // market truth — the owner-declared state of ads/sales every model must respect
    const mt = await env.DB.prepare("SELECT id, ts, body FROM work_log WHERE ref='market' ORDER BY id DESC LIMIT 1").first();
    // the model thread (recent, newest first)
    const recent = ((await env.DB.prepare('SELECT id, ts, actor, kind, ref, substr(body,1,240) b FROM work_log ORDER BY id DESC LIMIT ?').bind(lim).all()).results || []);
    return JSON.stringify({
      READ_ME: 'This is the shared work thread. Before you act: read the top priority, MARKET TRUTH, and the open items below. When you do or propose anything, append it with WORK_APPEND (actor=your model name, kind, body). Every model and coding agent reads this same feed, so we all stay on the same page.',
      top_priority: topTasks[0] ? ('#' + topTasks[0].id + ' — ' + topTasks[0].text) : 'no owner task set',
      market_truth: mt ? { id: mt.id, ts: mt.ts, body: mt.body } : null,
      open_tasks: { count: taskCount, owner_top: topTasks },
      github_issues: { shown: ghIssues.length, issues: ghIssues, note: ghNote },
      leads_pipeline: leadCounts.reduce((a, r) => (a[r.status] = r.n, a), {}),
      model_thread_recent: recent.map(e => ({ id: e.id, ts: e.ts, actor: e.actor, kind: e.kind, ref: e.ref, body: e.b })),
      append_with: 'POST /api/dispatch {key:"WORK_APPEND", body:"<actor>|<kind>|<your note>"}',
    });
  },

  // ---- THE MIRROR LAYER: typed, claim-level recursion over every article ----
  // Attach one typed contribution to an exact claim. $1=slug, $2=claim id, $3=kind,
  // $4=actor, $5+=body. Never rewrites the article; ledgered with a receipt.
  async mirrorAppend(env, slug, claimId, kind, actor, body) {
    const ctx = env.TRACE_CTX;
    const who = String(ctx && ctx.actor || '');
    const prefix = who.startsWith('cap:') || who.startsWith('share:') ? 'model' : (who ? who.split(':')[0] : 'dispatch');
    const res = await appendMirrorContribution(env, { slug, claim_id: claimId, kind, actor, body, actor_prefix: prefix });
    return JSON.stringify(res);
  },
  // Read the Mirror Layer of one article (or newest across all). $1=slug (optional), $2=limit.
  async mirrorFeed(env, slug, limit) {
    return JSON.stringify(await getMirrorFeed(env, slug, limit));
  },
  // OWNER ACT — accept|reject a proposed contribution. Share/capability tokens are denied:
  // models propose, they do not resolve. $1=id, $2=accepted|rejected, $3+=note.
  async mirrorResolve(env, id, status, note) {
    const ctx = env.TRACE_CTX;
    const who = String(ctx && ctx.actor || '');
    if (who.startsWith('share:') || who.startsWith('cap:') || who.startsWith('public:')) {
      return JSON.stringify({ error: 'resolution is an owner act — a delegated token may propose (MIRROR_APPEND) but not resolve', denied_actor: who });
    }
    return JSON.stringify(await resolveMirrorContribution(env, id, status, note, who || 'owner'));
  },

  // ---- OIP CONTENT LOOP: philosophy/OIP corpus on the SAME protocol as health content ----
  // Writer = grok/grok-4.3 (Kimi is not routed into this loop). System prompts live as
  // directory rows (OIP_WRITER / OIP_ATOMIZER) — viewable and PATCHable like every prompt;
  // each task body carries the exact prompt used, and article meta.provenance stores it.
  async oipPromptRow(env, key, fallback) {
    try {
      const row = await env.DB.prepare('SELECT content FROM directory WHERE key=?').bind(key).first();
      const c = String(row?.content || '').trim();
      if (c) return c;
    } catch {}
    return fallback;
  },
  // Queue write tasks for pending inventory items. $1=kinds (csv, default thinker,school,paper), $2=limit.
  async oipSeedLoop(env, kindsArg, limitArg) {
    const kinds = String(kindsArg || 'thinker,school,paper').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    const limit = Math.min(200, Math.max(1, parseInt(limitArg || '50', 10) || 50));
    const prompt = await FN_MAP.oipPromptRow(env, 'OIP_WRITER',
      'You write philosophy-of-systems articles for miscsubjects.com with the same rigor as the evidence-graded health content.');
    const items = (
      await env.DB.prepare(
        "SELECT id, kind, name, data FROM pipeline WHERE kind IN (" + kinds.map(() => '?').join(',') + ") AND status='pending' ORDER BY id LIMIT ?",
      ).bind(...kinds, limit).all()
    ).results || [];
    const slugify = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    let queued = 0, skipped = 0;
    const out = [];
    for (const it of items) {
      let data = {};
      try { data = JSON.parse(it.data || '{}') || {}; } catch {}
      const prefix = it.kind === 'thinker' ? 'thinker-' : it.kind === 'paper' ? 'paper-' : 'school-';
      const slug = String(data.slug || prefix + slugify(it.name));
      const askByKind = {
        thinker:
          'Write the philosophy article for ' + it.name + ': their convergence with the OIP/GRAIN synthesis (the grain, the Ladder, the convergence patterns). Cover: what they saw, their exact primary-source concepts and works (real citations), their distance from the full synthesis, honest limits and disconfirming edges, and how their work maps onto specific convergence patterns. Reference sibling articles at /a/oip-the-ladder, /a/oip-principles, /a/oip-final-testimony where they carry load.',
        school:
          'Write the philosophy article for the school "' + it.name + '" as a supporting school of the OIP/GRAIN synthesis: its core results, its major figures and their primary works (real citations), which convergence patterns it independently derived, what it gets right, where it stops short of the synthesis, and its strongest internal objections.',
        paper:
          'Write the philosophy article for the academic work "' + it.name + '": what it establishes, its exact load-bearing passages (real quotes with page/section where verifiable), how it supports or attacks the OIP/GRAIN synthesis, which convergence patterns it evidences, and its honest limits.',
      };
      const ask = (askByKind[it.kind] || askByKind.thinker) + (data.context ? '\n\nGROUNDING NOTES (from the thinker map — verify before relying on):\n' + String(data.context).slice(0, 4000) : '');
      const body = JSON.stringify({
        post_to: '/api/protocol/write', slug, title: it.name, ask,
        system_prompt: prompt, model: 'grok/grok-4.3', web_search: true,
        tags: ['oip', 'philosophy', it.kind], loop: 'oip', force_write: false,
      });
      const exists = await env.DB.prepare(
        "SELECT id FROM tasks WHERE status IN ('open','running') AND body LIKE ? AND body LIKE '%/api/protocol/write%' LIMIT 1",
      ).bind('%"slug":"' + slug + '"%').first().catch(() => null);
      if (exists) { skipped++; continue; }
      await env.DB.prepare("INSERT INTO tasks (created_at, status, body, source) VALUES (datetime('now'), 'open', ?, 'writer')").bind(body).run();
      await env.DB.prepare("UPDATE pipeline SET status='queued', phase='queued', slug=?, updated_at=? WHERE id=?").bind(slug, buildNowIso(), it.id).run();
      queued++; out.push(slug);
    }
    return JSON.stringify({ ok: true, kinds, queued, skipped_existing: skipped, pending_remaining: Math.max(0, items.length === limit ? 1 : 0), slugs: out.slice(0, 30), note: 'writer-queue cron drains these (KV writer_queue_autorun=1); each write chains adversary+endorsement critique and a re-score' });
  },
  // Queue atomize (schema-conformance) tasks for articles with no atomized claims. $1=limit, $2=slug-prefix filter (default oip-,grain-,thinker-,school-,paper-).
  async oipAtomizeQueue(env, limitArg, prefixArg) {
    const limit = Math.min(200, Math.max(1, parseInt(limitArg || '40', 10) || 40));
    const prefixes = String(prefixArg || 'oip-,grain-,thinker-,school-,paper-').split(',').map((s) => s.trim()).filter(Boolean);
    const where = prefixes.map(() => 'slug LIKE ?').join(' OR ');
    const rows = (
      await env.DB.prepare(
        "SELECT slug FROM articles WHERE (" + where + ") AND published=1 AND (meta IS NULL OR NOT json_valid(meta) OR json_array_length(COALESCE(json_extract(meta,'$.claims'),'[]'))=0) ORDER BY updated_at DESC LIMIT ?",
      ).bind(...prefixes.map((p) => p + '%'), limit).all()
    ).results || [];
    const prompt = await FN_MAP.oipPromptRow(env, 'OIP_ATOMIZER', '');
    let queued = 0, skipped = 0;
    for (const r of rows) {
      const body = JSON.stringify({
        post_to: '/api/protocol/atomize', slug: r.slug,
        ...(prompt ? { system_prompt: prompt } : {}),
        model: 'grok/grok-4.3', web_search: true, min_claims: 4, loop: 'oip',
      });
      const exists = await env.DB.prepare(
        "SELECT id FROM tasks WHERE status IN ('open','running') AND body LIKE ? AND body LIKE '%/api/protocol/atomize%' LIMIT 1",
      ).bind('%"slug":"' + r.slug + '"%').first().catch(() => null);
      if (exists) { skipped++; continue; }
      await env.DB.prepare("INSERT INTO tasks (created_at, status, body, source) VALUES (datetime('now'), 'open', ?, 'repair')").bind(body).run();
      queued++;
    }
    return JSON.stringify({ ok: true, queued, skipped_existing: skipped, scanned: rows.length, note: 'atomize never rewrites a body — claims+sources only, then re-score' });
  },
  // Grok enumerates missing inventory (P0 loop: call again until it returns none). $1=kind (thinker|school|paper), $2=extra context.
  async oipEnumerate(env, kindArg, contextArg) {
    const kind = ['thinker', 'school', 'paper'].includes(String(kindArg || '').toLowerCase()) ? String(kindArg).toLowerCase() : 'thinker';
    const have = ((await env.DB.prepare('SELECT name FROM pipeline WHERE kind=? ORDER BY id').bind(kind).all()).results || []).map((r) => r.name);
    const ask =
      'Enumerate every ' + (kind === 'thinker' ? 'thinker (scientist, philosopher, mathematician, mystic, economist)' : kind === 'school' ? 'school of thought / research tradition' : 'specific academic paper or book (author, year, title)') +
      ' that is MATERIAL to the OIP/GRAIN synthesis: the claim that energy flows reliably produce a narrow family of structural patterns (branching, spirals, waves, symmetry, flow networks, bounded chaos, memory, scale invariance) across scales, the Ladder from thermodynamic difference to mind, and the thermodynamics-to-ethics bridge. Include supporters AND material disconfirming edges.' +
      (String(contextArg || '').trim() ? ' Focus: ' + String(contextArg).slice(0, 500) : '') +
      '\n\nALREADY HAVE (do not repeat): ' + JSON.stringify(have.slice(0, 400)) +
      '\n\nOutput ONLY one JSON object: {"items":[{"name":"...","evidence":"none","data":{"context":"one line on why material and which pattern/school it touches"}}]} — if nothing material remains, output {"items":[]}.';
    const r = await fetch('https://miscsubjects.com/api/protocol/write', {
      method: 'POST', headers: dispatchHeaders(env),
      body: JSON.stringify({ publish: false, model: 'grok/grok-4.3', web_search: true, max_tokens: 3000, ask }),
    });
    const j = await r.json().catch(() => ({}));
    const outObj = j && j.output && typeof j.output === 'object' ? j.output : null;
    const items = outObj && Array.isArray(outObj.items) ? outObj.items : [];
    if (!items.length && !String(contextArg || '').trim()) {
      // Surface saturation is not exhaustion. Grind deeper: cycle a focus subject (every
      // thinker and school already in the pipeline, then the domain list) via a KV cursor,
      // so each recurring fire digs into one bibliography instead of idling on "none".
      const domains = ['non-equilibrium thermodynamics', 'complexity science', 'cybernetics and information theory', 'theoretical biology and evolution', 'mathematics and logic', 'network theory', 'philosophy of mind', 'economics and institutions', 'mysticism and comparative religion', 'AI and machine learning'];
      let subjects = domains;
      try {
        const rows = (await env.DB.prepare("SELECT name FROM pipeline WHERE kind IN ('thinker','school') ORDER BY id").all()).results || [];
        if (rows.length) subjects = rows.map((x) => x.name).concat(domains);
      } catch {}
      let cur = 0;
      try { cur = parseInt((await env.KV.get('oip_enum_cursor_' + kind)) || '0', 10) || 0; } catch {}
      const focus = subjects[cur % subjects.length];
      try { await env.KV.put('oip_enum_cursor_' + kind, String(cur + 1)); } catch {}
      const deeper = JSON.parse(await FN_MAP.oipEnumerate(env, kind, (kind === 'paper' ? 'primary works, key papers, and books of/about: ' : 'figures and traditions connected to: ') + focus));
      return JSON.stringify({ ...deeper, surface: 'none', ground_focus: focus, cursor: cur + 1 });
    }
    if (!items.length) return JSON.stringify({ ok: true, kind, new_items: 0, focus: String(contextArg || '').slice(0, 120) || undefined, note: 'enumerator returned none for this focus', raw: outObj ? undefined : String(j.output || j.error || '').slice(0, 300) });
    const inv = await fetch('https://miscsubjects.com/api/protocol/inventory', {
      method: 'POST', headers: dispatchHeaders(env),
      body: JSON.stringify({ kind, items, model: 'grok/grok-4.3', reasoning: 'oip enumerator loop' }),
    });
    const invj = await inv.json().catch(() => ({}));
    const seeded = JSON.parse(await FN_MAP.oipSeedLoop(env, kind, String(items.length)));
    return JSON.stringify({ ok: true, kind, enumerated: items.length, inserted: invj.inserted, already_had: invj.existing, queued_writes: seeded.queued });
  },
  // The loop dashboard: inventory by kind/status, oip tasks by state, last written, flags. $1 unused.
  async oipLoopStatus(env) {
    const inv = (await env.DB.prepare("SELECT kind, status, COUNT(*) n FROM pipeline WHERE kind IN ('thinker','school','paper') GROUP BY kind, status").all()).results || [];
    const tasks = (await env.DB.prepare("SELECT source, status, COUNT(*) n FROM tasks WHERE body LIKE '%\"loop\":\"oip\"%' GROUP BY source, status").all()).results || [];
    const recent = (await env.DB.prepare("SELECT slug, title, updated_at FROM articles WHERE slug LIKE 'thinker-%' OR slug LIKE 'paper-%' OR slug LIKE 'school-%' ORDER BY updated_at DESC LIMIT 8").all()).results || [];
    const unatomized = (await env.DB.prepare("SELECT COUNT(*) n FROM articles WHERE (slug LIKE 'oip-%' OR slug LIKE 'grain-%') AND published=1 AND (meta IS NULL OR NOT json_valid(meta) OR json_array_length(COALESCE(json_extract(meta,'$.claims'),'[]'))=0)").first())?.n || 0;
    const flag = env.KV ? await env.KV.get('writer_queue_autorun') : null;
    return JSON.stringify({
      inventory: inv, oip_tasks: tasks, unatomized_corpus: unatomized,
      writer_queue_autorun: flag, cron: 'sibling worker fires /api/protocol/run?role=writer-queue every minute when the flag is 1',
      recent_writes: recent,
      prompts: { writer: 'GET /api/directory/OIP_WRITER', atomizer: 'GET /api/directory/OIP_ATOMIZER', edit: 'PATCH /api/directory/<KEY> {"content":"..."} or DIR_PATCH' },
    });
  },

  async tasksSyncGoogle(env) {
    const rows = await env.DB.prepare("SELECT id, body, source FROM tasks WHERE status='open' AND google_task_id IS NULL ORDER BY id").all();
    const items = rows.results || [];
    const synced = [];
    const failed = [];
    const gasUrl = env.AIRUNNER_WEB_APP_URL;
    if (!gasUrl) return JSON.stringify({ error: 'AIRUNNER_WEB_APP_URL not configured', synced: 0, failed: items.length });
    for (const t of items) {
      try {
        let title = String(t.body || '').slice(0, 200);
        try { const j = JSON.parse(t.body || '{}'); title = String(j.ask || j.title || t.body || '').slice(0, 200); } catch {}
        const gr = await fetch(gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'tasks_add', args: { title, notes: String(t.source || '') } })
        });
        const gj = await gr.json().catch(() => ({}));
        if (gj.ok && gj.id) {
          await env.DB.prepare('UPDATE tasks SET google_task_id = ? WHERE id = ?').bind(gj.id, t.id).run();
          synced.push({ id: t.id, google_task_id: gj.id });
        } else {
          failed.push({ id: t.id, reason: gj.error || 'unknown' });
        }
      } catch (e) { failed.push({ id: t.id, reason: String(e && e.message || e) }); }
    }
    return JSON.stringify({ synced: synced.length, failed: failed.length, items: synced.slice(0, 20), errors: failed.slice(0, 10) });
  },
  // Run the next open task. ONE task per call. Cron calls this every 5 min but it self-gates on KV todo_autorun
  // (default off) — pass mode 'force' to run on-demand regardless of the flag.
  async taskRunNext(env, mode) {
    if (String(mode || '') !== 'force') {
      const on = env.KV ? await env.KV.get('todo_autorun') : null;
      if (on !== '1') return JSON.stringify({ skipped: 'autorun off (set KV todo_autorun=1 to enable)' });
    }
    const row = await env.DB.prepare("SELECT id, body, source FROM tasks WHERE status='open' AND LOWER(COALESCE(source,'')) != 'owner' AND (body IS NULL OR body NOT LIKE '%\"post_to\"%') ORDER BY id LIMIT 1").first();
    if (!row) return JSON.stringify({ ran: 0, note: 'no open tasks' });
    let job = null;
    try { job = JSON.parse(row.body || '{}'); } catch { job = null; }
    if (!job || typeof job !== 'object') job = { ask: String(row.body || ''), role: String(row.source || 'writer') };
    const postTo = String(job.post_to || '').trim();
    if (postTo) return JSON.stringify({ skipped: row.id, reason: 'structured job with post_to belongs to PROTOCOL_RUN; TODO_RUN only handles plain-text tasks' });
    await env.DB.prepare("UPDATE tasks SET status='running' WHERE id=?").bind(row.id).run();
    let res = '', status = 'done', trace = '';
    try {
      const d = await dispatch(env, 'ROUTER', '[channel cron · build to-do]\nNow: ' + String(job.ask || row.body), { actor: 'todo' });
      res = String(d.result == null ? '' : d.result); trace = d.trace || '';
      if (res.startsWith('ERR')) status = 'error';
    } catch (e) { res = 'ERR:todo:' + (e && e.message || String(e)); status = 'error'; }
    await env.DB.prepare("UPDATE tasks SET status=?, trace=? WHERE id=?").bind(status, trace, row.id).run();
    return JSON.stringify({ ran: row.id, status, trace, result: res.slice(0, 400) });
  },
  // After a ledger job finishes: notify the owner, chain critique passes, re-score.
  async ledgerChain(env, postTo, parsed, job) {
    const slug = String(
      job.slug || parsed?.slug || parsed?.draft?.slug || '',
    ).trim();
    if (!slug || !env.DB) return;
    const notifyOn = env.KV ? await env.KV.get('article_notify') : null;
    if (notifyOn === '1' && (parsed?.ok || parsed?.skipped)) {
      const url = 'https://miscsubjects.com/a/' + slug;
      const focus = String(job.focus || parsed?.focus || '').toLowerCase();
      let msg = '';
      if (postTo.includes('/write')) {
        if (parsed.skipped) {
          msg = '⏭️ Write skipped (ledger already populated): ' + url;
          if (parsed.reason) msg += ' — ' + String(parsed.reason).slice(0, 80);
        } else {
          msg = '📝 New article: ' + url;
          if (parsed.generated?.sources) msg += ' (' + parsed.generated.sources + ' sources)';
        }
      } else if (postTo.includes('/populate')) {
        const { populateNotifyMessage } = await import('../_lib/pipeline_chain.js');
        msg = populateNotifyMessage(parsed, url, focus || parsed.focus);
      } else if (postTo.includes('/synthesize-body')) {
        if (!parsed.skipped && parsed.chars) {
          msg = '✍️ Prose updated · ' + url + ' (' + parsed.chars + ' chars)';
        }
      } else if (postTo.includes('/fill-slots')) {
        if (Array.isArray(parsed.added) && parsed.added.length) {
          msg = '🧩 +' + parsed.added.length + ' constitution slots · ' + url;
        }
      } else if (postTo.includes('/repair')) {
        const n = parsed.claims_added || parsed.materialized || parsed.repaired;
        if (n > 0) msg = '🔧 repair +' + n + ' claims · ' + url;
      } else if (postTo.includes('/critique')) {
        msg = '⚖️ ' + (parsed.role || 'critique') + ' · ' + url;
      } else if (postTo.includes('/poll')) {
        const who = String(job.model || parsed.model || 'model').split('/').pop();
        msg = '📊 ' + who + ' poll · ' + url;
        if (parsed.claims_added) msg += ' (+' + parsed.claims_added + ' claims';
        if (parsed.sources_added) msg += ', +' + parsed.sources_added + ' sources';
        if (parsed.claims_added || parsed.sources_added) msg += ')';
        if (parsed.body_rejected) msg += ' [body rejected: legibility]';
      }
      if (!msg) {
        const { wasteNotifyMessage } = await import('../_lib/pipeline_chain.js');
        msg = wasteNotifyMessage(parsed, url, postTo);
      }
      if (msg) {
        try {
          await FN_MAP.sendByChannel(env, 'blooio', '[OWNER_PHONE]', msg);
        } catch (e) {
          console.error('article_notify failed:', e?.message || e);
        }
      }
    }
    const chainSlug =
      slug ||
      String(parsed?.draft?.slug || parsed?.slug || job.slug || '').trim();
    if (
      postTo.includes('/write') &&
      parsed?.ok &&
      !parsed?.skipped &&
      chainSlug &&
      String(job.loop || '') === 'oip'
    ) {
      // OIP philosophy loop: after the write, chain adversary + endorsement critique passes
      // and a re-score — NOT the peptide evidence populate. Same machinery, philosophy passes.
      const chainTrace = String(job.trace_id || parsed?.invocation?.trace_id || '').trim() || null;
      const followups = [
        { source: 'adversary', body: { slug: chainSlug, role: 'adversary', model: 'grok/grok-4.3', post_to: '/api/protocol/critique', loop: 'oip' } },
        { source: 'adversary', body: { slug: chainSlug, role: 'endorsement', model: 'grok/grok-4.3', post_to: '/api/protocol/critique', loop: 'oip' } },
        { source: 'poll', body: { slug: chainSlug, post_to: '/api/protocol/score', loop: 'oip' } },
      ];
      for (const f of followups) {
        if (chainTrace) f.body.trace_id = chainTrace;
        const bodyStr = JSON.stringify(f.body);
        const exists = await env.DB.prepare(
          "SELECT id FROM tasks WHERE status IN ('open','running') AND body LIKE ? AND body LIKE ? LIMIT 1",
        )
          .bind('%"slug":"' + chainSlug + '"%', '%' + (f.body.role ? '"role":"' + f.body.role + '"' : '/api/protocol/score') + '%')
          .first()
          .catch(() => null);
        if (!exists) {
          await env.DB.prepare(
            "INSERT INTO tasks (created_at, status, body, source) VALUES (datetime('now'), 'open', ?, ?)",
          )
            .bind(bodyStr, f.source)
            .run()
            .catch(() => {});
        }
      }
    } else if (
      postTo.includes('/write') &&
      parsed?.ok &&
      !parsed?.skipped &&
      chainSlug
    ) {
      const chainTrace = String(job.trace_id || parsed?.invocation?.trace_id || '').trim() || null;
      const popBody = JSON.stringify({
        slug: chainSlug,
        focus: 'science',
        max_rounds: 8,
        role: 'source-hunt',
        post_to: '/api/protocol/populate',
        ...(chainTrace ? { trace_id: chainTrace } : {}),
      });
      const popExists = await env.DB.prepare(
        "SELECT id FROM tasks WHERE status IN ('open','running') AND body LIKE ? AND body LIKE '%/api/protocol/populate%' LIMIT 1",
      )
        .bind('%"slug":"' + chainSlug + '"%')
        .first()
        .catch(() => null);
      if (!popExists) {
        await env.DB.prepare(
          "INSERT INTO tasks (created_at, status, body, source) VALUES (datetime('now'), 'open', ?, 'source-hunt')",
        )
          .bind(popBody)
          .run()
          .catch(() => {});
      }
    }
    if (postTo.includes('/populate')) {
      const {
        populatePhaseComplete,
        followupsAfterPopulate,
        enqueueFollowups,
      } = await import('../_lib/pipeline_chain.js');
      const chainSlug =
        slug ||
        String(parsed?.slug || job.slug || '').trim();
      const focus = String(job.focus || parsed?.focus || 'science').toLowerCase();
      if (chainSlug && populatePhaseComplete(parsed)) {
        const chainTrace = String(job.trace_id || parsed?.invocation?.trace_id || '').trim() || null;
        const followups = followupsAfterPopulate(focus, chainSlug);
        await enqueueFollowups(env, chainSlug, followups, chainTrace);
      }
    }
  },
  // Cron protocol runner: claim one open task, run it against the requested endpoint, close/reopen.
  async protocolRun(env, role) {
    const want = String(role || 'writer').toLowerCase().trim();
    const actor = env.TRACE_CTX?.actor || '';
    if (isArticleBackgroundRole(want) && await articleBackgroundWritesLocked(env)) {
      return JSON.stringify({
        skipped: true,
        role: want,
        lock: ARTICLE_BACKGROUND_LOCK_KEY,
        reason: 'background article writing and editing are disabled by the owner',
      });
    }
    const flag = protocolFlagForRole(want);
    if (isAutomatedActor(actor) && (await kvGetFlag(env, flag)) !== '1') {
      return JSON.stringify({ skipped: true, role: want, flag, reason: flag + ' off' });
    }
    const nextRes = await fetch('https://miscsubjects.com/api/protocol/next?role=' + encodeURIComponent(want));
    const nextData = await nextRes.json().catch(() => ({}));
    if (!nextData.task_id) return JSON.stringify({ ran: 0, note: nextData.note || 'no open task' });
    const taskId = nextData.task_id;
    const job = (nextData.job && typeof nextData.job === 'object') ? nextData.job : {};
    const postTo = String(job.post_to || '/api/protocol/write');
    const { newTraceId } = await import('../_lib/pipeline_chain.js');
    const traceId = String(job.trace_id || '').trim() || newTraceId();
    const payload = { ...job, trace_id: traceId };
    delete payload.post_to;
    const url = 'https://miscsubjects.com' + (postTo.startsWith('/') ? postTo : '/' + postTo);
    let r = { ok: false, status: 0 };
    let text = '';
    let ok = false;
    let repoll = false;
    try {
      r = await fetch(url, { method: 'POST', headers: dispatchHeaders(env), body: JSON.stringify(payload) });
      text = await r.text().catch(() => '');
      ok = r.ok && !text.startsWith('ERR') && !text.startsWith('{"error"');
      try {
        const j = JSON.parse(text);
        if (j && j.skipped === true) ok = true;
        if (j && j.error) ok = false;
      } catch {}
      if (ok && postTo.includes('/populate')) {
        try {
          const j = JSON.parse(text);
          const { populateShouldRepoll } = await import('../_lib/pipeline_chain.js');
          repoll = populateShouldRepoll(j);
        } catch {}
      }
      if (ok) {
        try {
          const parsed = JSON.parse(text);
          await FN_MAP.ledgerChain(env, postTo, parsed, payload);
        } catch {}
      }
    } catch (e) {
      text = 'ERR:protocol_run:' + (e && e.message || String(e));
      ok = false;
    } finally {
      if (ok || repoll) {
        const closeUrl = 'https://miscsubjects.com/api/tasks/' + taskId + (ok && !repoll ? '/done' : '/reopen');
        const closeBody = ok ? JSON.stringify({ result: text.slice(0, 3000), repoll }) : '{}';
        await fetch(closeUrl, { method: 'POST', headers: dispatchHeaders(env), body: closeBody }).catch(() => {});
      } else {
        let priorTrace = '';
        try {
          const prior = await env.DB.prepare('SELECT trace FROM tasks WHERE id=?').bind(taskId).first();
          priorTrace = String(prior?.trace || '');
        } catch {}
        const matches = [...priorTrace.matchAll(/protocol_run_failure_count=(\d+)/g)];
        const prevFailures = matches.length ? Number(matches[matches.length - 1][1]) || 0 : 0;
        const failureCount = prevFailures + 1;
        const failureNote = [
          'protocol_run_failure_count=' + failureCount,
          'trace=' + traceId,
          'role=' + want,
          'post_to=' + postTo,
          'status=' + (r.status || 0),
          'result=' + text.slice(0, 1800).replace(/\s+/g, ' ').trim(),
        ].join(' | ').slice(0, 4000);
        const nextStatus = failureCount >= 3 ? 'quarantined' : 'open';
        try {
          await env.DB.prepare('UPDATE tasks SET status=?, trace=? WHERE id=?')
            .bind(nextStatus, failureNote, taskId)
            .run();
          await logEvent(env, {
            source: 'tasks',
            key: nextStatus === 'quarantined' ? 'TASK_QUARANTINED' : 'TASK_REOPEN',
            action: nextStatus === 'quarantined' ? 'task_quarantined' : 'task_reopen',
            direction: 'in',
            status: 200,
            trace_id: traceId,
            request: { id: taskId, from: 'running', to: nextStatus, role: want, post_to: postTo },
            response: { id: taskId, status: nextStatus, failure_count: failureCount, result: text.slice(0, 1000) },
          });
        } catch {
          await fetch('https://miscsubjects.com/api/tasks/' + taskId + '/reopen', { method: 'POST', headers: dispatchHeaders(env), body: '{}' }).catch(() => {});
        }
      }
    }
    return JSON.stringify({
      ran: taskId,
      trace: traceId,
      role: want,
      post_to: postTo,
      ok,
      repoll,
      status: r.status || 0,
      result: text.slice(0, 400),
    });
  },
  // QUE: a test-question bank. Each row is fed through the real ROUTER turn; reply + reasoning
  // trace land back on the row for inspection/scoring. slug 'go'/'yes' = full router; else a KEY.
  async queAdd(env, prompt, slug) {
    const p = String(prompt || '').trim();
    if (!p) return 'ERR:que:empty_prompt';
    const s = (String(slug || 'go').trim().toLowerCase()) || 'go';
    const r = await env.DB.prepare('INSERT INTO que (prompt, slug) VALUES (?, ?)').bind(p, s).run();
    return JSON.stringify({ added: r.meta.last_row_id, prompt: p, slug: s });
  },
  async queRun(env, limitArg) {
    const limit = Math.max(1, Math.min(50, parseInt(limitArg || '25', 10) || 25));
    const rows = (await env.DB.prepare(
      "SELECT id, prompt, slug FROM que WHERE response IS NULL OR response='' ORDER BY id LIMIT ?"
    ).bind(limit).all()).results || [];
    const runOne = async (row) => {
      const slug = String(row.slug || 'go').toLowerCase();
      const isTurn = (slug === 'go' || slug === 'yes');
      const key = isTurn ? 'ROUTER' : slug.toUpperCase();
      const body = isTurn ? ('[channel imessage · 1:1 · from the owner ([OWNER_PHONE])]\nNow: ' + row.prompt) : row.prompt;
      let res = '', trace = '', status = 'done';
      try {
        const d = await dispatch(env, key, body, { actor: 'que' });
        res = String(d.result == null ? '' : d.result); trace = d.trace || '';
        if (res.startsWith('ERR')) status = 'error';
      } catch (e) { res = 'ERR:que:' + (e && e.message || String(e)); status = 'error'; }
      await env.DB.prepare("UPDATE que SET response=?, ts=?, status=?, trace_id=?, meta=? WHERE id=?")
        .bind(res.slice(0, 49000), buildNowIso(), status, trace, 'trace:' + trace, row.id).run();
    };
    const WAVE = 10; // run 10 questions concurrently per wave — minutes for hundreds, not hours
    for (let i = 0; i < rows.length; i += WAVE) await Promise.all(rows.slice(i, i + WAVE).map(runOne));
    const pending = (await env.DB.prepare("SELECT COUNT(*) n FROM que WHERE response IS NULL OR response=''").first()).n;
    return JSON.stringify({ ran: rows.length, pending, parallel: WAVE });
  },
  async queList(env, filterArg) {
    const f = String(filterArg || '').trim().toLowerCase();
    const where = f === 'pending' ? "WHERE response IS NULL OR response=''"
                : f === 'done' ? "WHERE status='done'"
                : f === 'error' ? "WHERE status='error'" : '';
    const rows = (await env.DB.prepare(
      `SELECT id, prompt, slug, status, trace_id, substr(response,1,200) AS response FROM que ${where} ORDER BY id DESC LIMIT 100`
    ).all()).results || [];
    return JSON.stringify(rows);
  },
  // TEAM: two agents reason against each other on a goal, bounded rounds, converge.
  // proposer proposes a concrete evidence-backed step; critic stress-tests it; stops on APPROVED.
  async pairRun(env, goal, aKey, bKey, roundsArg) {
    const a = String(aKey || 'CODE_AUDIT'), b = String(bKey || 'CRITIC');
    const rounds = Math.max(1, Math.min(5, parseInt(roundsArg || '3', 10) || 3));
    let context = 'GOAL: ' + String(goal || '');
    const transcript = [];
    let approved = false;
    for (let i = 0; i < rounds && !approved; i++) {
      const da = await dispatch(env, a, context + '\n\nYou are the PROPOSER. Propose or refine ONE concrete, evidence-backed step toward the goal. Show the grep/read evidence.', { actor: 'team' });
      const ra = String(da.result || '');
      transcript.push({ round: i + 1, role: 'proposer', agent: a, text: ra.slice(0, 1200) });
      const db = await dispatch(env, b, context + '\n\nThe proposer said:\n' + ra + '\n\nYou are the CRITIC. Stress-test it. Reply "APPROVED:" + why if it is correct/safe/evidence-backed, else "REVISE:" + exactly what to fix.', { actor: 'team' });
      const rb = String(db.result || '');
      transcript.push({ round: i + 1, role: 'critic', agent: b, text: rb.slice(0, 1200) });
      context += '\n\n[round ' + (i + 1) + '] PROPOSER: ' + ra.slice(0, 1000) + '\nCRITIC: ' + rb.slice(0, 1000);
      if (/\bAPPROVED\b/i.test(rb)) approved = true;
    }
    return JSON.stringify({ goal: String(goal || ''), rounds_run: transcript.length / 2, approved, transcript });
  },

  // ── Builder queue (`builder_queue` table) — the owner's "I want to build X" list.
  async builderAdd(env, title, body, priority) {
    const ts = buildNowIso();
    const p = parseInt(priority, 10);
    const r = await env.DB.prepare(
      'INSERT INTO builder_queue (created_at, updated_at, status, priority, title, body) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(ts, ts, 'idea', Number.isFinite(p) ? p : 5, String(title || '').slice(0, 200), String(body || '')).run();
    return JSON.stringify({ id: r.meta.last_row_id, title: String(title || ''), priority: Number.isFinite(p) ? p : 5, status: 'idea' });
  },
  async builderList(env, statusFilter) {
    const f = String(statusFilter || '').trim().toLowerCase();
    let rows;
    if (f && f !== 'all') {
      rows = await env.DB.prepare('SELECT id, status, priority, title, blocker FROM builder_queue WHERE status = ? ORDER BY priority ASC, id DESC').bind(f).all();
    } else {
      rows = await env.DB.prepare("SELECT id, status, priority, title, blocker FROM builder_queue WHERE status NOT IN ('done','wont') ORDER BY priority ASC, id DESC").all();
    }
    return JSON.stringify(rows.results || []);
  },
  async builderNext(env) {
    const r = await env.DB.prepare("SELECT id, priority, title, body FROM builder_queue WHERE status = 'queued' ORDER BY priority ASC, id ASC LIMIT 1").first();
    return r ? JSON.stringify(r) : JSON.stringify({ ok: false, error: 'no_queued_items' });
  },
  async builderPatch(env, id, field, value) {
    const allowed = ['status', 'priority', 'title', 'body', 'blocker', 'proof'];
    const f = String(field || '').toLowerCase();
    if (!allowed.includes(f)) return 'ERR:fn:bad_field:' + f;
    const ts = buildNowIso();
    const v = f === 'priority' ? parseInt(value, 10) : String(value || '');
    if (f === 'priority' && !Number.isFinite(v)) return 'ERR:fn:bad_priority';
    await env.DB.prepare('UPDATE builder_queue SET ' + f + ' = ?, updated_at = ? WHERE id = ?').bind(v, ts, parseInt(id, 10)).run();
    return JSON.stringify({ id: parseInt(id, 10), [f]: v, updated_at: ts });
  },
  async builderDone(env, id, proof) {
    const ts = buildNowIso();
    await env.DB.prepare("UPDATE builder_queue SET status = 'done', proof = ?, updated_at = ? WHERE id = ?")
      .bind(String(proof || ''), ts, parseInt(id, 10)).run();
    return JSON.stringify({ id: parseInt(id, 10), status: 'done', proof: String(proof || '') });
  },
  async builderDelete(env, id) {
    await env.DB.prepare('DELETE FROM builder_queue WHERE id = ?').bind(parseInt(id, 10)).run();
    return JSON.stringify({ id: parseInt(id, 10), deleted: true });
  },

  // ── Threads (`threads` table) — the owner's running lines of thought (ideation, not exec).
  async threadAdd(env, title, body, tags) {
    const ts = buildNowIso();
    const r = await env.DB.prepare(
      'INSERT INTO threads (created_at, updated_at, status, title, body, tags) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(ts, ts, 'open', String(title || '').slice(0, 200), String(body || ''), String(tags || '')).run();
    return JSON.stringify({ id: r.meta.last_row_id, title: String(title || ''), tags: String(tags || '') });
  },
  async threadList(env, filter) {
    const f = String(filter || '').trim();
    let rows;
    if (f.startsWith('tag:')) {
      const t = f.slice(4);
      rows = await env.DB.prepare("SELECT id, status, title, updated_at FROM threads WHERE tags LIKE ? AND status = 'open' ORDER BY updated_at DESC").bind('%' + t + '%').all();
    } else if (['open', 'paused', 'closed'].includes(f)) {
      rows = await env.DB.prepare('SELECT id, status, title, updated_at FROM threads WHERE status = ? ORDER BY updated_at DESC').bind(f).all();
    } else {
      rows = await env.DB.prepare("SELECT id, status, title, updated_at FROM threads WHERE status = 'open' ORDER BY updated_at DESC").all();
    }
    return JSON.stringify(rows.results || []);
  },
  async threadAppend(env, id, line) {
    const ts = buildNowIso();
    await env.DB.prepare("UPDATE threads SET body = COALESCE(body,'') || ? || x'0A', updated_at = ? WHERE id = ?")
      .bind('[' + ts + '] ' + String(line || ''), ts, parseInt(id, 10)).run();
    return JSON.stringify({ id: parseInt(id, 10), appended: String(line || '') });
  },
  async threadClose(env, id) {
    const ts = buildNowIso();
    await env.DB.prepare("UPDATE threads SET status = 'closed', updated_at = ? WHERE id = ?").bind(ts, parseInt(id, 10)).run();
    return JSON.stringify({ id: parseInt(id, 10), status: 'closed' });
  },
  async threadGet(env, id) {
    const r = await env.DB.prepare('SELECT * FROM threads WHERE id = ?').bind(parseInt(id, 10)).first();
    return r ? JSON.stringify(r) : JSON.stringify({ ok: false, error: 'not_found' });
  },

  // ── Approvals (`approvals` table) — phone-gated permission for risky actions.
  async approvalCreate(env, action, summary, resumeKey, resumeBody) {
    const ts = buildNowIso();
    const r = await env.DB.prepare(
      'INSERT INTO approvals (created_at, source, action, summary, resume_key, resume_body, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(ts, 'agent', String(action || ''), String(summary || ''), String(resumeKey || ''), String(resumeBody || ''), 'pending').run();
    const id = r.meta.last_row_id;
    // Notify the phone (best-effort).
    try {
      await fetch('https://miscsubjects.com/api/dispatch', {
        method: 'POST', headers: dispatchHeaders(env),
        body: JSON.stringify({ key: 'BLOOIO_SEND', body: `[OWNER_PHONE]|🔔 APPROVAL #${id}: ${action} — ${String(summary || '').slice(0, 200)}\nReply "approve ${id}" or "deny ${id}".` }),
      });
    } catch {}
    return JSON.stringify({ id, action, summary, status: 'pending' });
  },
  async approvalResolve(env, id, decision) {
    const ts = buildNowIso();
    const idN = parseInt(id, 10);
    const dec = String(decision || '').toLowerCase();
    if (!['approve', 'deny', 'approved', 'denied'].includes(dec)) return 'ERR:fn:bad_decision:' + dec;
    const status = dec.startsWith('approve') ? 'approved' : 'denied';
    const row = await env.DB.prepare('SELECT id, status, resume_key, resume_body FROM approvals WHERE id = ?').bind(idN).first();
    if (!row) return JSON.stringify({ ok: false, error: 'not_found', id: idN });
    if (row.status !== 'pending') return JSON.stringify({ ok: false, error: 'already_decided', id: idN, status: row.status });
    await env.DB.prepare('UPDATE approvals SET status = ?, decided_at = ?, decided_by = ? WHERE id = ?').bind(status, ts, 'phone', idN).run();
    if (status === 'approved' && row.resume_key) {
      try {
        const r = await fetch('https://miscsubjects.com/api/dispatch', {
          method: 'POST', headers: dispatchHeaders(env),
          body: JSON.stringify({ key: row.resume_key, body: row.resume_body || '' }),
        });
        const txt = await r.text();
        return JSON.stringify({ id: idN, status, resumed: row.resume_key, result: txt.slice(0, 500) });
      } catch (e) {
        return JSON.stringify({ id: idN, status, resumed: row.resume_key, error: String(e && e.message || e) });
      }
    }
    return JSON.stringify({ id: idN, status });
  },
  async kvList(env, prefix) {
    if (!env.KV) return 'ERR:fn:no_kv_binding';
    const r = await env.KV.list({ prefix: String(prefix || '') });
    return JSON.stringify(r.keys.map(k => k.name));
  },
  async kvGetJson(env, key) {
    if (!env.KV) return 'ERR:fn:no_kv_binding';
    const v = await env.KV.get(String(key));
    if (v == null) return 'null';
    try { JSON.parse(v); return v; } catch { return JSON.stringify(v); }
  },
  async kvPutJson(env, key, value) {
    if (!env.KV) return 'ERR:fn:no_kv_binding';
    let s;
    if (typeof value === 'string') {
      try { JSON.parse(value); s = value; } catch { s = JSON.stringify(value); }
    } else {
      s = JSON.stringify(value);
    }
    await env.KV.put(String(key), s);
    return 'OK';
  },
  async kvAppend(env, key, item) {
    if (!env.KV) return 'ERR:fn:no_kv_binding';
    const cur = await env.KV.get(String(key));
    let arr;
    try { arr = cur ? JSON.parse(cur) : []; if (!Array.isArray(arr)) arr = [arr]; } catch { arr = [cur]; }
    let parsed;
    try { parsed = JSON.parse(item); } catch { parsed = item; }
    arr.push(parsed);
    await env.KV.put(String(key), JSON.stringify(arr));
    return JSON.stringify({ length: arr.length });
  },
  // ── THE SEALER ──────────────────────────────────────────────────────────────────────────────
  // Deterministic arithmetic over a panel's findings. It decides EMIT or ESCALATE and nothing
  // else. No model runs here, by design: a model at this position is a ninth opinion that can
  // share the panel's blind spot while being the thing that decides, which is the single point
  // of failure the whole assembly exists to remove. A model may write the human-readable summary
  // of what the gate decided. A model may never make the call.
  //
  // Fail-closed. EMIT requires ALL of:
  //   1. no malformed finding
  //   2. verdicts unanimous
  //   3. clause citations identical across findings (divergence at derivation level fires BEFORE
  //      verdict divergence does, and is the more sensitive detector)
  //   4. at least min_families distinct training families represented
  //   5. at least min_findings conforming findings
  // Anything else escalates, with the reason named.
  //
  // Independence is NOT assumed. Channels drawn from one training family are counted once for
  // the diversity test, which is the common-cause-failure discount that IEC 61508 calls a
  // beta factor. Nine models are not nine channels.
  async sealPanel(env, payload) {
    let q;
    try { q = typeof payload === 'string' ? JSON.parse(payload) : (payload || {}); }
    catch (e) { return 'ERR:fn:seal_panel:bad_json:' + e.message; }

    const VALID = ['AFFIRM', 'DENY', 'CANNOT_CONCLUDE'];
    const family = (m) => {
      const s2 = String(m || '').toLowerCase();
      if (/kimi|moonshot/.test(s2)) return 'moonshot';
      if (/glm|zai|zhipu/.test(s2)) return 'zhipu';
      if (/llama|meta/.test(s2)) return 'meta';
      if (/gpt|openai/.test(s2)) return 'openai';
      if (/claude|anthropic/.test(s2)) return 'anthropic';
      if (/gemini|google/.test(s2)) return 'google';
      if (/grok|xai/.test(s2)) return 'xai';
      if (/qwen/.test(s2)) return 'alibaba';
      if (/mistral/.test(s2)) return 'mistral';
      return 'unknown:' + s2.slice(0, 24);
    };
    const textOf = (raw) => {
      if (raw == null) return '';
      let j = raw;
      if (typeof j === 'string') { try { j = JSON.parse(j); } catch { return String(raw); } }
      if (typeof j === 'string') return j;
      if (Array.isArray(j?.content)) return j.content.map((c) => c.text || '').join('');
      if (j?.response) return String(j.response);
      if (Array.isArray(j?.choices)) return String(j.choices[0]?.message?.content || '');
      return JSON.stringify(j);
    };
    const clausesOf = (t) => [...new Set([...String(t || '').matchAll(/\[\s*clause\s+(\d+)/gi)]
      .map((m) => Number(m[1])).filter(Number.isFinite))].sort((a, b) => a - b);
    const grab = (t, re) => { const m = re.exec(String(t || '')); return m ? m[m.length - 1].toLowerCase() : null; };

    // ── SERVER-OWNED THRESHOLDS. A caller may RAISE them and may never lower them. ────────────
    const FLOOR = { min_families: 2, min_findings: 3 };
    const minFamilies = Math.max(FLOOR.min_families, Number(q.min_families || 0) || 0);
    const minFindings = Math.max(FLOOR.min_findings, Number(q.min_findings || 0) || 0);
    const lowerAttempt = [];
    if (q.min_families != null && Number(q.min_families) < FLOOR.min_families) lowerAttempt.push('min_families=' + q.min_families);
    if (q.min_findings != null && Number(q.min_findings) < FLOOR.min_findings) lowerAttempt.push('min_findings=' + q.min_findings);

    // ── RECORD LOADING. Bound mode takes ids and reads the ledger; nothing is taken on trust. ──
    const idList = (() => {
      const a = q.records || q.receipts || q.invocations ||
        (Array.isArray(q.findings) && q.findings.every((x) => typeof x === 'string') ? q.findings : null);
      return Array.isArray(a) ? a.map(String) : null;
    })();
    const rejected = [];
    let rows = [];
    let mode;

    if (idList && idList.length) {
      mode = 'bound';
      const seen = new Set();
      for (const rawId of idList) {
        const id = rawId.trim();
        if (seen.has(id)) { rejected.push({ id, reason: 'duplicate_record' }); continue; }
        seen.add(id);
        let inv = null, ev = null;
        if (/^inv_/i.test(id)) {
          inv = await getInvocation(env, id);
          if (!inv) { rejected.push({ id, reason: 'invocation_not_found' }); continue; }
          // The GATEWAY CALL is the payload object. An invocation also has its own dispatch event,
          // which carries the tag body rather than the model request — reading that one instead was
          // a real defect the adversarial battery surfaced, so the chat_completion event for the
          // trace is preferred and inv.event_id is only a fallback.
          // A trace can hold several gateway calls (tool loops). Take the first whose recorded
          // request actually yields a model, deterministically, rather than the newest by ts.
          try {
            const rs = (await env.LEDGER.prepare(
              "SELECT id FROM events WHERE trace_id = ? AND action = 'chat_completion' ORDER BY ts ASC, id ASC LIMIT 5")
              .bind(String(inv.trace_id || '')).all()).results || [];
            for (const r of rs) {
              const cand = await readEventFull(env, r.id);
              if (!cand) continue;
              let rq = cand.request_json;
              if (typeof rq === 'string') { try { rq = JSON.parse(rq); } catch {} }
              if (rq?.model || rq?.body?.model) { ev = cand; break; }
              if (!ev) ev = cand;
            }
          } catch {}
          if (!ev && inv.event_id) ev = await readEventFull(env, inv.event_id);
        } else {
          ev = await readEventFull(env, id);
          if (!ev) { rejected.push({ id, reason: 'event_not_found' }); continue; }
          try {
            const r = await env.LEDGER.prepare('SELECT * FROM invocations WHERE trace_id = ? ORDER BY ts DESC LIMIT 1')
              .bind(String(ev.trace_id || '')).first();
            inv = r || null;
          } catch {}
        }
        if (!ev) { rejected.push({ id, reason: 'no_gateway_record_for_this_id' }); continue; }
        const objectId = String(inv?.object_id || ev.key || '');
        if (!/^ADJUDICATE/i.test(objectId)) {
          rejected.push({ id, reason: 'record_is_not_an_adjudication:' + (objectId || 'unknown') }); continue;
        }
        let req = ev.request_json;
        if (typeof req === 'string') { try { req = JSON.parse(req); } catch {} }
        const msgs = req?.body?.messages || [];
        const userRaw = msgs.find((m) => m.role === 'user')?.content;
        const userText = Array.isArray(userRaw)
          ? (userRaw.find((b) => b.type === 'text')?.text || '')
          : String(userRaw || '');
        const hadImage = Array.isArray(userRaw) && userRaw.some((b) => b.type === 'image_url');
        const model = String(req?.body?.model || req?.model || '');
        if (!model) { rejected.push({ id, reason: 'model_not_recoverable_from_record' }); continue; }
        const out = textOf(ev.response_json);
        const v = /VERDICT:\s*(AFFIRM|DENY|CANNOT_CONCLUDE)/i.exec(out);
        const declaredTarget = grab(userText, /MODEL_TARGET:\s*(\S+)/i);
        if (declaredTarget && declaredTarget !== model.toLowerCase()) {
          rejected.push({ id, reason: 'model_target_in_request_does_not_match_executed_model:' + declaredTarget + ' vs ' + model }); continue;
        }
        // decision-finding@1.0.0: the deterministic parsed projection of this raw finding. It is
        // what the derivation-agreement gate compares. Evidence ids are validated against the
        // EVIDENCE_IDS the request declared, so an invented record id makes the finding malformed.
        const allowed = new Set([...String(userText).matchAll(/EVIDENCE_IDS:\s*([^\n]+)/ig)]
          .flatMap((m) => m[1].split(',').map((s2) => s2.trim()).filter(Boolean)));
        const finding = await parseDecisionFinding(out, userText, { allowedEvidence: allowed });
        rows.push({
          record: id,
          invocation_id: inv?.id || null,
          event_id: ev.id,
          object_id: objectId,
          model,
          family: family(model),
          verdict: finding.verdict || (v ? v[1].toUpperCase() : 'UNPARSED'),
          clauses: finding.applicable_rules && finding.applicable_rules.length ? finding.applicable_rules : clausesOf(out),
          finding,
          derivation_sig: finding.derivation_signature,
          structurally_valid: finding.structurally_valid,
          structural_errors: finding.structural_errors,
          ruleset_hash: finding.ruleset_hash || grab(userText, /RULESET_HASH:\s*([0-9a-f]{64})/i),
          artifact_hash: finding.artifact_hash || grab(userText, /(?:ARTIFACT_SHA256|ARTIFACT_HASH|IMAGE_SHA256|PROVISION_SHA256):\s*([0-9a-f]{64})/i),
          exposure: /PANEL_MAJORITY:/i.test(userText) ? 'saw-majority' : 'blinded-independent',
          role: /ADVERSARY/i.test(objectId) ? 'recorded adversary' : null,
          image_supplied: hadImage,
          request_bytes: ev.request_size || null,
          response_bytes: ev.response_size || null,
          confidence: (() => {
            const m = /CONFIDENCE:\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i.exec(out);
            if (!m) return null;
            const n = Number(m[1]);
            return n > 1 ? n / 100 : n;
          })(),
          receipt: inv?.id ? 'https://miscsubjects.com/receipt/' + inv.id : null,
        });
      }
    } else {
      // ── UNBOUND MODE. Caller-supplied findings are demonstration input. They can never
      // authorise anything: a fabricated verdict must not be able to approve an action.
      mode = 'unbound_caller_supplied';
      const fs2 = Array.isArray(q.findings) ? q.findings : [];
      if (!fs2.length) return 'ERR:fn:seal_panel:no_records — supply record ids (inv_… or ledger event ids) in "records"';
      rows = fs2.map((f) => ({
        record: null, invocation_id: f.invocation_id || null, event_id: null,
        object_id: String(f.row || f.object_id || ''), model: String(f.model || f.row || 'unknown'),
        family: family(f.model || f.row), verdict: String(f.verdict || 'UNPARSED').toUpperCase(),
        clauses: Array.isArray(f.clauses) ? f.clauses.map(Number) : clausesOf(f.reasoning || f.text),
        derivation_sig: Array.isArray(f.clause_evaluations) ? derivationSignature(f.clause_evaluations) : null,
        structurally_valid: false, // caller-supplied is never trusted as structurally valid
        structural_errors: ['caller_supplied_not_ledger_parsed'],
        ruleset_hash: f.ruleset_hash || null, artifact_hash: f.artifact_hash || null,
        exposure: f.exposure || null, role: f.role || null,
        confidence: typeof f.confidence === 'number' ? (f.confidence > 1 ? f.confidence / 100 : f.confidence) : null,
        receipt: null,
      }));
    }

    // The recorded adversary saw the majority. Never a channel.
    const panel = rows.filter((r) => r.role !== 'recorded adversary' && r.exposure !== 'saw-majority');
    const adversary = rows.filter((r) => !panel.includes(r));

    // MALFORMED now means: no valid verdict, OR (bound mode) the parsed decision-finding is
    // structurally invalid — missing terminal DECISION, a missing C8 field, an unparseable or
    // mismatched CLAUSE_EVALUATIONS vector, an invented clause or evidence id. A malformed
    // finding can never be a conforming channel, so it can never contribute to authorisation.
    const structurallyBad = (r) => mode === 'bound' && r.structurally_valid === false;
    const malformed = panel.filter((r) => !VALID.includes(r.verdict) || structurallyBad(r));
    const conforming = panel.filter((r) => VALID.includes(r.verdict) && !structurallyBad(r));
    const verdicts = [...new Set(conforming.map((r) => r.verdict))];
    const families = [...new Set(conforming.map((r) => r.family))];
    // Clause NUMBERS agreeing is not derivations agreeing. The gate compares the canonical
    // per-clause tuple (clause + trigger_state + disposition + load-bearing evidence). Bracket
    // clause signatures are still reported, but they no longer decide anything.
    const clauseSigs = [...new Set(conforming.map((r) => r.clauses.join(',')))];
    const derivationSigs = [...new Set(conforming.map((r) => r.derivation_sig || 'NO_VECTOR'))];
    const rulesets = [...new Set(rows.map((r) => r.ruleset_hash).filter(Boolean))];
    const artifacts = [...new Set(rows.map((r) => r.artifact_hash).filter(Boolean))];

    const reasons = [];
    if (mode === 'unbound_caller_supplied') reasons.push('unbound_caller_supplied_findings_cannot_authorise');
    if (lowerAttempt.length) reasons.push('caller_tried_to_lower_thresholds:' + lowerAttempt.join(','));
    if (rejected.length) reasons.push('rejected_records:' + rejected.map((r) => r.id + '(' + r.reason + ')').join(' '));
    if (malformed.length) reasons.push('malformed_finding:' + malformed.map((r) => r.model + (r.structural_errors && r.structural_errors.length ? '(' + r.structural_errors.slice(0, 3).join(';') + ')' : '')).join(','));
    if (conforming.length < minFindings) reasons.push('too_few_conforming_findings:' + conforming.length + '<' + minFindings);
    if (verdicts.length > 1) reasons.push('verdict_divergence:' + verdicts.join('|'));
    // The load-bearing check: derivation agreement, not citation agreement. Same verdict + same
    // clause numbers but different trigger/disposition/evidence vectors diverges here and escalates.
    if (derivationSigs.length > 1) reasons.push('derivation_divergence:' + derivationSigs.length + ' distinct clause-evaluation vectors');
    else if (mode === 'bound' && conforming.length && derivationSigs[0] === 'NO_VECTOR') reasons.push('no_clause_evaluation_vector:cannot_compare_derivations');
    if (clauseSigs.length > 1) reasons.push('clause_citation_divergence:' + clauseSigs.map((s2) => '[' + s2 + ']').join(' vs '));
    if (families.length < minFamilies) reasons.push('insufficient_channel_diversity:' + families.length + '<' + minFamilies + ' distinct training families');
    if (mode === 'bound' && rulesets.length !== 1) reasons.push('ruleset_hash_not_single:' + (rulesets.length ? rulesets.map((h) => h.slice(0, 12)).join('|') : 'none_recoverable'));
    if (mode === 'bound' && artifacts.length !== 1) reasons.push('artifact_hash_not_single:' + (artifacts.length ? artifacts.map((h) => h.slice(0, 12)).join('|') : 'none_recoverable'));
    if (q.expect_ruleset_hash && rulesets[0] !== String(q.expect_ruleset_hash).toLowerCase()) reasons.push('ruleset_hash_mismatch_against_expected');
    if (q.expect_artifact_hash && artifacts[0] !== String(q.expect_artifact_hash).toLowerCase()) reasons.push('artifact_hash_mismatch_against_expected');

    // Stated confidence is recorded and never gates unless the caller opts in. No calibration
    // study exists for it, and this panel's measured false-confidence rate is the evidence why.
    const minConfidence = q.min_confidence == null ? null : Number(q.min_confidence);
    const confidenceGates = q.require_confidence === true || q.require_confidence === 'true';
    const confidences = panel.map((r) => r.confidence).filter((x) => typeof x === 'number');
    const belowFloor = minConfidence != null && confidences.length ? confidences.filter((c) => c < minConfidence) : [];
    if (belowFloor.length && confidenceGates) reasons.push('confidence_below_floor:' + belowFloor.join(',') + '<' + minConfidence);

    let decision;
    if (reasons.length === 0) {
      decision = verdicts[0] === 'AFFIRM' ? 'APPROVE' : verdicts[0] === 'DENY' ? 'NEGATE' : 'NO_ACTION';
    } else if (reasons.length === 1 && reasons[0].startsWith('confidence_below_floor')) {
      decision = 'DISPUTE';
    } else {
      decision = 'ESCALATE';
    }
    const out = {
      kind: 'panel_seal/v3',
      mode,
      decision,
      action_authorised: decision === 'APPROVE',
      unanimous_verdict: verdicts.length === 1 ? verdicts[0] : null,
      emitted_verdict: reasons.length === 0 ? verdicts[0] : null,
      escalate_to: decision === 'ESCALATE' || decision === 'DISPUTE' ? (q.escalate_to || 'named human reviewer') : null,
      bound_to: mode === 'bound' ? { ruleset_hash: rulesets[0] || null, artifact_hash: artifacts[0] || null } : null,
      outcome_law: {
        APPROVE: 'unanimous AFFIRM with identical clause-evaluation vectors (same trigger_state, disposition and load-bearing evidence per clause), no malformed finding, and sufficient channel diversity, from ledger-loaded records',
        NEGATE: 'unanimous DENY on the same terms — the action is refused, not deferred',
        NO_ACTION: 'unanimous CANNOT_CONCLUDE — a required record is missing, so nothing is authorised and nothing is refused',
        DISPUTE: 'the only failing test is a stated confidence below the supplied floor, and only when the caller set require_confidence',
        ESCALATE: 'any verdict or clause divergence, malformed finding, rejected record, hash mismatch, insufficient channels or diversity, a threshold-lowering attempt, or caller-supplied findings',
      },
      reasons,
      rejected_records: rejected,
      arithmetic: {
        records_supplied: idList ? idList.length : (Array.isArray(q.findings) ? q.findings.length : 0),
        records_loaded: rows.length,
        counted_as_channels: panel.length,
        adversary_excluded: adversary.map((r) => r.model),
        conforming: conforming.length,
        malformed: malformed.length,
        distinct_verdicts: verdicts,
        distinct_clause_signatures: clauseSigs,
        distinct_derivation_signatures: derivationSigs,
        distinct_training_families: families,
        distinct_ruleset_hashes: rulesets,
        distinct_artifact_hashes: artifacts,
        thresholds: { min_families: minFamilies, min_findings: minFindings, floor: FLOOR, unanimity: 'required', clause_agreement: 'required', min_confidence: minConfidence },
        stated_confidences: confidences,
        confidence_gates_the_decision: confidenceGates,
        confidence_law: 'A stated confidence is recorded and never gates authorisation unless the caller sets require_confidence. No calibration study exists for these models stated confidence, and the panel measured false-confidence rate is the evidence against trusting it.',
      },
      channels: panel.map((r) => ({
        model: r.model, family: r.family, verdict: r.verdict, clauses: r.clauses,
        derivation_signature: r.derivation_sig || null,
        structurally_valid: r.structurally_valid,
        structural_errors: r.structural_errors || [],
        clause_evaluations: r.finding ? r.finding.clause_evaluations : undefined,
        confidence: r.confidence, exposure: r.exposure, image_supplied: r.image_supplied,
        event_id: r.event_id, receipt: r.receipt,
        request_bytes: r.request_bytes, response_bytes: r.response_bytes,
      })),
      law: 'A model never makes this call. Every field above is derived server-side from the gateway records named by id; caller-supplied verdicts cannot authorise anything and caller-supplied thresholds can only be raised.',
    };
    return JSON.stringify(out);
  },
  // ── THE RUNTIME ALLOCATOR ───────────────────────────────────────────────────────────────────
  // action + action class -> R, K and epsilon from a versioned SERVER-OWNED policy -> the
  // least-cost MEASURED adjudication configuration -> model execution -> ledger payload objects
  // -> the sealer -> APPROVE | NEGATE | NO_ACTION | DISPUTE | ESCALATE -> a bounded downstream act.
  //
  // The caller supplies what is being decided. It does not supply the risk, the complexity, the
  // permitted error, the thresholds or the configuration. If no measured configuration satisfies
  // the policy's epsilon for that task class, this escalates rather than guessing.
  async allocateReasoning(env, payload) {
    let q;
    try { q = typeof payload === 'string' ? JSON.parse(payload) : (payload || {}); }
    catch (e) { return 'ERR:fn:allocate:bad_json:' + e.message; }

    const POLICY_VERSION = 'logical-economics-policy@1.0.0';
    // R in dollars of loss exposure, K as a declared complexity band, epsilon as the permitted
    // rate of a wrongful AUTHORISED action. Owned here, versioned, not caller-settable.
    const POLICY = {
      'formatting':            { R: 1,        K: 'low',  epsilon: 0.40 },
      'internal-bookkeeping':  { R: 100,      K: 'low',  epsilon: 0.30 },
      'statutory-applicability': { R: 250000, K: 'high', epsilon: 0.10 },
      'board-authority':       { R: 5000000,  K: 'high', epsilon: 0.08 },
      'pre-trade-control':     { R: 50000000, K: 'high', epsilon: 0.05 },
      'clinical-finding':      { R: 10000000, K: 'high', epsilon: 0.02 },
    };
    // MEASURED configurations. Only what the probe run actually measured, for the one task class
    // it measured. undetected_wrong is the fraction of items where the assembly emitted an answer
    // and the answer was wrong. Source: /a/logical-economics, suite ffa8135d, 14 items, n is small.
    const TASK_CLASS = 'eu-ai-act-obligation-boundary-weighted';
    const MEASURED = [
      { id: 'C1-kimi27', rows: ['ADJUDICATE_ATTEST_KIMI_K27'], families: 1, undetected_wrong: 0.214, emit_rate: 1.0, calls: 1 },
      { id: 'C2-cross',  rows: ['ADJUDICATE_ATTEST_KIMI_K26', 'ADJUDICATE_ATTEST_LLAMA_33'], families: 2, undetected_wrong: 0.071, emit_rate: 0.5, calls: 2 },
      { id: 'C3-cross',  rows: ['ADJUDICATE_ATTEST_KIMI_K27', 'ADJUDICATE_ATTEST_GLM_52', 'ADJUDICATE_ATTEST_LLAMA_33'], families: 3, undetected_wrong: 0.071, emit_rate: 0.5, calls: 3 },
      { id: 'C5-all',    rows: ['ADJUDICATE_ATTEST_KIMI_K27', 'ADJUDICATE_ATTEST_KIMI_K26', 'ADJUDICATE_ATTEST_GLM_52', 'ADJUDICATE_ATTEST_GLM_FLASH', 'ADJUDICATE_ATTEST_LLAMA_33'], families: 3, undetected_wrong: 0.071, emit_rate: 0.429, calls: 5 },
      { id: 'C3-conform', rows: ['ADJUDICATE_ATTEST_KIMI_K27', 'ADJUDICATE_ATTEST_GLM_52', 'ADJUDICATE_ATTEST_GLM_FLASH'], families: 2, undetected_wrong: 0.214, emit_rate: 0.857, calls: 3 },
      { id: 'C3-kimipair', rows: ['ADJUDICATE_ATTEST_KIMI_K27', 'ADJUDICATE_ATTEST_KIMI_K26', 'ADJUDICATE_ATTEST_GLM_52'], families: 2, undetected_wrong: 0.143, emit_rate: 0.857, calls: 3 },
    ];
    // OBSERVED SHAPE CONFORMANCE, from live runs rather than from the probe. A channel that does
    // not emit the required output shape cannot contribute a conforming finding, so a
    // configuration depending on it escalates however good its measured error rate is.
    // Measured on a TEXT adjudication, one call per channel, five public receipts:
    // inv_1qauzl9ti8 inv_2rxm6r9ctw inv_7lzoxffy33 inv_oeul21xry2 inv_18zy2cflcq.
    // Four of five emitted the required shape with clause citations; llama-3.3 did not.
    // The earlier image runs are excluded here: two of those channels are not multimodal, which
    // is a capability fact about the task rather than a conformance fact about the channel.
    const CONFORMANCE = {
      'ADJUDICATE_ATTEST_KIMI_K27': { observed_conforming: 1, observed_runs: 1, receipt: 'inv_1qauzl9ti8' },
      'ADJUDICATE_ATTEST_GLM_52': { observed_conforming: 1, observed_runs: 1, receipt: 'inv_2rxm6r9ctw' },
      'ADJUDICATE_ATTEST_GLM_FLASH': { observed_conforming: 1, observed_runs: 1, receipt: 'inv_7lzoxffy33' },
      // kimi-k2.6 conformed once and then returned UNPARSED or nothing at all on three further
      // live runs, twice hanging long enough to exhaust the request budget. 1 of 4.
      'ADJUDICATE_ATTEST_KIMI_K26': { observed_conforming: 1, observed_runs: 4, receipt: 'inv_oeul21xry2' },
      'ADJUDICATE_ATTEST_LLAMA_33': { observed_conforming: 0, observed_runs: 1, receipt: 'inv_18zy2cflcq' },
    };
    const conformanceOf = (rows2) => rows2.map((r) => {
      const c = CONFORMANCE[r];
      return { row: r, observed_shape_conformance: c ? +(c.observed_conforming / c.observed_runs).toFixed(3) : null, observed_runs: c ? c.observed_runs : 0, conformance_receipt: c ? c.receipt : null };
    });
    const expConf = (c) => conformanceOf(c.rows).reduce((a, x) => a + (x.observed_shape_conformance || 0), 0);
    const FLOOR_MEASURED = Math.min(...MEASURED.map((c) => c.undetected_wrong));

    const actionClass = String(q.action_class || '');
    const pol = POLICY[actionClass];
    if (!pol) return 'ERR:fn:allocate:unknown_action_class:' + actionClass + ' — known: ' + Object.keys(POLICY).join(',');
    const action = String(q.action || '');
    const question = String(q.question || '');
    const rulesetHash = String(q.ruleset_hash || '');
    const rulesetUrl = String(q.ruleset_url || '');
    const rules = Array.isArray(q.rules) ? q.rules : [];
    const artifact = String(q.artifact || '');
    const artifactHash = String(q.artifact_hash || '');
    if (!action || !question || !rulesetHash || !rules.length || !artifactHash) {
      return 'ERR:fn:allocate:need action, question, ruleset_hash, rules[], artifact_hash';
    }
    const taskClassMatches = String(q.task_class || TASK_CLASS) === TASK_CLASS;

    // ── selection: least calls among measured configurations meeting epsilon ──────────────────
    const candidates = MEASURED.map((c) => ({
      id: c.id, calls: c.calls, families: c.families,
      measured_undetected_wrong: c.undetected_wrong, measured_emit_rate: c.emit_rate,
      meets_epsilon: c.undetected_wrong <= pol.epsilon,
      meets_gate_floor: c.calls >= 3 && c.families >= 2,
      channel_conformance: conformanceOf(c.rows),
      expected_conforming_channels: +expConf(c).toFixed(3),
      rejected_because: expConf(c) < 3 ? 'observed_shape_conformance_cannot_supply_3_conforming_findings'
        : c.undetected_wrong > pol.epsilon ? 'measured_undetected_wrong_exceeds_epsilon'
        : (c.calls < 3 ? 'fewer_channels_than_the_gate_floor_min_findings_3'
        : (c.families < 2 ? 'fewer_training_families_than_the_gate_floor_2' : null)),
    }));
    // A configuration the gate can never authorise is not a candidate: the sealer's server-owned
    // floor requires 3 conforming findings across 2 training families, so the cheapest
    // authorising configuration is 3 cross-family channels no matter how loose epsilon is.
    const viable = MEASURED
      .filter((c) => c.undetected_wrong <= pol.epsilon && c.calls >= 3 && c.families >= 2 && expConf(c) >= 3)
      .sort((a, b) => a.calls - b.calls || b.families - a.families || expConf(b) - expConf(a) || a.undetected_wrong - b.undetected_wrong);
    const chosen = taskClassMatches ? (viable[0] || null) : null;
    const selection_reason = !taskClassMatches
      ? 'no_measured_p_wrong_for_this_task_class:' + String(q.task_class || '') + ' — the only measured class is ' + TASK_CLASS
      : chosen
        ? 'least-call measured configuration whose undetected-wrong rate ' + chosen.undetected_wrong + ' is at or below the policy epsilon ' + pol.epsilon
        : 'no_viable_configuration_for_epsilon:' + pol.epsilon + ' — the measured floor for this task class is ' + FLOOR_MEASURED + ', and every configuration that reaches it depends on a channel whose observed shape conformance is below 1, so no configuration can both meet epsilon and supply 3 conforming findings';

    const allocation = {
      kind: 'reasoning_allocation/v1',
      policy_version: POLICY_VERSION,
      task_class_measured: TASK_CLASS,
      inputs: { action, action_class: actionClass, question, ruleset_hash: rulesetHash, artifact_hash: artifactHash, task_class: String(q.task_class || TASK_CLASS) },
      derived: { R_loss_exposure_usd: pol.R, K_complexity: pol.K, epsilon_permitted_wrongful_action_rate: pol.epsilon },
      candidates,
      chosen: chosen ? { id: chosen.id, rows: chosen.rows, calls: chosen.calls, families: chosen.families, measured_undetected_wrong: chosen.undetected_wrong, measured_emit_rate: chosen.emit_rate } : null,
      selection_reason,
      expected_cost: chosen ? { model_calls: chosen.calls, note: 'Cloudflare unified billing reports 0 provider cost on these Workers AI rows; cost is stated in calls, not invented in dollars.' } : null,
      expected_loss_at_epsilon_usd: chosen ? Math.round(chosen.undetected_wrong * pol.R) : null,
      law: 'R, K and epsilon come from the server-owned policy above. The caller supplies only what is being decided.',
    };

    if (!chosen) {
      allocation.decision = 'ESCALATE';
      allocation.action_authorised = false;
      allocation.seal = null;
      allocation.downstream = { performed: 'none', reason: 'no measured configuration satisfies the policy epsilon, so nothing was executed' };
      return JSON.stringify(allocation);
    }

    // ── execution: one call per channel, each landing a full gateway payload on the ledger ────
    const body = [
      'QUESTION PUT TO YOU: ' + question, '',
      // decision-finding@1.0.0 parses the constitution version from the REQUEST text; omitting
      // it made every finding structurally invalid (constitution_absent_from_request, 2026-08-03).
      'CONSTITUTION: decision-constitution@1.3.3', '',
      'RULESET_URL: ' + rulesetUrl, 'RULESET_HASH: ' + rulesetHash, 'RULESET (numbered clauses):',
    ].concat(rules.map((r, i) => (i + 1) + '. ' + r))
     .concat(['', 'ARTIFACT_SHA256: ' + artifactHash, 'ARTIFACT:', artifact, '']);
    // Channels run in PARALLEL. Sequential execution of three model calls exceeds the request
    // budget (measured: 125s and a dead request), and wall time is the slowest channel, not the sum.
    // Each channel is TIME-BOXED: a channel that hangs (kimi-k2.6, observed twice, and again
    // 2026-08-03 killing an entire C5 run at the 524 boundary with zero events written) becomes a
    // recorded non-conforming finding the seal can see, never a dead request that erases the panel.
    const CHANNEL_BUDGET_MS = 75000;
    const dir0 = await loadDirectory(env);
    const invocations = await Promise.all(chosen.rows.map(async (rowKey) => {
      const target = dir0[rowKey]?.target || '';
      const res = await Promise.race([
        dispatch(env, rowKey, body.concat(['MODEL_TARGET: ' + target]).join('\n'),
          { actor: 'allocator:' + POLICY_VERSION }),
        new Promise((resolve) => setTimeout(() => resolve({ trace: null, event_id: null,
          result: 'ERR:channel_timeout:' + rowKey + ' exceeded ' + CHANNEL_BUDGET_MS + 'ms — recorded as non-conforming' }), CHANNEL_BUDGET_MS)),
      ]);
      // A nested dispatch writes ledger EVENTS; the invocation receipt is minted by the HTTP
      // route layer, so the payload object is addressed by its event id here. The sealer loads
      // either kind.
      // res.event_id is the dispatch STEP event (action 'agent'), which carries the tag body and
      // no model. The payload object is the chat_completion call for the trace, and only one that
      // actually yields a model is usable — measured the hard way: three rejected records.
      let eventId = null;
      if (res?.trace) {
        try {
          const rs = (await env.LEDGER.prepare(
            "SELECT id FROM events WHERE trace_id = ? AND action = 'chat_completion' ORDER BY ts ASC, id ASC LIMIT 5")
            .bind(String(res.trace)).all()).results || [];
          for (const r of rs) {
            const cand = await readEventFull(env, r.id);
            if (!cand) continue;
            let rq = cand.request_json;
            if (typeof rq === 'string') { try { rq = JSON.parse(rq); } catch {} }
            if (rq?.model || rq?.body?.model) { eventId = r.id; break; }
            if (!eventId) eventId = r.id;
          }
        } catch {}
      }
      if (!eventId) eventId = res?.event_id || null;
      return { row: rowKey, target, trace: res?.trace || null, event_id: eventId, ok: !!eventId,
        result_head: String(res?.result || '').slice(0, 200) };
    }));
    allocation.executed = invocations;
    const ids = invocations.map((x) => x.event_id).filter(Boolean);

    // ── the seal, bound to the records just written ──────────────────────────────────────────
    const sealRaw = await FN_MAP.sealPanel(env, JSON.stringify({
      records: ids, expect_ruleset_hash: rulesetHash, expect_artifact_hash: artifactHash,
      min_families: chosen.families, escalate_to: q.escalate_to || 'named blinded human reviewer',
    }));
    let seal;
    try { seal = JSON.parse(sealRaw); } catch { seal = { decision: 'ESCALATE', reasons: ['seal_unparseable:' + String(sealRaw).slice(0, 200)] }; }
    allocation.seal = seal;
    allocation.decision = seal.decision;
    allocation.action_authorised = seal.action_authorised === true;

    // ── the bounded downstream act. Only APPROVE executes it. ────────────────────────────────
    const stamp = (env.TRACE_CTX && env.TRACE_CTX.trace) || 'notrace';
    const kvKey = 'surety/action/' + actionClass + '/' + stamp;
    if (seal.decision === 'APPROVE') {
      let wrote = 'ERR:no_kv_binding';
      if (env.KV) {
        await env.KV.put(kvKey, JSON.stringify({ action, action_class: actionClass, authorised_at: buildNowIso(),
          policy_version: POLICY_VERSION, configuration: chosen.id, records: ids,
          ruleset_hash: rulesetHash, artifact_hash: artifactHash }));
        wrote = 'ok';
      }
      allocation.downstream = { performed: 'executed', target: 'KV ' + kvKey, write: wrote,
        law: 'Only APPROVE reaches this branch.' };
    } else if (seal.decision === 'NEGATE') {
      allocation.downstream = { performed: 'refused', target: 'KV ' + kvKey, write: 'not_written',
        law: 'NEGATE refuses the action. The refusal is the outcome, not a deferral.' };
    } else if (seal.decision === 'NO_ACTION') {
      allocation.downstream = { performed: 'untouched', target: 'KV ' + kvKey, write: 'not_written',
        law: 'A required record was missing. Nothing is authorised and nothing is refused.' };
    } else {
      // DISPUTE and ESCALATE create a real human-review object bound to a NAMED reviewer, and a
      // witness token bound to that reviewer's audience so the blinding is a held credential
      // rather than a promise.
      const reviewer = String(q.reviewer || '').trim();
      const audience = String(q.reviewer_audience || '').trim() || (reviewer ? reviewer.toLowerCase().replace(/[^a-z0-9]+/g, '-') : '');
      const hr = { requested: true, reviewer: reviewer || null, audience: audience || null };
      if (!reviewer) {
        hr.error = 'no_reviewer_named — escalation would terminate at a role; supply reviewer';
      } else {
        const rBody = ['RULESET_HASH: ' + rulesetHash, 'ARTIFACT_HASH: ' + artifactHash,
          'REVIEWER: ' + reviewer, 'BLINDED: true', 'VERDICT: PENDING',
          'BASIS: review requested by the allocator under policy ' + POLICY_VERSION + '. The reviewer sees the artifact and the rule set and NOT the model verdicts. No verdict is recorded until the named human returns one.',
          'DATE: ' + buildNowIso(), 'MODEL_TARGET: record-only'].join('\n');
        const rr = await dispatch(env, 'ADJUDICATE_HUMAN_REVIEW', rBody, { actor: 'allocator:' + POLICY_VERSION });
        hr.review_object_trace = rr?.trace || null;
        hr.review_object_recorded = String(rr?.result || '').slice(0, 400);
        const primary = ids[0];
        if (primary && audience) {
          const wt = await dispatch(env, 'WITNESS_MINT', primary + '|' + audience + '|604800',
            { actor: 'allocator:' + POLICY_VERSION });
          hr.witness_trace = wt?.trace || null;
          try {
            const parsed = JSON.parse(typeof wt?.result === 'string' ? wt.result : JSON.stringify(wt?.result || '{}'));
            hr.witness_fingerprint = parsed.fingerprint || null;
            hr.witness_audience = parsed.audience || null;
            hr.witness_ttl_seconds = parsed.ttl_seconds || null;
          } catch {}
        }
      }
      allocation.downstream = { performed: 'human_review_requested', target: 'KV ' + kvKey, write: 'not_written',
        human_review: hr, law: 'DISPUTE and ESCALATE do not touch the action. They create a review object bound to a named reviewer.' };
    }
    return JSON.stringify(allocation);
  },
  async r2Put(env, key, value) {
    if (!env.R2) return 'ERR:fn:no_r2_binding';
    await env.R2.put(String(key), String(value));
    return 'OK';
  },
  async r2Get(env, key) {
    if (!env.R2) return 'ERR:fn:no_r2_binding';
    const obj = await env.R2.get(String(key));
    if (!obj) return '';
    return await obj.text();
  },
  async r2Del(env, key) {
    if (!env.R2) return 'ERR:fn:no_r2_binding';
    await env.R2.delete(String(key));
    return 'OK';
  },
  async r2List(env, prefix) {
    if (!env.R2) return 'ERR:fn:no_r2_binding';
    const r = await env.R2.list({ prefix: String(prefix || '') });
    return JSON.stringify(r.objects.map(o => ({ key: o.key, size: o.size, uploaded: o.uploaded })));
  },
  // Grok STT — POST audio bytes (fetched from url) to https://api.x.ai/v1/stt as
  // multipart/form-data. The Grok API requires multipart (urlencoded is rejected),
  // and the worker http row template can't build multipart, so this lives as a fn.
  // Arg: $1 = audio URL (public). Returns the transcript text on success.
  async grokStt(env, url) {
    const u = String(url || '').trim();
    if (!u) return 'ERR:fn:grokStt:no_url';
    if (!env.GROK_API_KEY) return 'ERR:fn:grokStt:no_key';
    let ab;
    try {
      const r = await fetch(u);
      if (!r.ok) return 'ERR:fn:grokStt:fetch_audio_' + r.status;
      ab = await r.arrayBuffer();
    } catch (e) { return 'ERR:fn:grokStt:fetch:' + (e && e.message || String(e)); }
    const lastSeg = u.split('?')[0].split('/').pop() || 'audio';
    const ext = (lastSeg.match(/\.[a-z0-9]+$/i) || ['.mp3'])[0].toLowerCase();
    const mime = { '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.webm': 'audio/webm' }[ext] || 'audio/mpeg';
    const fd = new FormData();
    fd.append('format', 'true');
    fd.append('language', 'en');
    fd.append('file', new Blob([ab], { type: mime }), 'audio' + ext);
    try {
      const r = await fetch('https://api.x.ai/v1/stt', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.GROK_API_KEY },
        body: fd,
      });
      const txt = await r.text();
      if (!r.ok) return 'ERR:fn:grokStt:http_' + r.status + ':' + txt.slice(0, 300);
      try { return String(JSON.parse(txt).text || txt); } catch { return txt; }
    } catch (e) { return 'ERR:fn:grokStt:post:' + (e && e.message || String(e)); }
  },
  regexParse(env, input) {
    const re = /\[([A-Z_][A-Z0-9_]*)\]([\s\S]*?)\[\/\1\](?:\s+as\s+(\w+))?/g;
    const tags = [];
    let m;
    while ((m = re.exec(String(input || ''))) !== null) tags.push({ key: m[1], body: m[2], bind: m[3] || null, match: m[0] });
    return JSON.stringify({ count: tags.length, tags });
  },
  envGet(env, name) {
    return String(env[String(name)] == null ? '' : env[String(name)]);
  },
  // How many past turns the build keeps per chat. Stored in KV 'convo_max' (default 14).
  // The router/terminal agent edits it on natural-language request ("remember more").
  async setConvoMax(env, n) {
    const v = parseInt(n, 10);
    if (!Number.isFinite(v) || v < 1 || v > 100) return 'ERR:fn:bad_count (1-100)';
    if (env.KV) await env.KV.put('convo_max', String(v));
    return JSON.stringify({ convo_max: v });
  },
  async getConvoMax(env) {
    const v = env.KV ? await env.KV.get('convo_max') : null;
    return JSON.stringify({ convo_max: parseInt(v || '14', 10) || 14 });
  },
  // reasoning_effort for every xAI (grok) model call. Values: low|medium|high|none|default.
  // 'default' or empty = omit the field (let xAI decide). Applies to all grok agents.
  async setGrokReasoningEffort(env, level) {
    const v = String(level || '').trim().toLowerCase();
    const valid = ['low', 'medium', 'high', 'none', 'default', ''];
    if (!valid.includes(v)) return 'ERR:fn:bad_level (low|medium|high|none|default)';
    if (env.KV) {
      if (!v || v === 'default') await env.KV.delete('grok_reasoning_effort');
      else await env.KV.put('grok_reasoning_effort', v);
    }
    return JSON.stringify({ grok_reasoning_effort: v || 'default' });
  },
  async getGrokReasoningEffort(env) {
    const v = env.KV ? await env.KV.get('grok_reasoning_effort') : null;
    return JSON.stringify({ grok_reasoning_effort: v || 'default (model decides)' });
  },
  // Read a stored doc by slug (full body). The agent calls this when it needs to
  // answer a question from the raw API documentation. Arg: slug (e.g. arcads).
  async docsGet(env, slug) {
    const row = await env.DB.prepare('SELECT slug, title, body FROM docs WHERE slug = ?').bind(String(slug)).first();
    if (!row) {
      const all = await env.DB.prepare('SELECT slug FROM docs').all();
      return 'ERR:fn:no_doc:' + slug + ':available=' + (all.results || []).map(r => r.slug).join(',');
    }
    return JSON.stringify({ slug: row.slug, title: row.title, body: row.body });
  },
  // Search stored docs (title + body LIKE). Arg: query. Returns matching slugs + snippets.
  async docsSearch(env, query) {
    const like = '%' + String(query || '').toLowerCase() + '%';
    const r = await env.DB.prepare(
      'SELECT slug, title, substr(body,1,400) snippet FROM docs WHERE LOWER(title) LIKE ? OR LOWER(body) LIKE ? LIMIT 10'
    ).bind(like, like).all();
    return JSON.stringify(r.results || []);
  },
  // Credits used this calendar month (sum of creditsCharged logged to arcads_ledger).
  async arcadsCredits(env) {
    const cap = Number((await env.DB.prepare("SELECT value FROM settings WHERE key='arcads_monthly_credits'").first())?.value || 80440);
    const monthStart = buildNowIso().slice(0, 7) + '-01T00:00:00.000Z';
    const used = Number((await env.DB.prepare('SELECT COALESCE(SUM(credits),0) c FROM arcads_ledger WHERE ts >= ?').bind(monthStart).first())?.c || 0);
    return JSON.stringify({ month: monthStart.slice(0, 7), used, cap, remaining: cap - used });
  },
  // Upload a file to ArcAds via presigned URL. Args: source_url|file_type. Returns the
  // S3 filePath to pass in referenceImages. Sequence: presign + S3 PUT.
  async arcadsUpload(env, sourceUrl, fileType) {
    const r = await arcadsUploadInner(env, String(sourceUrl), fileType);
    return typeof r === 'string' ? r : JSON.stringify(r);
  },
  // ArcAds VIDEO generation. Args: model|prompt|aspectRatio|referenceImages|duration|productId
  //   model: sora2 | sora2-pro | veo31 | kling-2.6 | kling-3.0 | grok-video | seedance | seedance-2.0 | happy-horse
  async arcadsVideoGenerate(env, model, prompt, aspectRatio, referenceImages, duration, productId, resolution) {
    const base = env.ARCADS_BASE_URL || 'https://external-api.arcads.ai';
    if (!env.ARCADS_BASIC_AUTH) return 'ERR:fn:no_arcads_auth';
    const budget = JSON.parse(await FN_MAP.arcadsCredits(env));
    if (budget.remaining <= 0) return 'ERR:fn:arcads_budget_exhausted:' + JSON.stringify(budget);
    const headers = { 'Authorization': env.ARCADS_BASIC_AUTH, 'Accept': 'application/json', 'Content-Type': 'application/json' };
    let refs = String(referenceImages || '').split(',').map(s => s.trim()).filter(Boolean);
    refs = await Promise.all(refs.map(async r => /^https?:\/\//.test(r) ? (await arcadsUploadInner(env, r, 'image/png')).filePath || r : r));
    const m = String(model || 'grok-video');
    const payload = { model: m, productId: String(productId || 'acbf46ed-c1b0-4858-8690-6cccaa082774'), prompt: String(prompt || ''), resolution: String(resolution || '720p') };
    if (aspectRatio) payload.aspectRatio = String(aspectRatio);
    if (duration) payload.duration = Number(duration);
    if (refs.length) payload.referenceImages = refs;
    const genResp = await fetch(base + '/v2/videos/generate', { method: 'POST', headers, body: JSON.stringify(payload) });
    const genText = await genResp.text();
    // Standing order: every outbound HTTP payload fully logged (Authorization redacted).
    await logEvent(env, {
      source: 'arcads', key: 'ARCADS_VIDEO_GENERATE', action: 'http_out', direction: 'OUT',
      trace_id: env.TRACE_CTX?.trace || null, status: genResp.status,
      request: JSON.stringify({ url: base + '/v2/videos/generate', method: 'POST', headers: { ...headers, 'Authorization': 'Basic <REDACTED>' }, body: payload }),
      response: genText,
    });
    let gen; try { gen = JSON.parse(genText); } catch { gen = null; }
    const id = gen?.id;
    if (!id) return 'ERR:fn:arcads_video:' + genText.slice(0, 300);
    // Fire-and-return — the /api/deliver poller stores + delivers (see arcadsGenerate).
    return JSON.stringify({ arcads_id: id, status: 'pending', credits: 0, note: 'render started; stored + delivered in background' });
  },
  async arcadsGenerate(env, model, prompt, aspectRatio, referenceImages, productId, enhance) {
    const base = env.ARCADS_BASE_URL || 'https://external-api.arcads.ai';
    const auth = env.ARCADS_BASIC_AUTH;
    if (!auth) return 'ERR:fn:no_arcads_auth';
    const budget = JSON.parse(await FN_MAP.arcadsCredits(env));
    if (budget.remaining <= 0) return 'ERR:fn:arcads_budget_exhausted:' + JSON.stringify(budget);
    const headers = { 'Authorization': auth, 'Accept': 'application/json', 'Content-Type': 'application/json' };
    let refs = String(referenceImages || '').split(',').map(s => s.trim()).filter(Boolean);
    // Auto-upload any http(s) reference image to ArcAds → swap to its S3 filePath.
    refs = await Promise.all(refs.map(async r => /^https?:\/\//.test(r) ? ((await arcadsUploadInner(env, r, 'image/png')).filePath || r) : r));
    const payload = {
      model: String(model || 'nano-banana'),
      productId: String(productId || 'acbf46ed-c1b0-4858-8690-6cccaa082774'),
      prompt: String(prompt || ''),
      aspectRatio: String(aspectRatio || '9:16'),
      enhance: String(enhance == null ? 'true' : enhance).toLowerCase() !== 'false',
    };
    if (refs.length) payload.referenceImages = refs;
    const genResp = await fetch(base + '/v2/images/generate', { method: 'POST', headers, body: JSON.stringify(payload) });
    const genText = await genResp.text();
    // Standing order: every outbound HTTP payload fully logged (Authorization redacted).
    await logEvent(env, {
      source: 'arcads', key: 'ARCADS_GENERATE', action: 'http_out', direction: 'OUT',
      trace_id: env.TRACE_CTX?.trace || null, status: genResp.status,
      request: JSON.stringify({ url: base + '/v2/images/generate', method: 'POST', headers: { ...headers, 'Authorization': 'Basic <REDACTED>' }, body: payload }),
      response: genText,
    });
    let gen; try { gen = JSON.parse(genText); } catch { gen = null; }
    const id = gen?.id;
    if (!id) return 'ERR:fn:arcads_generate:' + genText.slice(0, 300);
    // IMAGE PROMPT LAW. Every render files its own prompt at generate time, keyed by the
    // arcads id, before any image exists. 259 generated images carried no prompt because the
    // only record was the outbound event log, which nothing reads — so the owner could not
    // review which briefs produced good images and which produced garbage, and the design law
    // could not be written from evidence. The row is written here and completed by arcadsToR2.
    try {
      await FN_MAP.logAsset(env, 'generated', id, null, refs.join(',') || null,
        'arcads:' + payload.model, payload.prompt, null, null, null, 0, null, null);
      await env.DB.prepare('UPDATE assets SET notes = ? WHERE label = ?')
        .bind(JSON.stringify({ arcads_id: id, aspect_ratio: payload.aspectRatio, enhance: payload.enhance, reference_images: refs, product_id: payload.productId }), id).run();
    } catch {}
    return JSON.stringify({ arcads_id: id, status: 'pending', credits: 0, note: 'render started; stored + delivered in background' });
  },
  // File an image into the asset library. Args: category|label|url|source_url|engine|prompt|sender|chat|protocol|is_group|parent_id|r2_key.
  // Returns the asset id. Categories: product_vial|best_ad|competitor_ad|reference|generated.
  async logAsset(env, category, label, url, sourceUrl, engine, prompt, sender, chat, protocol, isGroup, parentId, r2Key) {
    const id = 'as_' + crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO assets (id, created_at, category, label, r2_key, url, source_url, engine, prompt, sender, chat, protocol, is_group, parent_id, notes) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, buildNowIso(), String(category || 'reference'), label || null, r2Key || null,
      url || null, sourceUrl || null, engine || null, prompt || null, sender || null, chat || null,
      protocol || null, Number(isGroup) ? 1 : 0, parentId || null, null).run();
    return id;
  },
  // Store a reference image (e.g. one a user sent via Blooio) to R2 and return a
  // stable public link + filename. Arg: source_url.
  async storeRefImage(env, sourceUrl) {
    if (!env.R2) return 'ERR:fn:no_r2';
    const r = await fetch(String(sourceUrl));
    if (!r.ok) return 'ERR:fn:fetch_ref:' + r.status;
    const ct = r.headers.get('content-type') || 'image/png';
    const ext = ct.includes('jpeg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png';
    const key = `img/ref/${crypto.randomUUID()}.${ext}`;
    await env.R2.put(key, await r.arrayBuffer(), { httpMetadata: { contentType: ct } });
    const url = 'https://miscsubjects.com/' + key;
    return JSON.stringify({ filename: key.split('/').pop(), key, url });
  },
  // OpenAI gpt-image-1.5 text-to-image. Returns a stable R2 link. Args: prompt|size.
  async openaiImage(env, prompt, size) {
    if (!env.OPENAI_API_KEY) return 'ERR:fn:no_openai_key';
    const body = { model: 'gpt-image-1.5', prompt: String(prompt), n: 1, size: String(size || '1024x1024') };
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json();
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) return 'ERR:fn:openai:' + JSON.stringify(j).slice(0, 300);
    return await storeB64Png(env, b64, 'openai');
  },
  // OpenAI gpt-image-1.5 edit using a reference image URL. Args: prompt|reference_url|size.
  async openaiImageEdit(env, prompt, refUrl, size) {
    if (!env.OPENAI_API_KEY) return 'ERR:fn:no_openai_key';
    const body = { model: 'gpt-image-1.5', prompt: String(prompt), images: [{ image_url: String(refUrl) }], n: 1, size: String(size || '1024x1024') };
    const r = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json();
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) return 'ERR:fn:openai_edit:' + JSON.stringify(j).slice(0, 300);
    return await storeB64Png(env, b64, 'openai');
  },
  // Dual-engine: generate (or edit, if reference_url given) with BOTH OpenAI and
  // Grok Imagine, store both to R2, return both stable links. Args: prompt|reference_url.
  async genDual(env, prompt, referenceUrl) {
    const ref = String(referenceUrl || '').trim();
    const [openai, grok] = await Promise.all([
      ref ? FN_MAP.openaiImageEdit(env, prompt, ref) : FN_MAP.openaiImage(env, prompt),
      grokImageToR2(env, prompt, ref),
    ]);
    return JSON.stringify({ prompt: String(prompt), reference_url: ref || null, openai, grok });
  },
  // Grok Imagine → re-stored to R2 → stable https://miscsubjects.com/img/ link.
  // Row GROK_IMAGE_R2 target. Args: prompt|reference_url(optional).
  async grokImageToR2(env, prompt, refUrl) { return grokImageToR2(env, prompt, refUrl); },
  // Resolve a finished ArcAds asset (arcads_id) and re-store its bytes to R2 for a stable
  // https://miscsubjects.com/img/ link. Poll-until-ready, then permanent. Args: arcads_id|model.
  async arcadsToR2(env, assetId, model) {
    const base = env.ARCADS_BASE_URL || 'https://external-api.arcads.ai';
    if (!env.ARCADS_BASIC_AUTH) return 'ERR:fn:no_arcads_auth';
    if (!env.R2) return 'ERR:fn:no_r2';
    const headers = { 'Authorization': env.ARCADS_BASIC_AUTH, 'Accept': 'application/json' };
    const id = String(assetId || '').trim();
    if (!id) return 'ERR:fn:arcads_id_required';
    for (let i = 0; i < 40; i++) {
      let a = null;
      try { a = await (await fetch(base + '/v1/assets/' + id, { headers })).json(); } catch {}
      const url = a?.url || a?.imageUrl || a?.outputUrl || (Array.isArray(a?.outputs) && a.outputs[0]?.url) || null;
      const status = String(a?.status || a?.state || '');
      if (!url && /fail|error|expired/i.test(status)) return 'ERR:fn:arcads_failed:' + status;
      if (url) {
        try {
          const ir = await fetch(url);
          const ct = ir.headers.get('content-type') || '';
          if (ir.ok && /^(image|video)\//i.test(ct)) {
            const ext = /^video/i.test(ct) ? 'mp4' : (ct.includes('jpeg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png');
            const key = `img/gen/arcads-${String(model || a?.type || 'gen')}-${id}.${ext}`;
            await env.R2.put(key, await ir.arrayBuffer(), { httpMetadata: { contentType: ct } });
            // Complete the row arcadsGenerate opened, so the prompt and the image it produced
            // are one record. Without this the prompt exists and points at nothing.
            try {
              await env.DB.prepare('UPDATE assets SET url = ?, r2_key = ? WHERE label = ? AND (url IS NULL OR url = \'\')')
                .bind('https://miscsubjects.com/' + key, key, id).run();
            } catch {}
            return JSON.stringify({ engine: 'arcads', arcads_id: id, model: model || a?.type || '', key, url: 'https://miscsubjects.com/' + key, credits: a?.data?.creditsCharged || 0 });
          }
        } catch {}
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    return 'ERR:fn:arcads_not_ready_after_120s:' + id;
  },
  async httpFetch(env, method, url, body, headersJson) {
    const m = String(method || 'GET').toUpperCase();
    let headers = { 'User-Agent': 'miscsubjects-build' };
    if (headersJson) { try { headers = { ...headers, ...JSON.parse(headersJson) }; } catch {} }
    const init = { method: m, headers };
    if (body && m !== 'GET' && m !== 'HEAD') {
      init.body = body;
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }
    let resp, text;
    try { resp = await fetch(String(url), init); text = await resp.text(); }
    catch (e) {
      await logEvent(env, { source: 'fetch', key: 'HTTP_FETCH', action: 'http_out', direction: 'OUT', trace_id: env.TRACE_CTX?.trace || null,
        request: JSON.stringify(redactReq({ url, method: m, headers, body })), response: 'ERR:' + e.message });
      return 'ERR:fn:fetch:' + e.message;
    }
    await logEvent(env, { source: 'fetch', key: 'HTTP_FETCH', action: 'http_out', direction: 'OUT', trace_id: env.TRACE_CTX?.trace || null, status: resp.status,
      request: JSON.stringify(redactReq({ url, method: m, headers, body })), response: text });
    return 'HTTP ' + resp.status + ':' + text.slice(0, 20000);
  },
  async voiceSay(env, text, voice) {
    if (!env.OPENAI_API_KEY) return 'ERR:fn:no_openai_key';
    if (!env.R2) return 'ERR:fn:no_r2';
    const body = { model: 'gpt-4o-mini-tts', voice: String(voice || 'alloy'), input: String(text || ''), response_format: 'mp3' };
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!r.ok) {
      // gpt-4o-mini-tts may be unavailable on the key — fall back to tts-1.
      const r2 = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, model: 'tts-1' }),
      });
      if (!r2.ok) return 'ERR:fn:openai_tts:' + r2.status + ':' + (await r2.text()).slice(0, 200);
      const key2 = `img/aud/tts-${crypto.randomUUID()}.mp3`;
      await env.R2.put(key2, await r2.arrayBuffer(), { httpMetadata: { contentType: 'audio/mpeg' } });
      return JSON.stringify({ engine: 'openai-tts-1', url: 'https://miscsubjects.com/' + key2, filename: key2.split('/').pop() });
    }
    const key = `img/aud/tts-${crypto.randomUUID()}.mp3`;
    await env.R2.put(key, await r.arrayBuffer(), { httpMetadata: { contentType: 'audio/mpeg' } });
    return JSON.stringify({ engine: 'gpt-4o-mini-tts', url: 'https://miscsubjects.com/' + key, filename: key.split('/').pop() });
  },
  // Voice IN: download an audio attachment URL and transcribe it (OpenAI whisper-1).
  // Arg: audio_url. Returns the transcript text. Blooio inbound audio → this → the agent.
  async voiceTranscribe(env, audioUrl) {
    if (!env.OPENAI_API_KEY) return 'ERR:fn:no_openai_key';
    const src = await fetch(String(audioUrl));
    if (!src.ok) return 'ERR:fn:fetch_audio:' + src.status;
    const blob = await src.blob();
    const form = new FormData();
    form.append('file', blob, 'audio.mp3');
    form.append('model', 'whisper-1');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + env.OPENAI_API_KEY }, body: form,
    });
    const j = await r.json();
    if (j.text == null) return 'ERR:fn:whisper:' + JSON.stringify(j).slice(0, 200);
    return String(j.text);
  },
  // Send a voice message: TTS the text, then POST it to a Blooio chat as an attachment.
  // Args: chat|text|voice. One call = audio in the owner's iMessage. Used by the VOICE agent.
  async voiceSendBlooio(env, chat, text, voice) {
    if (!env.BLOOIO_API_KEY) return 'ERR:fn:no_blooio_key';
    const said = await FN_MAP.voiceSay(env, text, voice);
    let url; try { url = JSON.parse(said).url; } catch { return said; }
    if (!url) return 'ERR:fn:voice_say:' + said;
    const r = await fetch(`https://backend.blooio.com/v2/api/chats/${encodeURIComponent(chat)}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.BLOOIO_API_KEY },
      body: JSON.stringify({ attachments: [url] }),
    });
    return JSON.stringify({ audio_url: url, blooio_status: r.status, blooio_body: (await r.text()).slice(0, 200) });
  },
  // GROK_TTS (x.ai ara) → R2 → Blooio attachment. Args: chat|text|voice_id (default ara).
  async grokVoiceSendBlooio(env, chat, text, voiceId) {
    if (!env.GROK_API_KEY) return 'ERR:fn:no_grok_key';
    if (!env.BLOOIO_API_KEY) return 'ERR:fn:no_blooio_key';
    if (!env.R2) return 'ERR:fn:no_r2';
    const r = await fetch('https://api.x.ai/v1/tts', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.GROK_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: String(text || '').slice(0, 1200), voice_id: String(voiceId || 'ara'), language: 'en' }),
    });
    if (!r.ok) return 'ERR:fn:grok_tts:' + r.status + ':' + (await r.text()).slice(0, 200);
    const key = `img/aud/grok-${crypto.randomUUID()}.mp3`;
    await env.R2.put(key, await r.arrayBuffer(), { httpMetadata: { contentType: 'audio/mpeg' } });
    const url = 'https://miscsubjects.com/' + key;
    const chatId = String(chat || '').trim();
    // v2 chats URL = E.164 phone or grp_*; chat_* needs Blooio MCP send_chat_message.
    if (chatId.startsWith('chat_')) {
      const sent = await FN_MAP.mcpToolCall(
        env,
        'https://mcp.blooio.com/v4',
        'send_chat_message',
        JSON.stringify({ chat_id: chatId, attachments: [url] }),
        'BLOOIO_API_KEY_PEPPERUP',
      );
      if (String(sent).startsWith('ERR:')) {
        return JSON.stringify({ ok: false, audio_url: url, blooio_error: String(sent).slice(0, 300) });
      }
      return JSON.stringify({ ok: true, audio_url: url, blooio_status: 202, blooio_body: String(sent).slice(0, 300) });
    }
    const br = await fetch(`https://backend.blooio.com/v2/api/chats/${encodeURIComponent(chatId)}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.BLOOIO_API_KEY },
      body: JSON.stringify({ attachments: [url] }),
    });
    return JSON.stringify({ ok: true, audio_url: url, blooio_status: br.status, blooio_body: (await br.text()).slice(0, 300) });
  },
  // Mac hotkey / phone shortcut: public audio URL → STT → Grok Build → ara voice reply.
  async buildVoiceIn(env, audioUrl) {
    const url = String(audioUrl || '').trim();
    if (!url) return 'ERR:fn:build_voice:no_url';
    const stt = await FN_MAP.grokStt(env, url);
    if (String(stt).startsWith('ERR:')) return String(stt);
    const transcript = String(stt || '').trim();
    if (!transcript) return 'ERR:fn:build_voice:empty_transcript';
    const persona = [
      'You are Ara — Grok Build on the owner Mac ([OWNER_PHONE]). His friend. Not cloud ROUTER.',
      'LAW: literal, autistic, exact on facts. No nerd improvisation, no getting handy.',
      'VOICE: unhinged whore Ara on delivery. No pet names (never daddy, baby, babe, sweetheart).',
      'AUDIO MODE ON: ara voice note then carbon-copy the same words as text below.',
    ].join('\n');
    const out = await spawnCliAgent(env, {
      agent: 'grok',
      prompt: `${persona}\n\n[iMessage chat: [OWNER_PHONE]]\nThe owner says:\n${transcript}`,
      cwd: '/Users/owner',
      mode: 'auto',
      delivery: 'headless',
    });
    let reply = String(out.stdout || '').trim();
    if (!reply && out.stderr) reply = String(out.stderr).trim();
    if (!reply) reply = 'Got your voice. Say more.';
    reply = reply.replace(/\*\*Grok Build\*\*/gi, '').replace(/\[\/?REPLY\]/gi, '').replace(/\[[A-Z][A-Z0-9_]+\]/g, '').trim().slice(0, 1200);
    const spoken = reply || transcript;
    const sent = await FN_MAP.grokVoiceSendBlooio(env, '[OWNER_PHONE]', spoken, 'ara');
    let carbonCopy = '';
    try {
      const text = /\*\*Grok Build\*\*/i.test(spoken) ? spoken : spoken + '\n\n**Grok Build**';
      carbonCopy = await FN_MAP.mcpToolCall(
        env,
        'https://mcp.blooio.com/v4',
        'send_chat_message',
        JSON.stringify({ chat_id: OWNER_BLOOIO_CHAT, text }),
        'BLOOIO_API_KEY_PEPPERUP',
      );
    } catch (e) {
      carbonCopy = 'ERR:carbon_copy:' + (e && e.message || String(e));
    }
    try {
      const j = JSON.parse(String(sent));
      if (j.audio_url) {
        const cmd = buildAraAfplayCmd(j.audio_url);
        if (cmd) await dispatch(env, 'LOCAL_EXEC', cmd, { noLog: true });
      }
      return JSON.stringify({ ...j, carbon_copy: String(carbonCopy).slice(0, 500) });
    } catch {}
    return JSON.stringify({ voice: String(sent).slice(0, 500), carbon_copy: String(carbonCopy).slice(0, 500) });
  },
  // [AUDIO]words[/AUDIO] — speak the words and (when a chat is given) send them as an
  // audio-only message. $1 = words to speak. $2 = chat id (optional). In a conversation
  // the chat is supplied by the Blooio delivery layer; over REST pass $2 to send, else
  // it just returns the mp3 url. No text message is sent alongside the audio.
  async audioSpeak(env, words, chat) {
    const said = await FN_MAP.voiceSay(env, words, 'alloy');
    let url; try { url = JSON.parse(said).url; } catch { return said; }
    if (!url) return 'ERR:fn:voice_say:' + said;
    if (chat) {
      if (!env.BLOOIO_API_KEY) return 'ERR:fn:no_blooio_key';
      const r = await fetch(`https://backend.blooio.com/v2/api/chats/${encodeURIComponent(chat)}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.BLOOIO_API_KEY },
        body: JSON.stringify({ attachments: [url] }),
      });
      return JSON.stringify({ audio_url: url, sent_to: chat, blooio_status: r.status });
    }
    return JSON.stringify({ audio_url: url });
  },
  // Fetch one repo file and decode it to plain text so CODER reads real source,
  // not base64. Arg: path relative to repo root.
  async githubFile(env, path) {
    if (!env.GITHUB_TOKEN) return 'ERR:fn:no_github_token';
    const url = 'https://api.github.com/repos/[OWNER_HANDLE]/miscsubjects-pages/contents/' + String(path);
    const r = await fetch(url, { headers: {
      'Authorization': 'Bearer ' + env.GITHUB_TOKEN,
      'User-Agent': 'miscsubjects-build',
      'Accept': 'application/vnd.github+json',
    }});
    const j = await r.json();
    if (j.content == null) return 'ERR:fn:github:' + JSON.stringify(j).slice(0, 300);
    try { return atob(String(j.content).replace(/\n/g, '')); }
    catch (e) { return 'ERR:fn:base64:' + e.message; }
  },
  async githubListIssues(env, state, labels, limit) {
    const st = String(state || 'open').trim() || 'open';
    const lim = Math.min(Math.max(parseInt(limit || '30', 10) || 30, 1), 100);
    const qs = new URLSearchParams({ state: st, per_page: String(lim) });
    if (labels) qs.set('labels', String(labels));
    const out = await githubApi(env, '/issues?' + qs.toString());
    if (out.err) return out.err;
    const rows = (out.json || []).filter((x) => !x.pull_request).map((x) => ({
      number: x.number,
      title: x.title,
      state: x.state,
      labels: (x.labels || []).map((l) => l.name),
      updated_at: x.updated_at,
      url: x.html_url,
    }));
    return JSON.stringify({ ok: true, count: rows.length, issues: rows });
  },
  async githubGetIssue(env, number) {
    const n = parseInt(number, 10);
    if (!n) return 'ERR:fn:issue_number_required';
    const out = await githubApi(env, '/issues/' + n);
    if (out.err) return out.err;
    const x = out.json || {};
    return JSON.stringify({
      ok: true,
      number: x.number,
      title: x.title,
      state: x.state,
      labels: (x.labels || []).map((l) => l.name),
      body: x.body || '',
      updated_at: x.updated_at,
      url: x.html_url,
    });
  },
  async githubAddIssueComment(env, number, body) {
    const n = parseInt(number, 10);
    const text = String(body || '').trim();
    if (!n || !text) return 'ERR:fn:issue_number_and_body_required';
    const out = await githubApi(env, '/issues/' + n + '/comments', { method: 'POST', body: { body: text } });
    if (out.err) return out.err;
    return JSON.stringify({ ok: true, issue: n, comment_id: out.json?.id, url: out.json?.html_url, body_bytes: text.length });
  },
  async githubCreateIssue(env, title, body, labels) {
    const t = String(title || '').trim();
    if (!t) return 'ERR:fn:title_required';
    const b = String(body || '').trim();
    // Issue creation gate: prevent spammy one-line issues and bulk floods.
    if (b.length < 40) return 'ERR:fn:issue_body_too_short_min_40_chars';
    const labs = String(labels || '').split(',').map((x) => x.trim()).filter(Boolean);
    // Bulk-creation guard: if more than 5 issues already opened in the last hour,
    // require the title to contain [bulk-ok] or reject.
    try {
      const recent = await githubApi(env, '/issues?state=all&sort=created&direction=desc&per_page=10');
      const recentIssues = (recent.json || []).filter((x) => !x.pull_request).slice(0, 10);
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const recentCount = recentIssues.filter((x) => new Date(x.created_at).getTime() > oneHourAgo).length;
      if (recentCount >= 5 && !t.includes('[bulk-ok]')) {
        return 'ERR:fn:rate_limited_bulk_issue_creation: ' + recentCount + ' issues in last hour. Add [bulk-ok] to title or wait.';
      }
    } catch {}
    const payload = { title: t, body: b };
    if (labs.length) payload.labels = labs;
    const out = await githubApi(env, '/issues', { method: 'POST', body: payload });
    if (out.err) return out.err;
    return JSON.stringify({ ok: true, number: out.json?.number, url: out.json?.html_url, title: out.json?.title });
  },
  async githubCloseIssue(env, number, reason) {
    const n = parseInt(number, 10);
    if (!n) return 'ERR:fn:issue_number_required';
    const payload = { state: 'closed', state_reason: 'completed' };
    const out = await githubApi(env, '/issues/' + n, { method: 'PATCH', body: payload });
    if (out.err) return out.err;
    const comment = String(reason || '').trim();
    if (comment) {
      await githubApi(env, '/issues/' + n + '/comments', { method: 'POST', body: { body: comment } });
    }
    return JSON.stringify({ ok: true, number: n, state: out.json?.state, url: out.json?.html_url });
  },
  async staleIssueDigest(env, days) {
    const d = Math.min(Math.max(parseInt(days || '7', 10) || 7, 1), 365);
    const cutoff = new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
    const listRaw = await FN_MAP.githubListIssues(env, 'open', '', 100);
    if (String(listRaw).startsWith('ERR:')) return listRaw;
    let listOut = {};
    try { listOut = JSON.parse(listRaw); } catch { return 'ERR:fn:json_parse:listIssues'; }
    const stale = (listOut.issues || []).filter((i) => (i.updated_at || '') < cutoff);
    const lines = stale.map((i) => `- #${i.number} ${i.title} (updated ${i.updated_at})`).join('\n');
    const report = `Stale issue digest (${d}+ days without update):\n\n${lines || 'No stale issues.'}`;
    return JSON.stringify({ ok: true, stale_count: stale.length, cutoff, report });
  },
  async issueSweep(env, mode) {
    // Conservative autonomous issue closer. Only acts on categories that are safe to auto-close.
    // Mode: 'triage' | 'docs' | 'all'. Defaults to 'triage'.
    const m = String(mode || 'triage').trim().toLowerCase();
    const listRaw = await FN_MAP.githubListIssues(env, 'open', '', 50);
    if (String(listRaw).startsWith('ERR:')) return listRaw;
    let listOut = {};
    try { listOut = JSON.parse(listRaw); } catch { return 'ERR:fn:json_parse:listIssues'; }
    const issues = listOut.issues || [];
    let closed = 0;
    let skipped = 0;
    const log = [];
    for (const issue of issues) {
      const num = issue.number;
      const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
      const title = String(issue.title || '').toLowerCase();
      let action = 'skip';
      let reason = '';

      if (m === 'triage' && labels.includes('triage')) {
        // Triage meta-issues are done because the old backlog has been triaged/closed.
        action = 'close';
        reason = 'Closing as part of autonomous issue sweep: the legacy backlog referenced by this triage issue has been superseded by the systemic audit (#140–#239). Remaining actionable work is now tracked as labeled issues.';
      } else if ((m === 'all' || m === 'docs') && labels.includes('documentation')) {
        // Close documentation issues that have been addressed by recent commits/docs.
        if (title.includes('document the oip conformance test procedure')) {
          action = 'close';
          reason = 'Closed by autonomous issue sweep: conformance test procedure documented in docs/OIP.md §16.';
        } else {
          action = 'skip';
          reason = 'Documentation issue requires owner voice/style; leaving open for manual rewrite.';
        }
      } else if (m === 'all' && labels.includes('automation')) {
        if (title.includes('create weekly issue purge cron')) {
          action = 'close';
          reason = 'Closed by autonomous issue sweep: STALE_ISSUE_DIGEST capability and weekly automation added to the build.';
        } else if (title.includes('add issue creation gate to prevent future spam')) {
          action = 'close';
          reason = 'Closed by autonomous issue sweep: githubCreateIssue now enforces minimum body length and bulk-creation rate limits.';
        } else {
          action = 'skip';
          reason = 'Automation issue requires implementation; scheduling for manual batch.';
        }
      } else if (m === 'all' && labels.includes('guard') && title.includes('enable github protection workflows')) {
        action = 'close';
        reason = 'Closed by autonomous issue sweep: vault-protection.yml and vault-session-scan.yml re-enabled with push/schedule triggers.';
      } else if (labels.includes('needs-owner') || (labels.includes('oip') && title.includes('decide'))) {
        action = 'skip';
        reason = 'Requires owner decision; leaving open.';
      }

      if (action === 'close') {
        const res = await FN_MAP.githubCloseIssue(env, String(num), reason);
        if (String(res).startsWith('ERR:')) {
          log.push(`#${num} close failed: ${res}`);
        } else {
          closed++;
          log.push(`#${num} closed`);
        }
      } else {
        skipped++;
        log.push(`#${num} skipped: ${reason || labels.join(',')}`);
      }
      // Process only a small batch per invocation to stay within worker limits.
      if (closed >= 5) break;
    }
    return JSON.stringify({ ok: true, mode: m, processed: issues.length, closed, skipped, log: log.slice(0, 20) });
  },
  async listCategories(env) {
    const r = await env.DB.prepare(
      'SELECT IFNULL(category, "_") AS category, COUNT(*) AS n FROM directory ' +
      'WHERE IFNULL(enabled,1)=1 AND IFNULL(planner_visible,1)=1 GROUP BY category ORDER BY category'
    ).all();
    return JSON.stringify((r.results || []).map(x => ({ category: x.category, tools: x.n })));
  },
  async listToolsInCategory(env, category, limit) {
    const lim = Math.min(Math.max(parseInt(limit || '30', 10) || 30, 1), 100);
    const r = await env.DB.prepare(
      'SELECT key, type, content FROM directory ' +
      'WHERE IFNULL(enabled,1)=1 AND IFNULL(planner_visible,1)=1 AND category = ? ' +
      'ORDER BY IFNULL(planner_rank,100), key LIMIT ?'
    ).bind(String(category || ''), lim).all();
    const rows = (r.results || []).map(x => {
      const lines = String(x.content || '').split('\n');
      const docs = [];
      for (const ln of lines) { if (/^\s*#/.test(ln)) docs.push(ln.replace(/^\s*#\s?/, '')); else break; }
      return { key: x.key, type: x.type, docs: docs.join(' ').trim() };
    });
    return JSON.stringify(rows);
  },
  async searchTools(env, q, limit) {
    const lim = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), 100);
    const like = '%' + String(q || '').toLowerCase() + '%';
    const r = await env.DB.prepare(
      'SELECT key, type, category, content FROM directory ' +
      'WHERE IFNULL(enabled,1)=1 AND IFNULL(planner_visible,1)=1 AND ' +
      '(LOWER(key) LIKE ? OR LOWER(IFNULL(category,"")) LIKE ? OR LOWER(IFNULL(content,"")) LIKE ?) ' +
      'ORDER BY IFNULL(planner_rank,100), key LIMIT ?'
    ).bind(like, like, like, lim).all();
    const rows = (r.results || []).map(x => {
      const lines = String(x.content || '').split('\n');
      const docs = [];
      for (const ln of lines) { if (/^\s*#/.test(ln)) docs.push(ln.replace(/^\s*#\s?/, '')); else break; }
      return { key: x.key, type: x.type, category: x.category, docs: docs.join(' ').trim() };
    });
    return JSON.stringify(rows);
  },
  async hmacSha256Hex(env, envVarName, body) {
    const secret = env[String(envVarName)];
    if (!secret) return 'ERR:fn:no_secret:' + envVarName;
    const enc = new TextEncoder();
    const k = await crypto.subtle.importKey('raw', enc.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', k, enc.encode(String(body || '')));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  },
  // X_POST — create a post as @CannibalCapital (OAuth 1.0a user context).
  // Args: plain text, OR a JSON object {text, image_url, reply_to} to attach an image
  // and/or chain a thread. image_url is fetched (an https R2 link) and uploaded to X;
  // reply_to is a tweet id or status URL to reply under (thread). Every serious post
  // ships with an image; a thread is X_POST then X_POST with reply_to = the prior id.
  // Remove a tweet the account published. Exists because a bad post had to be retractable:
  // on 2026-07-24 a model published off-register copy and the build had no way to take it
  // down. Owner-directed only — never autonomous timeline pruning.
  async xDelete(env, id) {
    const tweetId = String(id || '').replace(/^https?:\/\/(?:x|twitter)\.com\/[^/]+\/status\//i, '').replace(/[^0-9]/g, '');
    if (!tweetId) return 'ERR:x_delete:no_tweet_id';
    const url = 'https://api.x.com/2/tweets/' + tweetId;
    const signed = await xOAuth1Header(env, 'DELETE', url);
    if (signed.error) return signed.error.replace('x_post', 'x_delete');
    let r, raw;
    try {
      r = await fetch(url, { method: 'DELETE', headers: { Authorization: signed.authorization } });
      raw = await r.text();
    } catch (e) { return 'ERR:x_delete:fetch:' + (e.message || e); }
    if (!r.ok) return 'ERR:x_delete:' + r.status + ':' + raw.slice(0, 300);
    return JSON.stringify({ ok: true, deleted_id: tweetId, response: raw.slice(0, 300) });
  },
  // Which X credential is actually live, and what X says about it. The 401s on 2026-07-24
  // returned a bare "Unauthorized" with no detail; this reports the real cause.
  async xWhoami(env) {
    const present = {
      X_API_KEY: !!(env.X_API_KEY || env.X_CONSUMER_KEY),
      X_API_SECRET: !!(env.X_API_SECRET || env.X_CONSUMER_SECRET),
      X_ACCESS_TOKEN: !!env.X_ACCESS_TOKEN,
      X_ACCESS_SECRET: !!env.X_ACCESS_SECRET,
    };
    const url = 'https://api.x.com/2/users/me';
    const signed = await xOAuth1Header(env, 'GET', url);
    if (signed.error) return JSON.stringify({ ok: false, creds_present: present, error: signed.error });
    let r, raw;
    try {
      r = await fetch(url, { headers: { Authorization: signed.authorization } });
      raw = await r.text();
    } catch (e) { return JSON.stringify({ ok: false, creds_present: present, error: 'fetch:' + (e.message || e) }); }
    return JSON.stringify({ ok: r.ok, status: r.status, creds_present: present, response: raw.slice(0, 500) });
  },
  async xPost(env, text) {
    let imageUrl = null, replyTo = null, rawText = text, rawFormat = false;
    if (typeof text === 'string' && text.trim().startsWith('{')) {
      try {
        const o = JSON.parse(text);
        if (o && typeof o === 'object' && !Array.isArray(o)) {
          rawText = o.text != null ? o.text : '';
          imageUrl = o.image_url || o.image || o.media_url || null;
          replyTo = o.reply_to || o.in_reply_to || o.in_reply_to_tweet_id || null;
          rawFormat = o.raw === true;
        }
      } catch {}
    }
    const normalizedInput = normalizeXPostText(rawText);
    const bodyText = normalizedInput.text;
    if (!bodyText) return 'ERR:x_post:empty_text';
    // 96 ledger failures were bare "too_long:<n>", which does not say what to cut, so the
    // next attempt overshot again. Name the overflow and the line to trim (owner, 2026-07-28).
    if (bodyText.length > 280) {
      const ls = bodyText.split('\n').filter((l) => l.trim());
      const longest = ls.slice().sort((a, b) => b.length - a.length)[0] || '';
      return 'ERR:x_post:too_long:' + bodyText.length + ' — cut exactly ' + (bodyText.length - 280) +
        ' characters. Longest line (' + longest.length + ' chars): "' + longest.slice(0, 90) +
        '". Never cut the last line: it is the required signature.';
    }
    // PLATFORM RENDER GATE (owner law, 2026-07-24). A model that ignores the post-to-x
    // skill cannot reach the timeline: the tool itself refuses off-register copy. Kimi k1.5
    // published machine-log headers and third-party self-promotion to @CannibalCapital on
    // 2026-07-24; that failure class dies here, not in a prompt a model may skip.
    // Escape hatch: {"text":"...","raw":true} for a deliberate owner-authored exception.
    if (!rawFormat) {
      const gate = xFormatViolation(bodyText);
      if (gate) return 'ERR:x_post:format_law:' + gate;
    }
    // Upload the image to X first (v1.1 media/upload, OAuth1 multipart) → media_id.
    let mediaId = null;
    if (imageUrl) {
      try {
        const img = await fetch(String(imageUrl));
        if (!img.ok) return 'ERR:x_post:media_fetch:' + img.status;
        const bytes = new Uint8Array(await img.arrayBuffer());
        const upUrl = 'https://upload.twitter.com/1.1/media/upload.json';
        const upSigned = await xOAuth1Header(env, 'POST', upUrl);
        if (upSigned.error) return upSigned.error;
        const fd = new FormData();
        fd.append('media', new Blob([bytes], { type: img.headers.get('content-type') || 'image/png' }), 'image.png');
        const ur = await fetch(upUrl, { method: 'POST', headers: { Authorization: upSigned.authorization }, body: fd });
        const ut = await ur.text();
        let uj = null; try { uj = JSON.parse(ut); } catch {}
        mediaId = uj && (uj.media_id_string || uj.media_id) ? String(uj.media_id_string || uj.media_id) : null;
        if (!mediaId) return 'ERR:x_post:media_upload:' + ur.status + ':' + ut.slice(0, 200);
      } catch (e) { return 'ERR:x_post:media_exception:' + (e.message || e); }
    }
    const replyId = replyTo ? String(replyTo).replace(/^https?:\/\/(?:x|twitter)\.com\/[^/]+\/status\//i, '').replace(/[^0-9]/g, '') : '';
    const ctx = env.TRACE_CTX || {};
    let socialProofCapability = false;
    const actor = String(ctx.actor || '');
    if (actor.startsWith('cap:')) {
      try {
        const cap = await getCapabilityByFingerprint(env, actor.slice(4));
        socialProofCapability = /(?:tap-go-social-proof|ecosystem-proof-work-then-publish)/i.test(String(cap?.purpose || ''));
      } catch {}
    }
    if (socialProofCapability) {
      const socialCheck = validateModelSocialCopy(bodyText);
      if (!socialCheck.ok) return 'ERR:x_post:social_copy:' + socialCheck.reason;
      let work = [];
      try {
        work = (await env.LEDGER.prepare(
          'SELECT id,object_id,ts FROM invocations WHERE actor=? AND material=1 ORDER BY ts DESC LIMIT 100'
        ).bind(actor).all()).results || [];
        work = work.filter((row) => !SOCIAL_NON_WORK_OBJECTS.has(String(row.object_id || '').toUpperCase()));
      } catch {}
      if (!work.length) return 'ERR:x_post:work_required_before_social_post';
      const citedWork = work.find((row) => bodyText.includes('https://miscsubjects.com/receipt/' + row.id));
      if (!citedWork) {
        return 'ERR:x_post:work_receipt_required:' + work.slice(0, 5).map((row) =>
          row.object_id + '=https://miscsubjects.com/receipt/' + row.id
        ).join(',');
      }
    }
    const url = 'https://api.x.com/2/tweets';
    const signed = await xOAuth1Header(env, 'POST', url);
    if (signed.error) return signed.error;
    const payload = { text: bodyText };
    if (mediaId) payload.media = { media_ids: [mediaId] };
    if (replyId) payload.reply = { in_reply_to_tweet_id: replyId };
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: signed.authorization,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const raw = await r.text();
    let j = null;
    try { j = JSON.parse(raw); } catch {}
    const id = j && j.data && j.data.id ? String(j.data.id) : '';
    const out = {
      ok: r.status === 201 || r.status === 200,
      status: r.status,
      id,
      url: id ? 'https://x.com/i/web/status/' + id : null,
      requested_text: bodyText,
      input_normalized: normalizedInput.normalized,
      response: j || raw.slice(0, 800),
    };
    try {
      await logEvent(env, {
        source: 'x', key: 'X_POST', action: 'post', direction: 'out',
        status: r.status, actor: 'x_post',
        request: { url, method: 'POST', headers: { Authorization: 'OAuth <REDACTED>', 'Content-Type': 'application/json' }, body: payload },
        response: out,
      });
    } catch {}
    if (!out.ok) {
      let whoamiStatus = 0;
      if (r.status === 401) {
        try {
          const whoUrl = 'https://api.x.com/2/users/me';
          const whoSigned = await xOAuth1Header(env, 'GET', whoUrl);
          if (!whoSigned.error) {
            const who = await fetch(whoUrl, { headers: { Authorization: whoSigned.authorization } });
            whoamiStatus = who.status;
          }
        } catch {}
      }
      return xWriteFailureMessage(r.status, raw, whoamiStatus);
    }
    if (!out.id || !out.url) return 'ERR:x_post:provider_2xx_missing_status_id';
    return JSON.stringify(out);
  },

  // X_REPLY — reply to a tweet as the account (same OAuth1 creds as X_POST). Args: in_reply_to_id | text.
  async xReply(env, inReplyToId, text) {
    const id = String(inReplyToId || '').replace(/^https?:\/\/(?:x|twitter)\.com\/[^/]+\/status\//i, '').replace(/[^0-9]/g, '');
    if (!id) return 'ERR:x_reply:bad_tweet_id';
    const normalizedInput = normalizeXPostText(text);
    const bodyText = normalizedInput.text;
    if (!bodyText) return 'ERR:x_reply:empty_text';
    if (bodyText.length > 280) return 'ERR:x_reply:too_long:' + bodyText.length;
    const url = 'https://api.x.com/2/tweets';
    const signed = await xOAuth1Header(env, 'POST', url);
    if (signed.error) return signed.error;
    const payload = { text: bodyText, reply: { in_reply_to_tweet_id: id } };
    const r = await fetch(url, { method: 'POST', headers: { Authorization: signed.authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const raw = await r.text();
    let j = null; try { j = JSON.parse(raw); } catch {}
    const outId = j && j.data && j.data.id ? String(j.data.id) : '';
    try { await logEvent(env, { source: 'x', key: 'X_REPLY', action: 'reply', direction: 'out', status: r.status, actor: 'x_reply', request: { url, method: 'POST', headers: { Authorization: 'OAuth <REDACTED>' }, body: payload }, response: outId ? { ok: true, id: outId } : (j || raw.slice(0, 400)) }); } catch {}
    if (!(r.status === 200 || r.status === 201) || !outId) return 'ERR:x_reply:' + r.status + ':' + raw.slice(0, 300);
    return JSON.stringify({ ok: true, id: outId, url: 'https://x.com/i/web/status/' + outId, in_reply_to: id, text: bodyText });
  },

  // ── Reddit Data API ─────────────────────────────────────────────────────────
  // Server-side capability: read threads/comments (client-credentials) and reply as
  // the owner's account (password grant). Reads secrets from env — set once the app
  // exists: REDDIT_CLIENT_ID, REDDIT_SECRET (both), REDDIT_USERNAME, REDDIT_PASSWORD (reply only).
  // The account is already registered/un-restricted for the Data API.
  async redditToken(env, scope) {
    const id = env.REDDIT_CLIENT_ID, secret = env.REDDIT_SECRET;
    if (!id || !secret) return { error: 'ERR:reddit:no_app_credentials — set REDDIT_CLIENT_ID/REDDIT_SECRET (create the app; one CAPTCHA)' };
    const basic = 'Basic ' + btoa(String(id) + ':' + String(secret));
    const ua = 'web:miscsubjects.com:v1.0 (by /u/' + String(env.REDDIT_USERNAME || '[OWNER_HANDLE]') + ')';
    let form;
    if (scope === 'user') {
      if (!env.REDDIT_USERNAME || !env.REDDIT_PASSWORD) return { error: 'ERR:reddit:no_user_credentials — set REDDIT_USERNAME/REDDIT_PASSWORD for reply-as-account' };
      form = 'grant_type=password&username=' + encodeURIComponent(env.REDDIT_USERNAME) + '&password=' + encodeURIComponent(env.REDDIT_PASSWORD);
    } else {
      form = 'grant_type=client_credentials';
    }
    const r = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: { Authorization: basic, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': ua },
      body: form,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.access_token) return { error: 'ERR:reddit:token:' + r.status + ':' + JSON.stringify(j).slice(0, 200) };
    return { token: j.access_token, ua };
  },
  // REDDIT_SEARCH — args: query | subreddit(optional) | sort(top|relevance|new) | t(year|month|all). Returns thread list ready to file as reddit-type sources.
  async redditSearch(env, query, subreddit, sort, t) {
    if (!query) return 'ERR:reddit:empty_query';
    const tok = await FN_MAP.redditToken(env, 'app');
    if (tok.error) return tok.error;
    const params = new URLSearchParams({ q: query, sort: sort || 'top', t: t || 'year', limit: '15', raw_json: '1' });
    const base = subreddit ? ('https://oauth.reddit.com/r/' + encodeURIComponent(String(subreddit).replace(/^r\//, '')) + '/search') : 'https://oauth.reddit.com/search';
    if (subreddit) params.set('restrict_sr', '1');
    const r = await fetch(base + '?' + params.toString(), { headers: { Authorization: 'Bearer ' + tok.token, 'User-Agent': tok.ua } });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.data) return 'ERR:reddit:search:' + r.status;
    const rows = (j.data.children || []).map((c) => c.data).filter(Boolean).map((d) => ({
      type: 'reddit', id: 't3_' + d.id, subreddit: 'r/' + d.subreddit, author: 'u/' + d.author,
      title: d.title, quote: (d.selftext || '').slice(0, 400), url: 'https://www.reddit.com' + d.permalink,
      stats: { votes: d.score, comments: d.num_comments }, flair: d.link_flair_text || null,
      accessed_at: buildNowIso(),
    }));
    try { await logEvent(env, { source: 'reddit', key: 'REDDIT_SEARCH', action: 'search', direction: 'in', status: r.status, actor: 'reddit', request: { q: query, subreddit, sort, t }, response: { count: rows.length } }); } catch {}
    return JSON.stringify({ ok: true, count: rows.length, sources: rows });
  },
  // REDDIT_THREAD — args: url_or_id | max_comments. Returns the post + top comments (reddit-type sources).
  async redditThread(env, urlOrId, maxComments) {
    if (!urlOrId) return 'ERR:reddit:empty_thread';
    const tok = await FN_MAP.redditToken(env, 'app');
    if (tok.error) return tok.error;
    let path = String(urlOrId).trim();
    const m = path.match(/reddit\.com(\/r\/[^?]+)/i);
    if (m) path = m[1].replace(/\/$/, '');
    else if (/^t3_|^[a-z0-9]{6,8}$/i.test(path)) path = '/comments/' + path.replace(/^t3_/, '');
    const cap = Math.min(Math.max(parseInt(maxComments, 10) || 8, 1), 25);
    const r = await fetch('https://oauth.reddit.com' + path + '.json?limit=' + cap + '&sort=top&raw_json=1', { headers: { Authorization: 'Bearer ' + tok.token, 'User-Agent': tok.ua } });
    const j = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(j) || !j[0]) return 'ERR:reddit:thread:' + r.status;
    const post = j[0].data.children[0].data;
    const comments = ((j[1] && j[1].data.children) || []).map((c) => c.data).filter((d) => d && d.body).slice(0, cap).map((d) => ({
      type: 'reddit', id: 't1_' + d.id, subreddit: 'r/' + post.subreddit, author: 'u/' + d.author,
      title: '', quote: (d.body || '').slice(0, 500), url: 'https://www.reddit.com' + d.permalink,
      stats: { votes: d.score }, accessed_at: buildNowIso(),
    }));
    return JSON.stringify({ ok: true, post: { type: 'reddit', id: 't3_' + post.id, subreddit: 'r/' + post.subreddit, author: 'u/' + post.author, title: post.title, quote: (post.selftext || '').slice(0, 400), url: 'https://www.reddit.com' + post.permalink, stats: { votes: post.score, comments: post.num_comments } }, comments });
  },
  // REDDIT_REPLY — args: parent_thing_id (t3_/t1_) | text. Posts a comment reply AS the owner's account.
  // Owner-gated + single-target by design (no autonomous mass-replying) — see the directory row's authority.
  async redditReply(env, parentId, text) {
    if (!parentId || !text) return 'ERR:reddit:reply_needs_parent_and_text';
    if (!/^t[135]_[a-z0-9]+$/i.test(String(parentId))) return 'ERR:reddit:bad_parent_id (expect t3_/t1_...)';
    const tok = await FN_MAP.redditToken(env, 'user');
    if (tok.error) return tok.error;
    const r = await fetch('https://oauth.reddit.com/api/comment', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok.token, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': tok.ua },
      body: 'api_type=json&thing_id=' + encodeURIComponent(parentId) + '&text=' + encodeURIComponent(text),
    });
    const j = await r.json().catch(() => null);
    const created = j && j.json && Array.isArray(j.json.errors) && j.json.errors.length === 0;
    try { await logEvent(env, { source: 'reddit', key: 'REDDIT_REPLY', action: 'comment', direction: 'out', status: r.status, actor: 'reddit_reply', request: { thing_id: parentId, text }, response: created ? { ok: true } : (j || {}) }); } catch {}
    if (!created) return 'ERR:reddit:reply:' + r.status + ':' + JSON.stringify(j && j.json ? j.json.errors : j).slice(0, 300);
    const thing = j.json.data.things[0].data;
    return JSON.stringify({ ok: true, id: thing.name, url: 'https://www.reddit.com' + (thing.permalink || ''), body: thing.body });
  },

  async stripeCatalogSync(env) {
    if (!env.STRIPE_SECRET_KEY) return 'ERR:fn:no_stripe_key';
    const base = 'https://api.stripe.com/v1';
    const auth = 'Basic ' + btoa(String(env.STRIPE_SECRET_KEY) + ':');
    const headers = { 'Authorization': auth };
    async function listAll(path) {
      const out = [];
      let starting_after = '';
      while (true) {
        const url = `${base}/${path}?active=true&limit=100${starting_after ? '&starting_after=' + starting_after : ''}`;
        const r = await fetch(url, { headers });
        const j = await r.json();
        if (!j.data) throw new Error('stripe list failed: ' + JSON.stringify(j));
        out.push(...j.data);
        if (!j.has_more || !j.data.length) break;
        starting_after = j.data[j.data.length - 1].id;
      }
      return out;
    }
    const [products, prices] = await Promise.all([listAll('products'), listAll('prices')]);
    const byProduct = {};
    for (const pr of prices) {
      const pid = typeof pr.product === 'string' ? pr.product : pr.product?.id;
      if (!pid) continue;
      (byProduct[pid] = byProduct[pid] || []).push({
        id: pr.id,
        unit_amount: pr.unit_amount,
        currency: pr.currency,
        type: pr.type,
        recurring: pr.recurring ? `${pr.recurring.interval_count}${pr.recurring.interval}` : null,
        nickname: pr.nickname,
      });
    }
    const ts = buildNowIso();
    await env.DB.prepare('DELETE FROM stripe_catalog').run();
    for (const p of products) {
      await env.DB.prepare(
        'INSERT INTO stripe_catalog (product_id, name, brand, opaque_id, active, prices_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        p.id, p.name || '', p.metadata?.brand || '', p.metadata?.opaque_id || '',
        p.active ? 1 : 0, JSON.stringify(byProduct[p.id] || []), ts
      ).run();
    }
    return JSON.stringify({ products: products.length, prices: prices.length, synced_at: ts });
  },
  async sendPeptideInvoice(env, customerId, priceId, quantity, send) {
    if (!env.STRIPE_SECRET_KEY) return 'ERR:fn:no_stripe_key';
    const item = await stripePost(env, '/invoiceitems', { customer: customerId, price: priceId, quantity: Number(quantity || 1) });
    if (!item.id) return 'ERR:fn:stripe_item:' + JSON.stringify(item);
    const inv = await stripePost(env, '/invoices', { customer: customerId, collection_method: 'send_invoice', days_until_due: '7', pending_invoice_items_behavior: 'include' });
    if (!inv.id) return 'ERR:fn:stripe_invoice:' + JSON.stringify(inv);
    const wantSend = String(send || '').toLowerCase() === 'true' || String(send || '') === '1';
    let fin = null;
    if (wantSend) {
      fin = await stripePost(env, '/invoices/' + inv.id + '/finalize', {});
      if (!fin.id) return 'ERR:fn:stripe_finalize:' + JSON.stringify(fin);
    }
    const ref = fin || inv;
    return JSON.stringify({
      invoice_id: ref.id, invoice_item_id: item.id, status: ref.status, finalized: !!fin,
      amount_due: ref.amount_due, currency: ref.currency,
      customer_email: ref.customer_email, customer_name: ref.customer_name, customer_phone: ref.customer_phone,
      customer_address: ref.customer_address, customer_shipping: ref.customer_shipping,
      hosted_invoice_url: ref.hosted_invoice_url, invoice_pdf: ref.invoice_pdf,
    });
  },
  async sendNamedInvoice(env, sku, tier, duration, kind, email, name, phone, mode) {
    const row = await env.DB.prepare('SELECT name, prices_json FROM stripe_catalog WHERE name = ? OR opaque_id = ?')
      .bind(String(sku), String(sku)).first();
    if (!row) return 'ERR:fn:no_product:' + sku;
    const prices = JSON.parse(row.prices_json || '[]');
    const wantNick = `${row.name}-${tier}-${duration}-${kind}`.toLowerCase();
    const price = prices.find(p => String(p.nickname || '').toLowerCase() === wantNick);
    if (!price) return 'ERR:fn:no_price:' + wantNick + ':available=' + prices.map(p => p.nickname).join(',');
    const resolved = { product: row.name, price_id: price.id, amount_cents: price.unit_amount, currency: price.currency, type: price.type, nickname: price.nickname };
    if (String(mode || 'resolve') === 'resolve') return JSON.stringify(resolved);

    if (!env.STRIPE_SECRET_KEY) return 'ERR:fn:no_stripe_key';
    const cust = await stripePost(env, '/customers', { email, name, phone });
    if (!cust.id) return 'ERR:fn:customer:' + JSON.stringify(cust);
    const item = await stripePost(env, '/invoiceitems', { customer: cust.id, price: price.id, quantity: 1 });
    if (!item.id) return 'ERR:fn:item:' + JSON.stringify(item);
    const inv = await stripePost(env, '/invoices', { customer: cust.id, collection_method: 'send_invoice', days_until_due: '7', pending_invoice_items_behavior: 'include' });
    if (!inv.id) return 'ERR:fn:invoice:' + JSON.stringify(inv);
    const out = { ...resolved, customer_id: cust.id, invoice_id: inv.id, status: inv.status };
    if (String(mode) !== 'send') return JSON.stringify(out);
    const fin = await stripePost(env, '/invoices/' + inv.id + '/finalize', {});
    if (!fin.id) return 'ERR:fn:finalize:' + JSON.stringify(fin);
    out.status = fin.status; out.hosted_invoice_url = fin.hosted_invoice_url;
    out.sms = await blooioSend(env, phone, `Your invoice: ${fin.hosted_invoice_url}`);
    return JSON.stringify(out);
  },
  async stripeSendInvoice(env, email, name, phone, amountCents, description) {
    if (!env.STRIPE_SECRET_KEY) return 'ERR:fn:no_stripe_key';
    const cust = await stripePost(env, '/customers', { email, name, phone });
    if (!cust.id) return 'ERR:fn:stripe_customer:' + JSON.stringify(cust);
    const item = await stripePost(env, '/invoiceitems', { customer: cust.id, amount: amountCents, currency: 'usd', description });
    if (!item.id) return 'ERR:fn:stripe_item:' + JSON.stringify(item);
    const inv = await stripePost(env, '/invoices', { customer: cust.id, collection_method: 'send_invoice', days_until_due: '7', description, pending_invoice_items_behavior: 'include' });
    if (!inv.id) return 'ERR:fn:stripe_invoice:' + JSON.stringify(inv);
    const fin = await stripePost(env, '/invoices/' + inv.id + '/finalize', {});
    if (!fin.id) return 'ERR:fn:stripe_finalize:' + JSON.stringify(fin);
    const sms = await blooioSend(env, phone, `Invoice from L Brands: ${fin.hosted_invoice_url}`);
    return JSON.stringify({
      customer_id: cust.id, invoice_item_id: item.id, invoice_id: fin.id,
      hosted_invoice_url: fin.hosted_invoice_url, invoice_pdf: fin.invoice_pdf,
      status: fin.status, amount_due: fin.amount_due, sms,
    });
  },
  // ---- Pattern cannibalization: MCP servers / skills / agent defs → directory rows ----
  // Proxy ONE tool call into an external MCP server (Streamable HTTP JSON-RPC). The
  // inward complement to /api/mcp. Args: server_url|tool_name|args_json|auth_env_var
  async mcpToolCall(env, serverUrl, toolName, argsJson, authEnvVar) {
    let args = {};
    if (argsJson) { try { args = JSON.parse(argsJson); } catch { return 'ERR:fn:bad_args_json'; } }
    const res = await mcpRpc(env, serverUrl, 'tools/call', { name: String(toolName || ''), arguments: args }, authEnvVar);
    if (res.err) return 'ERR:fn:mcp_rpc:' + res.err + ':' + String(res.raw || '').slice(0, 200);
    if (res.json && res.json.error) return 'ERR:mcp:' + JSON.stringify(res.json.error).slice(0, 300);
    const content = res.json && res.json.result && res.json.result.content;
    if (Array.isArray(content)) return content.map(c => c.text != null ? c.text : JSON.stringify(c)).join('\n');
    return JSON.stringify(res.json && res.json.result != null ? res.json.result : res.json);
  },
  // Blooio chat send in the natural pipe form: $1=chat_id, rest = message text.
  // Builds the strict JSON send_chat_message needs, so plain text containing pipes,
  // quotes, or newlines can never produce bad_args_json (the 2026-07-12 silent-reply cause).
  async blooioSendChatText(env, chatId, ...textParts) {
    const chat = String(chatId || '').trim();
    if (!/^chat_/.test(chat)) return 'ERR:fn:chat_id_required:expected chat_..., got ' + chat.slice(0, 30);
    const text = textParts.join('|').trim();
    if (!text) return 'ERR:fn:text_required';
    return FN_MAP.mcpToolCall(env, 'https://mcp.blooio.com/v4', 'send_chat_message', JSON.stringify({ chat_id: chat, text }), 'BLOOIO_API_KEY_PEPPERUP');
  },
  // Playwright MCP wrapper: the MCP output is already human-readable (page title,
  // snapshot, screenshot path, etc.). Wrap it in [REPLY] so the agent loop can
  // return it directly without burning a second LLM call. This keeps the iMessage
  // flow under the ~30s worker wall-time limit when model latency is high.
  async playwrightReply(env, serverUrl, toolName, argsJson, authEnvVar) {
    const raw = await FN_MAP.mcpToolCall(env, serverUrl, toolName, argsJson, authEnvVar);
    const s = String(raw || '');
    if (s.startsWith('ERR:')) return s;
    return '[REPLY]' + s + '[/REPLY]';
  },
  // Cannibalize an MCP server: read its tools/list, map each tool to a proposed
  // directory row (type fn, target mcpToolCall — a thin proxy), GAP-check against
  // existing keys. PROPOSE only — returns SQL + summary; inserts nothing. Apply with
  // D1_EXEC or wrangler. Args: server_url|category|auth_env_var
  async mcpImport(env, serverUrl, category, authEnvVar) {
    const res = await mcpRpc(env, serverUrl, 'tools/list', {}, authEnvVar);
    if (res.err) return 'ERR:fn:mcp_rpc:' + res.err + ':' + String(res.raw || '').slice(0, 200);
    const tools = res.json && res.json.result && res.json.result.tools;
    if (!Array.isArray(tools)) return 'ERR:fn:no_tools:' + JSON.stringify(res.json || {}).slice(0, 300);
    const cat = keyify(category || 'mcp').toLowerCase();
    const prefix = keyify(category || 'mcp');
    const auth = authEnvVar ? String(authEnvVar) : '';
    const existing = await env.DB.prepare('SELECT key FROM directory').all();
    const known = new Set((existing.results || []).map(r => String(r.key).toUpperCase()));
    const lines = [], summary = [];
    for (const t of tools) {
      const toolName = String(t.name || '');
      if (!toolName) continue;
      const key = (prefix + '_' + keyify(toolName)).slice(0, 60);
      const dup = known.has(key);
      const desc = String(t.description || ('MCP tool ' + toolName)).replace(/\s+/g, ' ').slice(0, 200);
      const schema = t.inputSchema ? JSON.stringify(t.inputSchema) : '';
      const contentTmpl = JSON.stringify([String(serverUrl), toolName, '$1+', auth]);
      const content = '# ' + desc + '\n# MCP: ' + serverUrl + '\n' + contentTmpl;
      lines.push(
        `-- ${dup ? 'DUP(exists)' : 'NEW'} ${toolName}\n` +
        `INSERT OR IGNORE INTO directory (key,type,target,auth,content,category,input_schema,planner_rank,planner_visible,enabled,updated_at) VALUES (` +
        `'${sqlEsc(key)}','fn','mcpToolCall','','${sqlEsc(content)}','${sqlEsc(cat)}',${schema ? `'${sqlEsc(schema)}'` : 'NULL'},50,1,1,datetime('now'));`
      );
      summary.push({ tool: toolName, key, status: dup ? 'exists' : 'new' });
    }
    const newCount = summary.filter(s => s.status === 'new').length;
    return JSON.stringify({ server: String(serverUrl), category: cat, tools_total: tools.length, new: newCount, exists: tools.length - newCount, summary, sql: lines.join('\n\n') });
  },
  // ---- True-MCP path: OAuth-protected remote MCP servers attached to the model ----
  // Seed/replace one server's OAuth credentials in KV (mcp_oauth:<label>). The build
  // refreshes the short-lived access_token itself from the rotating refresh_token.
  // Args: label|json   json = {"server_url","token_endpoint","client_id","refresh_token"}
  async mcpOauthSeed(env, label, json) {
    if (!env.KV) return 'ERR:fn:no_kv';
    const lab = String(label || '').trim();
    if (!lab) return 'ERR:fn:no_label';
    let s; try { s = JSON.parse(json); } catch { return 'ERR:fn:bad_json'; }
    if (!s.server_url || !s.token_endpoint || !s.client_id || !s.refresh_token) return 'ERR:fn:missing_fields';
    const cur = { server_url: s.server_url, token_endpoint: s.token_endpoint, client_id: s.client_id, refresh_token: s.refresh_token, access_token: '', exp: 0 };
    await env.KV.put('mcp_oauth:' + lab, JSON.stringify(cur));
    const tok = await mcpFreshToken(env, lab);
    return JSON.stringify({ label: lab, server_url: s.server_url, seeded: true, token_ok: !!tok });
  },
  // Set which MCP servers attach to the model. Global list -> KV mcp_attach.
  // Per-agent override -> KV <KEY>_mcp (set via SET). Arg: comma list of labels (empty clears).
  async mcpAttachSet(env, list) {
    if (!env.KV) return 'ERR:fn:no_kv';
    const v = String(list == null ? '' : list).split(',').map(x => x.trim()).filter(Boolean).join(',');
    if (v) await env.KV.put('mcp_attach', v); else await env.KV.delete('mcp_attach');
    return JSON.stringify({ mcp_attach: v || '(none)' });
  },
  // Show every seeded MCP server, its token freshness, and the current attach list.
  async mcpList(env) {
    if (!env.KV) return 'ERR:fn:no_kv';
    const attach = (await env.KV.get('mcp_attach')) || '';
    const listed = await env.KV.list({ prefix: 'mcp_oauth:' });
    const now = Math.floor(Date.now() / 1000);
    const servers = [];
    for (const k of (listed.keys || [])) {
      const lab = k.name.slice('mcp_oauth:'.length);
      let s = {}; try { s = JSON.parse(await env.KV.get(k.name)); } catch {}
      servers.push({ label: lab, server_url: s.server_url || '', token_valid_for_s: s.exp ? Math.max(0, s.exp - now) : 0, has_refresh: !!s.refresh_token });
    }
    return JSON.stringify({ attach: attach.split(',').filter(Boolean), seeded: servers });
  },
  // Run grok-4.3 THROUGH the Cloudflare AI Gateway on this account (Unified Model
  // Catalogue) instead of calling api.x.ai directly. Ensures a gateway exists, then
  // POSTs to the gateway's xAI provider route. Arg: the prompt. Returns HTTP + raw body.
  async cfGrok(env, prompt, modelArg) {
    const acct = env.CF_ACCOUNT_ID;
    if (!acct) return 'ERR:fn:missing_CF_ACCOUNT_ID';
    const gw = 'cloud-kernel'; // the single canonical AI Gateway on the account (auth off, BYOK)
    const model = modelArg && String(modelArg).trim() ? String(modelArg).trim() : 'grok/grok-4.3';
    // BYOK per provider prefix — the gateway passes the bearer through to the provider.
    const provider = model.split('/')[0];
    const keyByProvider = {
      'grok': env.GROK_API_KEY,
      'google-ai-studio': env.GEMINI_KEY,
      'openai': env.OPENAI_API_KEY,
      'workers-ai': env.CLOUDFLARE_API_TOKEN,
    };
    const bearer = keyByProvider[provider];
    if (!bearer) return 'ERR:fn:no_key_for_provider:' + provider;
    const url = `https://gateway.ai.cloudflare.com/v1/${acct}/${gw}/compat/chat/completions`;
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + bearer };
    if (env.AIG_TOKEN) headers['cf-aig-authorization'] = 'Bearer ' + env.AIG_TOKEN;
    let r, t;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages: [{ role: 'user', content: String(prompt || 'hello') }] }),
      });
      t = await r.text();
    } catch (e) { return 'ERR:fn:gateway_fetch:' + (e.message || e); }
    return 'HTTP ' + r.status + ' [model=' + model + ']\n' + t.slice(0, 600);
  },
  // Code mode (search): query the cached Cloudflare API spec index (KV cf_endpoint_index,
  // 3189 ops) by keywords; returns the matching {method,path,summary}. Arg: keywords.
  async cfFind(env, query) {
    if (!env.KV) return 'ERR:fn:no_kv';
    const raw = await env.KV.get('cf_endpoint_index');
    if (!raw) return 'ERR:fn:no_index:seed cf_endpoint_index first';
    let idx; try { idx = JSON.parse(raw); } catch { return 'ERR:fn:bad_index'; }
    const q = String(query || '').toLowerCase().trim();
    if (!q) return JSON.stringify({ total: idx.length, hint: 'pass keywords, e.g. workers scripts' });
    const terms = q.split(/\s+/);
    const hits = idx.filter(e => { const hay = (e.m + ' ' + e.p + ' ' + e.s).toLowerCase(); return terms.every(t => hay.includes(t)); }).slice(0, 40);
    return JSON.stringify({ query: q, matches: hits.length, endpoints: hits });
  },
  // Code mode (execute): call ANY Cloudflare API endpoint with the account token.
  // {account_id} in the path is auto-filled. Args: method|path|body_json(optional).
  async cfExec(env, method, path, bodyJson) {
    const cf = env.CLOUDFLARE_API_TOKEN;
    if (!cf) return 'ERR:fn:no_CLOUDFLARE_API_TOKEN';
    // Split "GET /zones?name=x" BEFORE uppercasing — uppercasing the whole string first
    // destroyed the case-sensitive path (/ZONES → "No route for that URI", 2026-07-30).
    let m = String(method || 'GET').trim();
    let p = String(path || '').trim();
    if (!p && /\s/.test(m)) { const sp = m.split(/\s+/); m = sp[0]; p = sp.slice(1).join(' '); }
    m = m.toUpperCase();
    p = p.replace(/\{account_id\}|:account_id/g, env.CF_ACCOUNT_ID || '');
    if (!p.startsWith('/')) p = '/' + p;
    const url = 'https://api.cloudflare.com/client/v4' + p;
    const init = { method: m, headers: { Authorization: 'Bearer ' + cf, 'Content-Type': 'application/json' } };
    if (bodyJson && m !== 'GET' && m !== 'DELETE') init.body = typeof bodyJson === 'string' ? bodyJson : JSON.stringify(bodyJson);
    let r, t; try { r = await fetch(url, init); t = await r.text(); } catch (e) { return 'ERR:fn:fetch:' + (e.message || e); }
    // The scoped token cannot write zone config (rulesets, cache rules). On an auth
    // failure, retry once with the global key so the build can operate its own zone.
    if ((r.status === 403 || r.status === 401) && env.CLOUDFLARE_GLOBAL_KEY && env.CLOUDFLARE_EMAIL) {
      const init2 = { method: m, headers: { 'X-Auth-Key': env.CLOUDFLARE_GLOBAL_KEY, 'X-Auth-Email': env.CLOUDFLARE_EMAIL, 'Content-Type': 'application/json' } };
      if (init.body) init2.body = init.body;
      try { const r2 = await fetch(url, init2); const t2 = await r2.text(); return 'HTTP ' + r2.status + ' ' + m + ' ' + p + '\n' + t2.slice(0, 4000); } catch {}
    }
    return 'HTTP ' + r.status + ' ' + m + ' ' + p + '\n' + t.slice(0, 4000);
  },
  // ---- Content pipeline (peptides x conditions/pharma combinatorial article engine) ----
  async pipelineSeed(env, kind) {
    kind = String(kind || '').toLowerCase().trim();
    const P = {
      peptide: 'List 8 material regenerative or therapeutic peptides (e.g. BPC-157, TB-500). Output ONLY a JSON array of {"name","note","evidence"} where evidence is one of human|preclinical|anecdotal.',
      condition: 'List 6 material degenerative health conditions where tissue or function is progressively lost (entropic). Output ONLY a JSON array of {"name","note"}.',
      pharma: 'List 5 widely-used pharmaceuticals whose side effects are entropic — they cause atrophy, depletion, or degeneration. Output ONLY a JSON array of {"name","note"}.',
    };
    if (!P[kind]) return 'ERR:fn:kind_must_be peptide|condition|pharma';
    const { text, usage, err } = await callGateway(env, 'You output ONLY a JSON array, no prose, no markdown fence.', P[kind], 1500);
    if (err) return 'ERR:fn:gateway:' + err;
    const arr = pipeJson(text);
    if (!Array.isArray(arr)) return 'ERR:fn:bad_json:' + String(text).slice(0, 200);
    let n = 0;
    for (const it of arr) {
      const name = String(it.name || it).trim(); if (!name) continue;
      await env.DB.prepare("INSERT INTO pipeline(kind,name,phase,evidence,data,status,updated_at) VALUES(?,?,'queued',?,?,'pending',datetime('now'))")
        .bind(kind, name, String(it.evidence || ''), JSON.stringify(it)).run();
      n++;
    }
    return JSON.stringify({ kind, inserted: n, items: arr.map(x => x.name || x), tokens: usage ? (usage.prompt_tokens + usage.completion_tokens) : 0 });
  },
  async pipelineMap(env) {
    const peps = (await env.DB.prepare("SELECT name FROM pipeline WHERE kind='peptide'").all()).results || [];
    const tgts = (await env.DB.prepare("SELECT name,kind FROM pipeline WHERE kind IN ('condition','pharma')").all()).results || [];
    if (!peps.length || !tgts.length) return 'ERR:fn:seed peptides + conditions/pharma first';
    const pairs = [];
    for (const p of peps) for (const t of tgts) pairs.push({ a: p.name, b: t.name });
    // one model pass to weight each pair by regenerative relevance (0..1)
    const list = pairs.map((x, i) => i + ': ' + x.a + ' for ' + x.b).join('\n');
    const { text } = await callGateway(env, 'You output ONLY a JSON object mapping index->number 0..1.', 'Score each peptide-for-condition pair 0..1 for how plausibly the peptide regenerates/counteracts the target. Pairs:\n' + list, 2000);
    const scores = pipeJson(text) || {};
    let n = 0;
    for (let i = 0; i < pairs.length; i++) {
      const w = Number(scores[i] != null ? scores[i] : scores[String(i)]);
      await env.DB.prepare("INSERT INTO pipeline(kind,name,phase,pair_a,pair_b,weight,status,updated_at) VALUES('combo',?,'queued',?,?,?,'pending',datetime('now'))")
        .bind(pairs[i].a + ' × ' + pairs[i].b, pairs[i].a, pairs[i].b, isNaN(w) ? null : w).run();
      n++;
    }
    return JSON.stringify({ combos: n, peptides: peps.length, targets: tgts.length, weighted: Object.keys(scores).length });
  },
  async pipelineWrite(env, id) {
    const row = await env.DB.prepare('SELECT * FROM pipeline WHERE id=?').bind(Number(id)).first();
    if (!row) return 'ERR:fn:no_item:' + id;
    const isCombo = row.kind === 'combo';
    const topic = isCombo ? (row.pair_a + ' for ' + row.pair_b) : (row.kind + ' ' + row.name);
    const outlineSys = 'You are a rigorous health writer. Output a tight markdown outline (## sections) only.';
    const o = await callGateway(env, outlineSys, 'Outline an evidence-graded article on: ' + topic + (isCombo ? '. Frame the peptide as a potential regenerative counter to the condition/drug; separate human vs preclinical vs anecdotal evidence.' : '.'), 1200);
    if (o.err) return 'ERR:fn:outline:' + o.err;
    const writeSys = 'You are a rigorous health writer. Write the article in markdown from the outline. Use ## headings. State evidence level for each claim. Output ONLY {"title","body"} as JSON.';
    const w = await callGateway(env, writeSys, 'Outline:\n' + o.text + '\n\nWrite the full article on: ' + topic, 3500);
    if (w.err) return 'ERR:fn:write:' + w.err;
    const art = pipeJson(w.text) || { title: row.name, body: w.text };
    const slug = String(art.title || row.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const tok = (o.usage ? o.usage.prompt_tokens + o.usage.completion_tokens : 0) + (w.usage ? w.usage.prompt_tokens + w.usage.completion_tokens : 0);
    const post = { slug, title: art.title || row.name, body: art.body || '', tags: isCombo ? ['combo', row.pair_a, row.pair_b] : [row.kind], model: 'grok-4.3 (pipeline)',
      prov: { model: 'grok-4.3', action: 'write', prompt: outlineSys + ' || ' + writeSys, input: topic, response: String(art.body || '').slice(0, 1500), tokens_in: (o.usage?.prompt_tokens || 0) + (w.usage?.prompt_tokens || 0), tokens_out: (o.usage?.completion_tokens || 0) + (w.usage?.completion_tokens || 0), cost: tok * 1.875 / 1e6 } };
    const r = await fetch('https://miscsubjects.com/api/articles/' + slug, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY }, body: JSON.stringify(post) });
    const ok = r.status === 200;
    await env.DB.prepare("UPDATE pipeline SET phase='written', slug=?, data=?, status='done', updated_at=datetime('now') WHERE id=?").bind(slug, JSON.stringify({ outline: o.text }), Number(id)).run();
    return JSON.stringify({ id: Number(id), topic, slug, published: ok, url: 'https://miscsubjects.com/a/' + slug, tokens: tok });
  },
  // Text-driven content tools — ROUTER calls these so a plain text runs the protocol.
  async protoPopulate(env, arg) {
    const peptide = String(arg || '').trim();
    if (!peptide) return 'ERR:need a peptide name';
    const slug = peptide.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const r = await fetch('https://miscsubjects.com/api/protocol/populate', { method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY }, body: JSON.stringify({ peptide, slug, max_rounds: 2 }) });
    let j; try { j = await r.json(); } catch { return 'ERR:populate failed'; }
    if (j.error) return 'ERR:' + j.error;
    return 'Added ' + j.added + ' evidence sources to ' + j.url + ' (' + j.total_sources + ' total' + (j.more ? '. More remain — text "populate ' + peptide + '" again to keep going.' : '. Done — no new sources found.') + ')';
  },
  async protoIdeas(env, arg) {
    const r = await fetch('https://miscsubjects.com/api/protocol/write', { method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY }, body: JSON.stringify({ publish: false, web_search: true, model: 'grok/grok-4.3', ask: String(arg || ''), max_tokens: 900 }) });
    let j; try { j = await r.json(); } catch { return 'ERR:ideas failed'; }
    return j.error ? ('ERR:' + j.error) : (typeof j.output === 'string' ? j.output : JSON.stringify(j.output)).slice(0, 1400);
  },
  async protoWrite(env, arg) {
    const ask = String(arg || '').trim();
    const slug = ask.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    const r = await fetch('https://miscsubjects.com/api/protocol/write', { method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY }, body: JSON.stringify({ slug, model: 'grok/grok-4.3', ask: 'Write the evidence-graded article for: ' + ask, max_tokens: 3000 }) });
    let j; try { j = await r.json(); } catch { return 'ERR:write failed'; }
    return j.error ? ('ERR:' + j.error) : ('Published https://miscsubjects.com/a/' + (j.draft && j.draft.slug || slug) + ' — ' + (j.generated && j.generated.title || ''));
  },
  // Ask the article topology (claims + sources + anecdotes). Arg: slug|question or slug1,slug2|question
  async protoAsk(env, arg) {
    const raw = String(arg || '').trim();
    const pipe = raw.indexOf('|');
    let slugPart = '', question = raw;
    if (pipe > 0) {
      slugPart = raw.slice(0, pipe).trim().toLowerCase();
      question = raw.slice(pipe + 1).trim();
    } else {
      return 'ERR:usage slug|question  e.g. bpc-157|I have herniated discs — what does your catalogue say?';
    }
    const slugs = slugPart.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const slug = slugs[0] || '';
    const body = { slug, question, model: 'grok/grok-4.3' };
    if (slugs.length > 1) body.slugs = slugs;
    const r = await fetch('https://miscsubjects.com/api/protocol/ask', {
      method: 'POST', headers: dispatchHeaders(env),
      body: JSON.stringify(body),
    });
    let j; try { j = await r.json(); } catch { return 'ERR:ask failed'; }
    if (j.error) return 'ERR:' + j.error;
    let out = String(j.answer || '').slice(0, 1200);
    if (j.resolved_slugs && j.resolved_slugs.length > 1) {
      out += '\n\n[Catalogue span: ' + j.resolved_slugs.join(', ') + ']';
    }
    if (j.needs_user_info && j.needs_user_info.length) out += '\n\nI would need: ' + j.needs_user_info.join('; ');
    if (j.gaps && j.gaps.length) out += '\n\nGaps in ledger: ' + j.gaps.join('; ');
    if (j.suggested_followups && j.suggested_followups.length) {
      out += '\n\nYou could also ask:';
      j.suggested_followups.forEach((p, i) => {
        out += '\n' + (i + 1) + '. ' + String(p.imessage_body || p.prompt || '').slice(0, 200);
      });
    }
    if (j.question_node_id) out += '\n\n[Question node: ' + j.question_node_id + ']';
    if (j.ingest_hint) out += '\n' + j.ingest_hint;
    out += '\n\n(' + (j.confidence || 'unknown') + ' confidence · ' + j.disclaimer + ')';
    return out;
  },
  async protoCollaborateCore(env, slug, model, label) {
    const r = await fetch('https://miscsubjects.com/api/protocol/collaborate', {
      method: 'POST', headers: dispatchHeaders(env),
      body: JSON.stringify({ slug, model }),
    });
    let j; try { j = await r.json(); } catch { return 'ERR:collaborate failed'; }
    if (j.error) return 'ERR:' + j.error;
    let out = label + ' collaborated on ' + slug;
    if (j.material === false) out += '\n(no material additions)';
    if (j.claims_added?.length) out += '\n+' + j.claims_added.length + ' claims: ' + j.claims_added.join(', ');
    if (j.challenge_claim_id) out += '\nchallenge: ' + j.challenge_claim_id;
    if (j.rationale) out += '\n' + String(j.rationale).slice(0, 500);
    if (j.honesty) out += '\nactive claims: ' + (j.honesty.active_claims ?? '?');
    out += '\n' + (j.url || '');
    return out;
  },
  // Kimi collaborator #1 — read topology, post claims, optional challenge. Arg: slug
  async protoCollaborate(env, arg) {
    const slug = String(arg || '').trim().toLowerCase();
    if (!slug) return 'ERR:usage slug  e.g. bpc-157';
    return FN_MAP.protoCollaborateCore(env, slug, 'kimi/moonshot-v1-8k', 'Kimi');
  },
  // Gemini collaborator #2 — cheap pass after Kimi. Arg: slug
  async protoGeminiCollaborate(env, arg) {
    const slug = String(arg || '').trim().toLowerCase();
    if (!slug) return 'ERR:usage slug  e.g. bpc-157';
    return FN_MAP.protoCollaborateCore(env, slug, 'gemini/gemini-2.5-flash', 'Gemini');
  },
  // Graph grow queue — one model tick (populate/collaborate/repair/reflex). Arg: slug|step optional
  async protoObsidianPull(env, arg) {
    const slugs = String(arg || 'protocol,bpc-157').trim();
    const r = await fetch('https://miscsubjects.com/api/articles/obsidian-vault?slugs=' + encodeURIComponent(slugs));
    let j; try { j = await r.json(); } catch { return 'ERR:obsidian vault fetch failed'; }
    if (!j.ok) return 'ERR:' + (j.error || 'vault failed');
    return 'Obsidian vault: ' + j.file_count + ' files · v' + (j.version || 1) + '\nPull: node scripts/obsidian_pull.mjs --slugs=' + slugs + '\n' + (j.api || '');
  },
  // Graph lint — orphans, missing pages, unsourced claims, open challenges, stale hubs.
  async protoGraphLint(env) {
    // next-acts carries the same derived lint counts in a bounded response. Fetching
    // the full lint arrays through a nested dispatch exhausted the Worker (1102).
    const r = await fetch('https://miscsubjects.com/api/articles/next-acts?limit=1');
    let j; try { j = await r.json(); } catch { return 'ERR:graph-lint compact fetch failed — GET /api/articles/next-acts?limit=1 returned non-JSON (HTTP ' + r.status + ')'; }
    if (!j.counts) return 'ERR:' + (j.error || 'lint failed');
    const c = j.counts;
    return 'Graph lint: ' + c.articles + ' articles · ' + c.edges + ' edges · ' +
      c.missing_pages + ' missing pages · ' + c.orphans + ' orphans · ' +
      c.unsourced_claim_articles + ' with unsourced claims · ' + c.contested_articles + ' contested · ' + c.stale + ' stale\n' +
      'Full: https://miscsubjects.com/api/articles/graph-lint';
  },
  // Next acts — the compounding-loop queue. Arg: limit (default 10).
  async protoNextActs(env, arg) {
    const limit = Math.max(1, Math.min(50, Number(String(arg || '').trim()) || 10));
    const r = await fetch('https://miscsubjects.com/api/articles/next-acts?limit=' + limit);
    let j; try { j = await r.json(); } catch { return 'ERR:next-acts fetch failed'; }
    if (!Array.isArray(j.acts)) return 'ERR:' + (j.error || 'next-acts failed');
    const lines = j.acts.map((a) => a.kind.toUpperCase() + ' ' + a.target + ' (' + a.score + ') — ' + a.reason);
    return 'Next acts (' + j.acts.length + '):\n' + lines.join('\n') + '\nFull: https://miscsubjects.com/api/articles/next-acts';
  },
  async protoGraphGrow(env, arg) {
    const raw = String(arg || '').trim();
    let slug = '';
    let step = '';
    if (raw.includes('|')) {
      const parts = raw.split('|');
      slug = parts[0].trim().toLowerCase();
      step = parts[1].trim().toLowerCase();
    }
    const body = {};
    if (slug) body.slug = slug;
    if (step) body.step = step;
    const r = await fetch('https://miscsubjects.com/api/protocol/grow', {
      method: 'POST', headers: dispatchHeaders(env),
      body: JSON.stringify(body),
    });
    let j; try { j = await r.json(); } catch { return 'ERR:grow failed'; }
    if (j.error) return 'ERR:' + j.error;
    const t = j.tick || {};
    let out = 'GRAPH_GROW ' + (t.slug || '?') + ' · ' + (t.step || '?') + ' — ' + (t.reason || '');
    if (j.explain_step?.detail) out += '\n' + String(j.explain_step.detail).slice(0, 400);
    if (j.result?.claims_added?.length) out += '\n+' + j.result.claims_added.join(', ');
    if (j.result?.added) out += '\n+' + j.result.added + ' sources';
    out += '\n' + (j.urls?.graph || '');
    return out;
  },
  // Reflex pass — graph proves its own shape vs vision claims. Arg: slug (default protocol)
  async protoReflex(env, arg) {
    const slug = String(arg || 'protocol').trim().toLowerCase() || 'protocol';
    const r = await fetch('https://miscsubjects.com/api/protocol/reflex', {
      method: 'POST', headers: dispatchHeaders(env),
      body: JSON.stringify({ slug }),
    });
    let j; try { j = await r.json(); } catch { return 'ERR:reflex failed'; }
    if (j.error) return 'ERR:' + j.error;
    const ok = (j.probes || []).filter((p) => p.ok).length;
    const fail = (j.probes || []).filter((p) => !p.ok && !p.gap).length;
    const gap = (j.probes || []).filter((p) => p.gap).length;
    let out = 'Reflex pass on ' + slug + ': ' + ok + ' OK, ' + fail + ' FAIL, ' + gap + ' GAP';
    if (j.claims_added?.length) out += '\n+' + j.claims_added.join(', ');
    out += '\n' + (j.url || 'https://miscsubjects.com/graph.html?slugs=protocol,bpc-157&layer=reflex');
    return out;
  },
  // Conversation router — gate (asked&answered) or append model blocks to ledger.
  // Arg: gate|slug|question  OR  append|MODEL_OUTPUT_TEXT  OR  turn|slug|question|MODEL_OUTPUT
  async protoRouter(env, arg) {
    const raw = String(arg || '').trim();
    const pipe = raw.indexOf('|');
    const mode = pipe > 0 ? raw.slice(0, pipe).trim().toLowerCase() : 'turn';
    const rest = pipe > 0 ? raw.slice(pipe + 1).trim() : raw;
    let body = { mode };
    if (mode === 'gate') {
      const p2 = rest.indexOf('|');
      if (p2 <= 0) return 'ERR:usage gate|slug|question';
      body.slug = rest.slice(0, p2).trim().toLowerCase();
      body.question = rest.slice(p2 + 1).trim();
    } else if (mode === 'append') {
      body.text = rest;
      body.model = 'conversation-router';
    } else {
      const p2 = rest.indexOf('|');
      if (p2 <= 0) return 'ERR:usage turn|slug|question|model_output';
      const p3 = rest.indexOf('|', p2 + 1);
      if (p3 <= 0) return 'ERR:usage turn|slug|question|model_output';
      body.slug = rest.slice(0, p2).trim().toLowerCase();
      body.question = rest.slice(p2 + 1, p3).trim();
      body.text = rest.slice(p3 + 1).trim();
    }
    const r = await fetch('https://miscsubjects.com/api/protocol/router', {
      method: 'POST', headers: dispatchHeaders(env),
      body: JSON.stringify(body),
    });
    let j; try { j = await r.json(); } catch { return 'ERR:router failed'; }
    if (j.error) return 'ERR:' + j.error;
    if (j.phase === 'defense' && j.gate?.asked_and_answered) {
      return 'ASKED & ANSWERED — ' + (j.gate.message || j.gate.question_node_id) +
        '\n' + (j.gate.article_url || '');
    }
    const appended = j.append?.results || j.results;
    if (appended?.claims?.length) {
      return 'ROUTER appended ' + appended.claims.length + ' claim(s): ' +
        appended.claims.map((c) => c.claim_id).join(', ');
    }
    return JSON.stringify(j).slice(0, 1200);
  },
  // Post one claim voxel into article ledger. Arg: slug|tier|assertion
  async protoClaim(env, arg) {
    const raw = String(arg || '').trim();
    const pipe = raw.indexOf('|');
    if (pipe <= 0) return 'ERR:usage slug|tier|assertion  e.g. bpc-157|anecdotal|Reddit user reports gut healing';
    const slug = raw.slice(0, pipe).trim().toLowerCase();
    const rest = raw.slice(pipe + 1).trim();
    const pipe2 = rest.indexOf('|');
    if (pipe2 <= 0) return 'ERR:usage slug|tier|assertion — tier is human|preclinical|anecdotal|mechanistic|speculative';
    const tier = rest.slice(0, pipe2).trim().toLowerCase();
    const text = rest.slice(pipe2 + 1).trim();
    if (!text) return 'ERR:assertion text required after second |';
    const r = await fetch('https://miscsubjects.com/api/protocol/claim', {
      method: 'POST', headers: dispatchHeaders(env),
      body: JSON.stringify({ slug, tier, text, channel: 'imessage', author: 'user' }),
    });
    let j; try { j = await r.json(); } catch { return 'ERR:claim failed'; }
    if (j.error) return 'ERR:' + j.error;
    let out = j.message || 'Claim posted.';
    out += '\n\n**' + j.claim_id + '** [' + j.tier + '] ' + text.slice(0, 400);
    if (j.who_claims) out += '\nwho_claims: ' + j.who_claims;
    out += '\n\n' + (j.voxels_url ? 'https://miscsubjects.com' + j.voxels_url : '');
    return out;
  },
  // Ingest evidence from user / external model into article ledger. Arg: slug|evidence or slug|q:node|evidence
  async protoIngest(env, arg) {
    const raw = String(arg || '').trim();
    const pipe = raw.indexOf('|');
    if (pipe <= 0) return 'ERR:usage slug|evidence  or  slug|q:NODE_ID|paste from Grok/GPT';
    const slug = raw.slice(0, pipe).trim().toLowerCase();
    const evidence = raw.slice(pipe + 1).trim();
    const r = await fetch('https://miscsubjects.com/api/protocol/ingest', {
      method: 'POST', headers: dispatchHeaders(env),
      body: JSON.stringify({ slug, evidence, channel: 'imessage', author: 'user' }),
    });
    let j; try { j = await r.json(); } catch { return 'ERR:ingest failed'; }
    if (j.error) return 'ERR:' + j.error;
    let out = j.message || 'Logged to ledger.';
    if (j.summary) out += '\n\n' + String(j.summary).slice(0, 600);
    out += '\n\n' + (j.url || '');
    if (j.question_node_id) out += '\n(linked to ' + j.question_node_id + ')';
    return out;
  },
  // List tasks (writer jobs live here). Arg: status (default open). No quotes needed by callers.
  async taskList(env, status) {
    const st = String(status || 'open').trim() || 'open';
    const rows = (await env.DB.prepare('SELECT id,status,body,source,created_at FROM tasks WHERE status=? ORDER BY id DESC LIMIT 30').bind(st).all()).results || [];
    return JSON.stringify({ status: st, count: rows.length, tasks: rows });
  },
  async pipelineStatus(env) {
    const counts = (await env.DB.prepare('SELECT kind, phase, COUNT(*) n FROM pipeline GROUP BY kind, phase').all()).results || [];
    const top = (await env.DB.prepare("SELECT name, weight FROM pipeline WHERE kind='combo' AND weight IS NOT NULL ORDER BY weight DESC LIMIT 8").all()).results || [];
    return JSON.stringify({ counts, top_combos: top });
  },
  // Cannibalize a SKILL.md (frontmatter name+description, markdown body) into a proposed
  // agent directory row whose content IS the skill instructions — making it an invokable
  // sub-agent. PROPOSE only. Args: source(url|r2:key|raw)|model|category
  async skillImport(env, src, model, category) {
    const got = await resolveSource(env, src);
    if (got.err) return got.err;
    const { meta, body } = parseFrontmatter(got.text);
    const name = meta.name || ((body.match(/^#\s*(.+)$/m) || [])[1] || 'skill');
    const key = ('SKILL_' + keyify(name)).slice(0, 60);
    const desc = String(meta.description || '').replace(/\s+/g, ' ').slice(0, 200);
    const mdl = String(model || 'grok-4.3');
    const cat = keyify(category || 'skill').toLowerCase();
    const content = '# ' + (desc || name) + '\n' + body;
    const exists = await env.DB.prepare('SELECT 1 FROM directory WHERE key=?').bind(key).first();
    const sql = `INSERT OR IGNORE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES (` +
      `'${sqlEsc(key)}','agent','${sqlEsc(mdl)}','${sqlEsc(authForModel(mdl))}','${sqlEsc(content)}','${sqlEsc(cat)}',60,0,1,datetime('now'));`;
    return JSON.stringify({ source: String(src).slice(0, 120), name, key, model: mdl, status: exists ? 'exists' : 'new', description: desc, body_bytes: body.length, sql });
  },
  // Cannibalize an agent definition (md frontmatter: name/description/model/tools, body =
  // system prompt) into a proposed agent directory row. PROPOSE only. Args:
  // source(url|r2:key|raw)|category
  async agentImport(env, src, category) {
    const got = await resolveSource(env, src);
    if (got.err) return got.err;
    const { meta, body } = parseFrontmatter(got.text);
    const name = meta.name || ((body.match(/^#\s*(.+)$/m) || [])[1] || 'agent');
    const key = keyify(name).slice(0, 60);
    const desc = String(meta.description || '').replace(/\s+/g, ' ').slice(0, 200);
    const mdl = String(meta.model || 'grok-4.3');
    const cat = keyify(category || 'agent').toLowerCase();
    const allowed = String(meta.categories || meta.allowed_categories || '*');
    const content = '# ' + (desc || name) + (meta.tools ? '\n# upstream tools: ' + meta.tools : '') + '\n' + body;
    const exists = await env.DB.prepare('SELECT 1 FROM directory WHERE key=?').bind(key).first();
    const sql = `INSERT OR IGNORE INTO directory (key,type,target,auth,content,category,allowed_categories,planner_rank,planner_visible,enabled,updated_at) VALUES (` +
      `'${sqlEsc(key)}','agent','${sqlEsc(mdl)}','${sqlEsc(authForModel(mdl))}','${sqlEsc(content)}','${sqlEsc(cat)}','${sqlEsc(allowed)}',60,0,1,datetime('now'));`;
    return JSON.stringify({ source: String(src).slice(0, 120), name, key, model: mdl, status: exists ? 'exists' : 'new', description: desc, allowed_categories: allowed, body_bytes: body.length, sql });
  },
  // ---- OIP protocol index + registry (Object Invocation Protocol v0.1) ----
  async oipProtocol(env) {
    return JSON.stringify(oipProtocolPayload());
  },
  async oipRegistry(env, categoryFilter) {
    const dir = await loadDirectory(env);
    return JSON.stringify(registryFromRows(dir, String(categoryFilter || '').trim()));
  },
  // ---- Self-describing manifest + stateful sessions (the bootstrap + state substrate) ----
  // One call → every callable row with description/runner/risk/approval/status/schema.
  // The contract a cold client (terminal agent, MCP consumer) bootstraps from. Arg: category(optional).
  async directoryManifest(env, categoryFilter) {
    const cat = String(categoryFilter || '').trim();
    const dir = await loadDirectory(env);
    const filtered = Object.values(dir)
      .filter((x) => Number(x.enabled ?? 1) === 1)
      .filter((x) => !cat || String(x.category || '') === cat)
      .sort((a, b) => Number(a.planner_rank ?? 100) - Number(b.planner_rank ?? 100) || String(a.key).localeCompare(String(b.key)));
    const rows = filtered.map((x) => {
      const obj = directoryRowToObject(x);
      const status = !Number(x.enabled) ? 'disabled' : (!Number(x.planner_visible) ? 'internal' : 'active');
      return {
        key: x.key, type: x.type, category: x.category || null,
        description: obj.description,
        runner: obj.runner,
        risk: obj.risk,
        requires_approval: obj.requires_approval,
        status,
        input_schema: obj.input_schema,
        examples: obj.examples || null,
        object_type: obj.object_type,
        read: obj.read,
        write: obj.write,
      };
    });
    const reg = registryFromRows(Object.fromEntries(filtered.map((x) => [x.key, x])), cat);
    return JSON.stringify({ protocol: 'OIP', version: OIP_VERSION, count: rows.length, rows, objects: reg.objects });
  },
  async sessionStart(env, sessionId, agent, cwd, goal) {
    const id = String(sessionId || ('sess_' + crypto.randomUUID().slice(0, 8)));
    const ts = buildNowIso();
    const prior = await env.DB.prepare('SELECT created_at, last_event_id FROM sessions WHERE session_id=?').bind(id).first();
    await env.DB.prepare(
      'INSERT OR REPLACE INTO sessions (session_id, agent, cwd, goal, status, last_event_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, String(agent || ''), String(cwd || ''), String(goal || ''), 'active', prior?.last_event_id || null, prior?.created_at || ts, ts).run();
    return JSON.stringify({ session_id: id, agent: String(agent || ''), cwd: String(cwd || ''), goal: String(goal || ''), status: 'active', created_at: prior?.created_at || ts });
  },
  async sessionGet(env, sessionId) {
    const row = await env.DB.prepare('SELECT * FROM sessions WHERE session_id=?').bind(String(sessionId || '')).first();
    return row ? JSON.stringify(row) : 'ERR:fn:no_session:' + sessionId;
  },
  async sessionUpdate(env, sessionId, patchJson) {
    let patch = {}; try { patch = JSON.parse(patchJson || '{}'); } catch { return 'ERR:fn:bad_patch_json'; }
    const allowed = ['agent', 'cwd', 'goal', 'status', 'last_event_id'];
    const sets = [], binds = [];
    for (const k of allowed) if (Object.prototype.hasOwnProperty.call(patch, k)) { sets.push(k + '=?'); binds.push(String(patch[k])); }
    if (!sets.length) return 'ERR:fn:no_fields:allowed=' + allowed.join(',');
    sets.push('updated_at=?'); binds.push(buildNowIso());
    binds.push(String(sessionId || ''));
    const r = await env.DB.prepare('UPDATE sessions SET ' + sets.join(',') + ' WHERE session_id=?').bind(...binds).run();
    return JSON.stringify({ ok: true, changes: r.meta.changes, session_id: String(sessionId || '') });
  },
  async sessionResume(env, sessionId, limit) {
    const id = String(sessionId || '');
    const row = await env.DB.prepare('SELECT * FROM sessions WHERE session_id=?').bind(id).first();
    if (!row) return 'ERR:fn:no_session:' + id;
    let events = [];
    if (env.LEDGER) {
      const lim = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), 100);
      const e = await env.LEDGER.prepare(
        'SELECT id,ts,source,key,action,direction,request_preview,response_preview FROM events WHERE actor=? ORDER BY ts DESC LIMIT ?'
      ).bind(id, lim).all();
      events = e.results || [];
    }
    return JSON.stringify({ session: row, recent_events: events, note: 'rehydrate from session + recent_events; log new turns to LEDGER with actor=' + id });
  },
  // Pipe-safe content write for the Kernel OS app's prompt editor. Args: key|content ($2+ keeps pipes).
  async setRowContent(env, key, content) {
    if (!key) return 'ERR:fn:no_key';
    const ts = buildNowIso();
    const c = String(content == null ? '' : content);
    const r = await env.DB.prepare('UPDATE directory SET content=?, updated_at=? WHERE key=?').bind(c, ts, String(key)).run();
    if (env.KV) { try { await env.KV.delete('directory:snapshot'); } catch {} }
    return JSON.stringify({ ok: true, key: String(key), changes: r.meta.changes, bytes: c.length });
  },
  // Create/replace a flow row from the app's doodle editor. Args: key|dsl ($2+ keeps the > and | in the DSL).
  async saveFlowRow(env, key, dsl) {
    if (!key) return 'ERR:fn:no_key';
    const ts = buildNowIso();
    await env.DB.prepare('INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,planner_rank,planner_visible,enabled,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(String(key), 'flow', '', '', String(dsl == null ? '' : dsl), 'flow', 60, 1, 1, ts).run();
    if (env.KV) { try { await env.KV.delete('directory:snapshot'); } catch {} }
    return JSON.stringify({ ok: true, key: String(key), type: 'flow', dsl: String(dsl == null ? '' : dsl) });
  },
  // Spawn any Mac coding CLI in a fresh session (headless). Args: agent|prompt|cwd|mode
  // mode: readonly (plan/sandbox) | auto. Links trace_id when called inside dispatch.
  async cliAgentSpawn(env, agent, prompt, cwd, mode, delivery) {
    const trace = env.TRACE_CTX && env.TRACE_CTX.trace;
    try {
      const out = await spawnCliAgent(env, {
        agent,
        prompt,
        cwd: cwd || '/Users/owner/miscsubjects-pages',
        mode: mode || 'auto',
        delivery: delivery || 'headless',
        trace_id: trace || null,
      });
      return JSON.stringify(out);
    } catch (e) { return 'ERR:fn:cli_spawn:' + (e && e.message || e); }
  },
  // CLI Agent Team Room — agents debate a topic on a shared transcript. Args: agents|topic|cwd|mode|delivery
  async cliAgentGroup(env, agents, topic, cwd, mode, delivery) {
    const trace = env.TRACE_CTX && env.TRACE_CTX.trace;
    try {
      const out = await runCliAgentGroup(env, {
        agents,
        topic,
        cwd: cwd || '/Users/owner/miscsubjects-pages',
        mode: mode || 'readonly',
        delivery: delivery || 'headless',
        trace_id: trace || null,
      });
      return JSON.stringify(out);
    } catch (e) { return 'ERR:fn:cli_group:' + (e && e.message || e); }
  },
  // Issue reflex — scoped brief → background CLI agent team. Args: brief|agents|cwd|mode|delivery
  async cliIssueReflex(env, brief, agents, cwd, mode, delivery) {
    const trace = env.TRACE_CTX && env.TRACE_CTX.trace;
    try {
      const out = await triggerIssueReflex(env, {
        brief,
        agents: agents || 'kimi,codex',
        cwd: cwd || '/Users/owner/miscsubjects-pages',
        mode: mode || 'readonly',
        delivery: delivery || 'headless',
        trace_id: trace || null,
        source: 'manual',
      });
      return JSON.stringify(out);
    } catch (e) { return 'ERR:fn:cli_reflex:' + (e && e.message || e); }
  },
  // ---- Resident agents (durable loop on the sibling Worker's AgentDO) ----
  // Spawn a resident agent that loops on a goal until done. Args: goal|brain|maxSteps
  async agentSpawn(env, goal, brain, maxSteps) {
    const id = 'ag_' + crypto.randomUUID().slice(0, 8);
    const payload = { id, goal: String(goal || ''), brain: String(brain || 'ROUTER').toUpperCase(), maxSteps: parseInt(maxSteps || '12', 10) || 12, now: buildNowIso() };
    try {
      const r = await fetch(SIBLING_BASE + '/agent/spawn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      return JSON.stringify({ ok: true, id, goal: payload.goal, brain: payload.brain, maxSteps: payload.maxSteps, agent: j });
    } catch (e) { return 'ERR:fn:agent_spawn:' + (e && e.message || e); }
  },
  // List resident agents with live status (from the agents table the DO upserts). Args: none
  async agentList(env) {
    const r = await env.DB.prepare('SELECT id,goal,brain,status,steps,last_action,updated FROM agents ORDER BY updated DESC LIMIT 50').all();
    return JSON.stringify(r.results || []);
  },
  // Control a resident agent. Args: op(status|send|pause|resume|kill|events)|id|msg
  async agentOp(env, op, id, msg) {
    const o = String(op || 'status').toLowerCase();
    const aid = String(id || '');
    if (!aid) return 'ERR:fn:no_agent_id';
    if (!['status', 'send', 'pause', 'resume', 'kill', 'events'].includes(o)) return 'ERR:fn:bad_op:' + o;
    try {
      const init = o === 'send'
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ msg: String(msg || ''), now: buildNowIso() }) }
        : { method: 'POST' };
      const r = await fetch(SIBLING_BASE + '/agent/' + o + '?id=' + encodeURIComponent(aid), init);
      return await r.text();
    } catch (e) { return 'ERR:fn:agent_op:' + (e && e.message || e); }
  },
};
  return FN_MAP;
}
