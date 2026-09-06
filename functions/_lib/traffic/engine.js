// TRAFFIC ENGINE — REQUEST → IDENTIFIERS → PROFILE → SIGNALS → POLICY → DECISION.
//
// evaluateContext() is pure: signal context + configuration snapshot in, decision out, with every
// rule's every condition recorded true/false. decide() wraps it with identity resolution, cookie
// state, persistence and the Ledger. explain() runs it on a simulated context with no side effects.
// replay() re-runs a stored decision's own signals against the revision that made it and against
// the live configuration, and reports the difference.

import { buildNowIso } from '../build_time.js';
import { evaluate, ipInCidrs } from './conditions.js';
import { normalizeRequest, parseCookies, bucketOf, persistableSignals, visitorHashOf } from './signals.js';
import { readCookie, issueGrant, sha256Hex } from './grants.js';
import { loadSnapshot, loadStored, loadRevision, persistDecision, persistVisit, recordGrant, appendEvent, ledger, getDecision, tenantOf, newId, upsertMembership } from './store.js';

export const ENGINE_VERSION = '2';
const MAX_FALLBACK_HOPS = 5;

function glob(pattern, value) {
  const p = String(pattern == null || pattern === '' ? '*' : pattern);
  if (p === '*') return true;
  const re = new RegExp('^' + p.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
  return re.test(String(value || ''));
}

/** Choose the ruleset whose entry patterns match this request. `test` picks a state=test ruleset by id. */
export function pickRuleset(snapshot, { host, path, entry, test = null }) {
  for (const rs of snapshot.rulesets || []) {
    if (rs.state === 'test' && rs.id !== test) continue;
    if (rs.state !== 'active' && rs.state !== 'test') continue;
    const pats = Array.isArray(rs.entry) && rs.entry.length ? rs.entry : [];
    if (!pats.length) continue;
    for (const pat of pats) {
      if (pat.entry != null && String(pat.entry) !== String(entry || '')) continue;
      if (!glob(pat.host, host)) continue;
      if (!glob(pat.path, path)) continue;
      return rs;
    }
  }
  return null;
}

/** The campaign bound to a ruleset (ruleset.campaign_id, else a campaign whose ruleset_id points back). */
export function campaignFor(snapshot, ruleset) {
  if (!ruleset) return null;
  if (ruleset.campaign_id && snapshot.campaigns?.[ruleset.campaign_id]) return snapshot.campaigns[ruleset.campaign_id];
  return Object.values(snapshot.campaigns || {}).find((c) => c.ruleset_id === ruleset.id) || null;
}

function inWindow(from, to, nowIso) {
  if (from && nowIso < String(from)) return false;
  if (to && nowIso > String(to)) return false;
  return true;
}

function listEntryMatches(entry, ctx) {
  const v = String(entry.value || '').trim();
  const low = v.toLowerCase();
  switch (entry.kind) {
    case 'profile': return !!ctx.profile?.id && String(ctx.profile.id) === v;
    case 'device': return !!ctx.device?.id && String(ctx.device.id) === v;
    case 'visitor_hash': return !!ctx.network?.visitor_hash && ctx.network.visitor_hash === v;
    case 'phone_hash': return (ctx.profile?.memberships || []).some((m) => m.subject_kind === 'phone_hash' && m.id === v);
    case 'identifier': return (ctx.profile?.identifier_kinds || []).map((k) => String(k).toLowerCase()).includes(low);
    case 'ip': return !!ctx.network?.ip && ctx.network.ip === v;
    case 'cidr': return ipInCidrs(ctx.network?.ip, v.split(','));
    case 'country': return String(ctx.network?.country || '').toLowerCase() === low;
    case 'region': return String(ctx.network?.region_code || ctx.network?.region || '').toLowerCase() === low;
    case 'asn': return ctx.network?.asn != null && String(ctx.network.asn) === v;
    case 'email_domain': return ctx.profile?.attrs?.email_domain ? String(ctx.profile.attrs.email_domain).toLowerCase() === low : false;
    case 'tag': return (ctx.profile?.tags || []).map((t) => String(t).toLowerCase()).includes(low);
    case 'ua': { try { return new RegExp(v, 'i').test(ctx.request?.user_agent || ''); } catch { return String(ctx.request?.user_agent || '').toLowerCase().includes(low); } }
    case 'referrer': return String(ctx.request?.referrer_host || '').toLowerCase() === low || String(ctx.request?.referrer_host || '').toLowerCase().endsWith('.' + low);
    default: return false;
  }
}

function weightedPick(items, bucket) {
  const total = items.reduce((s, x) => s + Math.max(0, Number(x.weight) || 0), 0);
  if (total <= 0) return items[0] || null;
  const target = (bucket / 100) * total;
  let acc = 0;
  for (const it of items) { acc += Math.max(0, Number(it.weight) || 0); if (target < acc) return it; }
  return items[items.length - 1];
}

async function assignExperiment(exp, ctx, nowIso) {
  const existing = ctx.profile?.experiments?.[exp.id];
  if (existing) return { id: exp.id, variant: existing, unit_key: null, existing: true, reason: 'stored_assignment' };
  if (exp.start_at && nowIso < exp.start_at) return { id: exp.id, variant: null, reason: 'not_started' };
  if (exp.end_at && nowIso > exp.end_at) return { id: exp.id, variant: null, reason: 'ended' };
  if (exp.segment_condition) { const r = evaluate(exp.segment_condition, ctx); if (!r.result) return { id: exp.id, variant: null, reason: 'outside_segment', trace: r.trace }; }
  const unit = exp.unit === 'device' ? ctx.device?.id : (ctx.profile?.id || ctx.device?.id);
  const unit_key = unit ? `${exp.unit || 'profile'}:${unit}` : null;
  let bucket;
  if (exp.assignment === 'random' || !unit_key) bucket = Math.floor(Math.random() * 100);
  else bucket = await bucketOf(unit_key, exp.salt || exp.id);
  const v = weightedPick(exp.variants || [], bucket);
  if (!v) return { id: exp.id, variant: null, reason: 'no_variants' };
  return { id: exp.id, variant: v.key, unit_key, bucket, existing: false, destination_id: v.destination_id || null, experience: v.experience || null, reason: exp.assignment === 'random' || !unit_key ? 'random' : 'deterministic_bucket' };
}

/** Resolve a destination through groups and fallbacks. Returns { destination, chain, fallback_used, reason }. */
export async function resolveDestination(snapshot, id, ctx, { hops = 0, chain = [] } = {}) {
  if (!id) return { destination: null, chain, fallback_used: false, reason: 'no_destination' };
  const d = snapshot.destinations?.[id];
  chain = chain.concat([id]);
  if (!d) return { destination: null, chain, fallback_used: false, reason: `destination_not_found:${id}` };
  if (hops > MAX_FALLBACK_HOPS) return { destination: null, chain, fallback_used: true, reason: 'fallback_loop' };
  const unavailable = !Number(d.enabled) ? 'disabled' : (['down', 'maintenance'].includes(d.health) ? `health:${d.health}` : null);
  if (unavailable) {
    if (d.fallback_id && !chain.includes(d.fallback_id)) {
      const r = await resolveDestination(snapshot, d.fallback_id, ctx, { hops: hops + 1, chain });
      return { ...r, fallback_used: true, reason: `${id}:${unavailable}→${r.reason || d.fallback_id}` };
    }
    return { destination: null, chain, fallback_used: true, reason: `${id}:${unavailable}:no_fallback` };
  }
  if (d.type === 'group') {
    const members = (d.members || []).filter((m) => m && m.id);
    const unit = Number(d.sticky) ? (ctx.profile?.id || ctx.device?.id) : null;
    const bucket = unit ? await bucketOf(unit, 'group:' + d.id) : Math.floor(Math.random() * 100);
    const pick = weightedPick(members, bucket);
    if (!pick) return { destination: null, chain, fallback_used: false, reason: 'group_empty' };
    const r = await resolveDestination(snapshot, pick.id, ctx, { hops: hops + 1, chain });
    return { ...r, reason: `group:${d.id}:bucket=${bucket}→${pick.id}` + (r.fallback_used ? `:${r.reason}` : ''), group_bucket: bucket };
  }
  return { destination: d, chain, fallback_used: false, reason: 'ok' };
}

function emptyCore(ruleset, snapshot) {
  return { ruleset_id: ruleset?.id || null, ruleset_revision: ruleset?.revision ?? null, ruleset_hash: ruleset?.hash || snapshot?.hash || null, evaluated: [], matched_rules: [], list_matches: [], shadow: [], actions: [], policy_effects: [], destination_id: null, experience: null, experience_meta: null, outcome: null, deny: false, allow: false, tags_add: [], tags_remove: [], persist: {}, emits: [], capabilities: [], memberships: [], grant: null, ttl_s: null, experiment: null, fallback_used: false, fail_mode_used: null, reason: '', reasons: [], error: null, segments: [] };
}

/** Owner signal policy (traffic_signal_policy): each row says what a signal value means. Applied before rules. */
function applySignalPolicy(ctx, snapshot, out) {
  for (const p of snapshot.signal_policy || []) {
    if (!Number(p.enabled)) continue;
    const observed = readSignal(ctx, p.signal);
    const match = p.value == null || p.value === '' || p.value === '*' ? (observed != null && observed !== '' && observed !== false) : String(observed ?? '').toLowerCase() === String(p.value).toLowerCase();
    if (!match) continue;
    const rec = { policy_id: p.id, signal: p.signal, value: observed, effect: p.effect, effect_value: p.effect_value };
    out.policy_effects.push(rec);
    switch (p.effect) {
      case 'score': ctx.network.risk = Math.max(0, Math.min(100, Number(ctx.network.risk || 0) + Number(p.effect_value || 0))); out.reasons.push(`${p.signal}=${observed} contributed ${Number(p.effect_value) >= 0 ? '+' : ''}${Number(p.effect_value)} risk (policy ${p.id})`); break;
      case 'block': out.deny = true; out.experience = 'DENY'; out.outcome = 'blocked'; out.reason = `signal_policy:${p.id}:${p.signal}=${observed}`; out.reasons.push(`${p.signal}=${observed} → BLOCK (policy ${p.id})`); break;
      case 'allow': out.allow = true; out.outcome = out.outcome || 'approved'; out.reasons.push(`${p.signal}=${observed} → allow (policy ${p.id})`); break;
      case 'challenge': ctx.custom.__challenge_required = true; out.reasons.push(`${p.signal}=${observed} → challenge required (policy ${p.id})`); break;
      default: out.reasons.push(`${p.signal}=${observed} observed (policy ${p.id}: observe)`);
    }
    if (out.deny) break;
  }
}
function readSignal(ctx, path) {
  const steps = String(path || '').split('.');
  let v = ctx;
  for (const s of steps) { if (v == null) return undefined; v = v[s]; }
  return v;
}

/**
 * Pure policy evaluation. Mutates ctx.custom / ctx.lists / ctx.turnstile.skip / ctx.experiment /
 * ctx.network.risk as effects run (that is how later rules read what earlier ones set).
 */
export async function evaluateContext(ctx, snapshot, ruleset, { nowIso = buildNowIso(), campaign = null } = {}) {
  const out = emptyCore(ruleset, snapshot);
  campaign = campaign || campaignFor(snapshot, ruleset);
  if (campaign) { ctx.campaign = { id: campaign.id, name: campaign.name }; out.campaign_id = campaign.id; }
  out.reasons.push(`profile ${ctx.profile.known ? 'known' : 'unknown'}${ctx.profile.customer ? ', customer' : ''}; status ${ctx.profile.status || 'unknown'}${ctx.profile.status_source ? ' (' + ctx.profile.status_source + ')' : ''}`);
  if (ctx.history?.jci_status && ctx.history.jci_status !== 'unknown') out.reasons.push(`historical JCI status ${ctx.history.jci_status} over ${ctx.history.rows} rows`); else out.reasons.push('historical status unavailable');
  if (ctx.consistency) { out.reasons.push(`device consistency ${ctx.consistency.device}`); out.reasons.push(`timezone consistency ${ctx.consistency.timezone}`); }
  // 0. owner signal policy
  applySignalPolicy(ctx, snapshot, out);
  out.reasons.push(`risk score ${ctx.network.risk}`);
  // 1. segments (request scope)
  for (const s of snapshot.segments || []) {
    if (s.scope === 'profile') continue;
    const r = evaluate(s.condition, ctx);
    out.segments.push({ id: s.id, name: s.name, result: r.result });
    if (r.result && !ctx.profile.segments.includes(s.id)) ctx.profile.segments.push(s.id);
  }
  // 2. lists
  let stopAfterLists = out.deny;
  for (const e of snapshot.lists || []) {
    if (stopAfterLists) break;
    if (!listEntryMatches(e, ctx)) continue;
    const m = { id: e.id, list: e.list, kind: e.kind, effect: e.effect, reason: e.reason };
    out.list_matches.push(m);
    ctx.lists[e.list === 'allow' ? 'allow' : 'deny'].push(e.id);
    ctx.lists[e.list === 'allow' ? 'allow_match' : 'deny_match'] = true;
    if (!ctx.lists.kinds.includes(e.kind)) ctx.lists.kinds.push(e.kind);
    const eff = e.effect_obj || {};
    switch (e.effect) {
      case 'decide':
        if (e.list === 'deny') { out.deny = true; out.experience = 'DENY'; out.outcome = 'blocked'; out.reason = `denylist:${e.id}:${e.reason}`; out.reasons.push(`denylist entry ${e.id} (${e.kind}) → deny: ${e.reason}`); stopAfterLists = true; }
        else { out.allow = true; out.outcome = 'approved'; out.reasons.push(`allowlist entry ${e.id} (${e.kind}): ${e.reason}`); if (eff.destination) { out.destination_id = eff.destination; out.reason = `allowlist:${e.id}:${e.reason}`; stopAfterLists = true; } }
        break;
      case 'score': ctx.network.risk = Math.max(0, Math.min(100, Number(ctx.network.risk || 0) + (Number(eff.delta) || (e.list === 'deny' ? 40 : -40)))); out.reasons.push(`list ${e.id} adjusted risk to ${ctx.network.risk}`); break;
      case 'skip_challenge': if (e.list === 'allow') { ctx.turnstile.skip = true; out.reasons.push(`list ${e.id} skips the challenge`); } break;
      case 'route': if (eff.destination) { out.destination_id = eff.destination; out.reason = `list_route:${e.id}`; out.reasons.push(`list ${e.id} routes to ${eff.destination}`); } break;
      case 'set': if (eff.path && /^custom\./.test(eff.path)) setPath(ctx, eff.path, eff.value); if (eff.tag) ctx.profile.tags.push(eff.tag); break;
      default: break;
    }
  }
  // 3. rules
  if (!stopAfterLists) {
    for (const rule of ruleset.rules || []) {
      if (!Number(rule.enabled)) continue;
      if (!inWindow(rule.effective_from, rule.effective_to, nowIso)) { out.evaluated.push({ rule_id: rule.id, name: rule.name, priority: rule.priority, skipped: 'outside_effective_window' }); continue; }
      const r = evaluate(rule.condition, ctx);
      const rec = { rule_id: rule.id, name: rule.name, priority: rule.priority, shadow: !!Number(rule.shadow), result: r.result, conditions: r.trace, actions: r.result ? rule.actions : undefined };
      out.evaluated.push(rec);
      if (!r.result) continue;
      if (Number(rule.shadow)) {
        const shadowOut = { ...out, actions: [], reasons: [], destination_id: out.destination_id, experience: out.experience, outcome: out.outcome };
        const shadowCtx = JSON.parse(JSON.stringify(ctx));
        const halt = await applyActions(rule, shadowOut, shadowCtx, snapshot, nowIso, campaign);
        out.shadow.push({ rule_id: rule.id, would: { destination_id: shadowOut.destination_id, experience: shadowOut.experience, outcome: shadowOut.outcome, actions: shadowOut.actions, halt } });
        continue;
      }
      out.matched_rules.push(rule.id);
      out.reasons.push(`rule matched: ${rule.name || rule.id}`);
      const halt = await applyActions(rule, out, ctx, snapshot, nowIso, campaign);
      if (halt) break;
    }
  }
  // 4. a signal policy asked for a challenge and nothing else decided
  if (ctx.custom.__challenge_required && !out.experience && !out.deny && !ctx.turnstile.valid && !ctx.turnstile.skip) { out.experience = 'VERIFY'; out.experience_meta = { policy: true }; out.reason = out.reason || 'signal_policy:challenge'; }
  // 5. campaign outcome → destination
  if (out.outcome && campaign) applyOutcome(out, ctx, campaign);
  return out;
}

/** Map a campaign outcome to the campaign's configured experience for this phase. */
function applyOutcome(out, ctx, campaign) {
  const phase = ctx.request?.phase || 'visit';
  const squeeze = () => { out.experience = 'SQUEEZE'; out.destination_id = null; out.experience_meta = { campaign_id: campaign.id }; };
  switch (out.outcome) {
    case 'approved': out.experience = null; out.destination_id = campaign.approved_destination || out.destination_id || campaign.default_destination; out.reasons.push(`outcome approved → ${out.destination_id}`); break;
    case 'blocked':
      if (phase === 'visit' && Number(campaign.blocked_capture) && campaign.sms_phone) { squeeze(); out.reasons.push('outcome blocked, blocked_capture on → squeeze page (no protected progression will be issued)'); }
      else if (campaign.blocked_destination) { out.experience = null; out.destination_id = campaign.blocked_destination; out.reasons.push(`outcome blocked → blocked completion ${campaign.blocked_destination}`); }
      else { out.experience = 'DENY'; out.deny = true; out.reasons.push('outcome blocked, no blocked destination → deny'); }
      break;
    case 'unknown':
      if (phase === 'visit' && campaign.sms_phone) { squeeze(); out.reasons.push('outcome unknown → squeeze page'); }
      else if (phase === 'visit') { out.experience = null; out.destination_id = campaign.default_destination || out.destination_id; out.reasons.push(`outcome unknown, no SMS channel → default ${out.destination_id}`); }
      else { out.outcome = 'review'; out.destination_id = campaign.review_destination || null; out.reasons.push('outcome unknown after verification → review'); }
      break;
    case 'review': out.experience = null; out.destination_id = campaign.review_destination || campaign.default_destination || out.destination_id; out.reasons.push(`outcome review → ${out.destination_id || 'hold'}`); break;
    default: break;
  }
}

function setPath(obj, path, value) {
  const steps = String(path).split('.');
  let o = obj;
  for (let i = 0; i < steps.length - 1; i++) { if (o[steps[i]] == null || typeof o[steps[i]] !== 'object') o[steps[i]] = {}; o = o[steps[i]]; }
  o[steps[steps.length - 1]] = value;
}

/** Apply one matched rule's actions. Returns true when evaluation must stop. */
async function applyActions(rule, out, ctx, snapshot, nowIso, campaign) {
  let halt = rule.on_match !== 'continue';
  for (const a of rule.actions || []) {
    const rec = { rule_id: rule.id, type: a.type };
    switch (a.type) {
      case 'destination': out.destination_id = a.id; out.experience = null; out.reason = `rule:${rule.id}`; rec.id = a.id; out.reasons.push(`→ destination ${a.id}`); break;
      case 'experience': out.experience = String(a.value || '').toUpperCase(); out.experience_meta = { html: a.html || null, status: a.status || null, campaign_id: campaign?.id || null }; out.reason = `rule:${rule.id}`; rec.value = out.experience; out.reasons.push(`→ experience ${out.experience}`); break;
      case 'outcome': out.outcome = String(a.value); out.reason = `rule:${rule.id}:outcome=${a.value}`; rec.value = a.value; out.reasons.push(`→ outcome ${a.value}`); break;
      case 'require_turnstile': {
        const maxAge = Number(a.max_age_s || 0);
        const fresh = ctx.turnstile.valid && (!maxAge || (ctx.turnstile.age_s != null && ctx.turnstile.age_s <= maxAge));
        rec.satisfied = !!(ctx.turnstile.skip || fresh);
        if (!rec.satisfied) { out.experience = 'VERIFY'; out.experience_meta = { rule_id: rule.id, max_age_s: maxAge || null }; out.reason = `rule:${rule.id}:turnstile_required`; out.reasons.push('turnstile required and not satisfied → VERIFY'); halt = true; } else out.reasons.push('turnstile requirement satisfied' + (ctx.turnstile.skip ? ' (skipped by allowlist)' : ` (age ${ctx.turnstile.age_s}s)`));
        break;
      }
      case 'require_ack': {
        const have = ctx.profile?.acks?.[a.policy];
        rec.satisfied = have != null && String(have) === String(a.version) && (!a.trusted_only || ctx.device.trusted);
        if (!rec.satisfied) { out.experience = 'ACK'; out.experience_meta = { rule_id: rule.id, policy: a.policy, version: String(a.version), title: a.title || null, html: a.html || null, trust_device: a.trust_device !== false }; out.reason = `rule:${rule.id}:ack_required:${a.policy}@${a.version}`; out.reasons.push(`acknowledgement ${a.policy}@${a.version} required (have ${have ?? 'none'}) → ACK`); halt = true; } else out.reasons.push(`acknowledgement ${a.policy}@${a.version} already accepted on this device`);
        break;
      }
      case 'tag': for (const t of [].concat(a.add || [])) { out.tags_add.push(t); if (!ctx.profile.tags.includes(t)) ctx.profile.tags.push(t); } for (const t of [].concat(a.remove || [])) { out.tags_remove.push(t); ctx.profile.tags = ctx.profile.tags.filter((x) => x !== t); } break;
      case 'experiment': {
        const exp = (snapshot.experiments || []).find((e) => e.id === a.id);
        if (!exp) { rec.error = 'experiment_not_found_or_inactive'; break; }
        const asg = await assignExperiment(exp, ctx, nowIso);
        rec.assignment = asg;
        if (asg.variant) {
          out.experiment = asg; ctx.experiment = { id: exp.id, variant: asg.variant }; ctx.profile.experiments[exp.id] = asg.variant;
          out.reasons.push(`experiment ${exp.id} → variant ${asg.variant} (${asg.reason})`);
          const v = (exp.variants || []).find((x) => x.key === asg.variant) || {};
          if (v.destination_id) { out.destination_id = v.destination_id; out.experience = null; out.reason = `rule:${rule.id}:experiment:${exp.id}=${asg.variant}`; }
          if (v.experience) { out.experience = String(v.experience).toUpperCase(); out.reason = `rule:${rule.id}:experiment:${exp.id}=${asg.variant}`; }
        } else out.reasons.push(`experiment ${exp.id} not assigned (${asg.reason})`);
        break;
      }
      case 'set': setPath(ctx, a.path, a.value); rec.path = a.path; break;
      case 'score': ctx.network.risk = Math.max(0, Math.min(100, Number(ctx.network.risk || 0) + Number(a.delta || 0))); out.reasons.push(`rule ${rule.id} adjusted risk by ${a.delta} → ${ctx.network.risk}`); break;
      case 'persist': out.persist[a.key] = a.value; break;
      case 'membership': out.memberships.push({ status: a.status, population: a.population || 'rule', rule_id: rule.id, subject: a.subject || 'profile' }); break;
      case 'deny': out.deny = true; out.experience = 'DENY'; out.outcome = out.outcome || 'blocked'; out.experience_meta = { rule_id: rule.id, message: a.message || null }; out.reason = `rule:${rule.id}:deny`; out.reasons.push('→ deny'); halt = true; break;
      case 'allow': out.allow = true; out.outcome = out.outcome || 'approved'; break;
      case 'grant': out.grant = { audience: a.audience || null, destination: a.destination || null, ttl_s: a.ttl_s || null, one_time: a.one_time !== false, rule_id: rule.id }; break;
      case 'ttl': out.ttl_s = Number(a.seconds) || null; break;
      case 'stop': halt = true; break;
      case 'continue': halt = false; break;
      case 'capability': out.capabilities.push({ key: a.key, args: a.args || null, rule_id: rule.id }); break;
      case 'emit': out.emits.push({ kind: a.kind, payload: a.payload || null, rule_id: rule.id }); break;
      default: rec.error = 'unknown_action';
    }
    out.actions.push(rec);
  }
  return halt;
}

function failMode(ruleset, snapshot, out, err) {
  const mode = ruleset?.fail_mode || 'FALLBACK';
  out.error = String(err && err.message ? err.message : err).slice(0, 500);
  out.fail_mode_used = mode;
  out.reasons.push(`evaluation failed: ${out.error} → fail mode ${mode}`);
  if (mode === 'FALLBACK' && ruleset?.default_destination && snapshot?.destinations?.[ruleset.default_destination] && Number(snapshot.destinations[ruleset.default_destination].enabled)) {
    out.destination_id = ruleset.default_destination; out.experience = null; out.fallback_used = true; out.reason = `fail_mode:FALLBACK:${out.error}`;
  } else if (mode === 'DENY') { out.experience = 'DENY'; out.destination_id = null; out.reason = `fail_mode:DENY:${out.error}`; }
  else if (mode === 'STATIC_PAGE') { out.experience = 'STATIC'; out.experience_meta = { html: ruleset?.static_html || null }; out.destination_id = null; out.reason = `fail_mode:STATIC_PAGE:${out.error}`; }
  else { out.experience = 'UNAVAILABLE'; out.destination_id = null; out.reason = `fail_mode:FAIL_CLOSED:${out.error}`; }
  return out;
}

/** Turn the evaluation core into a complete decision: default/fallback destination, fail modes, hashes. */
export async function finalizeDecision({ ctx, snapshot, ruleset, core, tenant, mode, t0, nowIso, request_id, entry, campaign = null }) {
  campaign = campaign || campaignFor(snapshot, ruleset);
  const d = {
    decision_id: newId('dec'), engine: ENGINE_VERSION, tenant: tenantOf(tenant), ts: nowIso, mode, request_id,
    host: ctx.request.host, path: ctx.request.path, entry: entry || ctx.request.entry || null, phase: ctx.request.phase || 'visit',
    profile_id: ctx.profile.id, device_id: ctx.device.id, session_id: ctx.session.id, profile_snapshot_version: ctx.profile.snapshot_version ?? null,
    ruleset_id: core.ruleset_id, ruleset_revision: core.ruleset_revision, ruleset_hash: core.ruleset_hash, campaign_id: campaign?.id || core.campaign_id || null,
    segments: core.segments, list_matches: core.list_matches, policy_effects: core.policy_effects, evaluated: core.evaluated, matched_rules: core.matched_rules, actions: core.actions, shadow: core.shadow,
    turnstile: { ...ctx.turnstile }, experiment: core.experiment, risk: ctx.network.risk,
    destination_id: null, destination: null, experience: core.experience, experience_meta: core.experience_meta, outcome: core.outcome, deny: core.deny,
    fallback_used: !!core.fallback_used, fail_mode_used: core.fail_mode_used, reason: core.reason, reasons: core.reasons.slice(), error: core.error,
    tags_add: core.tags_add, tags_remove: core.tags_remove, persist: core.persist, emits: core.emits, capabilities: core.capabilities, memberships: core.memberships, grant_request: core.grant, ttl_s: core.ttl_s,
    destination_chain: [], grant_jti: null, latency_ms: null, evidence_hash: null, ledger_event_id: null, response_kind: null, response_target: null,
  };
  if (!d.experience || d.experience === 'ACK' || d.experience === 'VERIFY') {
    let wanted = core.destination_id;
    let usedDefault = false;
    if (!wanted && !core.error) { wanted = ruleset.default_destination || campaign?.default_destination || null; usedDefault = !!wanted; }
    const r = await resolveDestination(snapshot, wanted, ctx);
    d.destination_chain = r.chain;
    if (r.destination) {
      d.destination_id = r.destination.id;
      d.destination = { id: r.destination.id, name: r.destination.name, type: r.destination.type, url: r.destination.url || null, health: r.destination.health, grant_required: !!Number(r.destination.grant_required), campaign_id: r.destination.campaign_id || null };
      if (r.destination.type === 'squeeze' && !d.experience) { d.experience = 'SQUEEZE'; d.experience_meta = { campaign_id: r.destination.campaign_id || campaign?.id || null, destination_id: r.destination.id }; }
      if (r.fallback_used) { d.fallback_used = true; d.reason = (d.reason ? d.reason + ' → ' : '') + `fallback:${r.reason}`; d.reasons.push(`destination fallback: ${r.reason}`); }
      else if (usedDefault) { d.fallback_used = true; d.reason = (d.reason ? d.reason + ' → ' : '') + 'default_destination'; d.reasons.push(`no rule chose a destination → default ${d.destination_id}`); }
      else if (!d.reason) d.reason = r.reason;
    } else if (!core.error) {
      const mode2 = ruleset.fail_mode || 'FALLBACK';
      d.fail_mode_used = mode2;
      if (mode2 === 'DENY') d.experience = 'DENY';
      else if (mode2 === 'STATIC_PAGE') { d.experience = 'STATIC'; d.experience_meta = { html: ruleset.static_html || null }; }
      else d.experience = 'UNAVAILABLE';
      d.fallback_used = true;
      d.reason = (d.reason ? d.reason + ' → ' : '') + `unroutable:${r.reason}:fail_mode=${mode2}`;
      d.reasons.push(`nothing routable (${r.reason}) → fail mode ${mode2}`);
    }
  }
  if (d.experience === 'DENY') { d.destination_id = null; d.destination = null; }
  if (d.experience === 'SQUEEZE' && !d.destination_id && campaign) d.destination_id = campaign.default_destination && snapshot.destinations[campaign.default_destination]?.type === 'squeeze' ? campaign.default_destination : null;
  d.latency_ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  d.signals = persistableSignals(ctx);
  d.evidence_hash = 'sha256:' + await sha256Hex(JSON.stringify({ decision_id: d.decision_id, ts: d.ts, ruleset_hash: d.ruleset_hash, matched_rules: d.matched_rules, list_matches: d.list_matches, destination_id: d.destination_id, experience: d.experience, outcome: d.outcome, reason: d.reason, signals: d.signals }));
  return d;
}

const EMPTY_STORED = () => ({ device: null, profile: null, acks: {}, identifier_kinds: [], previous_destinations: [], experiments: {}, original_attribution: null, memberships: { status: 'unknown', source: null, list: [] }, history: null, visitor_hash: null });

/**
 * Live decision for a real Request. Returns { decision, ctx, snapshot, ruleset, campaign, cookies_to_set, stored }.
 * Persistence is scheduled via `waitUntil` when provided.
 */
export async function decide(env, { request, url, tenant, entry = null, mode = 'live', waitUntil = null, testRuleset = null, now = Date.now(), remote = null, snapshot = null }) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const t = tenantOf(tenant);
  const nowIso = buildNowIso(now);
  const secret = env.TRAFFIC_GRANT_SECRET || env.TERMINAL_KEY || '';
  const u = url instanceof URL ? url : new URL(String(url));
  const cookies = remote?.cookies || parseCookies(request?.headers?.get ? request.headers.get('cookie') : '');
  snapshot = snapshot || await loadSnapshot(env, t);
  const ruleset = pickRuleset(snapshot, { host: u.hostname, path: u.pathname, entry, test: testRuleset || u.searchParams.get('__ruleset') });
  const campaign = campaignFor(snapshot, ruleset);
  const cookies_to_set = [];
  let deviceId = cookies.ms_did && /^d_[A-Za-z0-9]{8,40}$/.test(cookies.ms_did) ? cookies.ms_did : null;
  const newDevice = !deviceId;
  if (!deviceId) { deviceId = newId('d'); cookies_to_set.push(['ms_did', deviceId, 400 * 86400]); }
  let sessionId = cookies.ms_sid && /^s_[A-Za-z0-9]{8,40}$/.test(cookies.ms_sid) ? cookies.ms_sid : null;
  if (!sessionId) sessionId = newId('s');
  cookies_to_set.push(['ms_sid', sessionId, 1800]);
  const ip = remote?.ip || (request?.headers?.get ? (request.headers.get('cf-connecting-ip') || '') : '');
  const visitor_hash = ip ? await visitorHashOf(ip) : null;
  let stored;
  try { stored = await loadStored(env, t, newDevice ? null : deviceId, { visitor_hash, precedence: ruleset?.status_precedence || null }); }
  catch (e) { stored = EMPTY_STORED(); stored.lookup_error = String(e.message || e); }
  const newProfile = !stored.profile;
  const profileId = stored.profile?.id || newId('prf');
  if (!stored.profile) stored.profile = { id: profileId, known: 0, customer: 0, tags: [], attrs: {}, snapshot: {}, visit_count: 0, first_seen: null, version: 1 };
  if (cookies.ms_tsv) { const p = await readCookie(secret, cookies.ms_tsv); if (p && p.d === deviceId && p.t) stored.turnstile = { verified_at: p.t }; }
  if (cookies.ms_gs) { const p = await readCookie(secret, cookies.ms_gs); if (p && p.d === deviceId && p.exp > Math.floor(now / 1000)) stored.grant = { destination: p.dest }; }
  const ctx = await normalizeRequest({ request, url: u, cookies: { ...cookies, ms_did: newDevice ? undefined : cookies.ms_did, ms_sid: cookies.ms_sid }, entry, now, stored, cfg: ruleset || {}, campaign, secret, remote });
  ctx.device.id = deviceId; ctx.device.new = newDevice; ctx.session.id = sessionId; ctx.profile.id = profileId;
  if (stored.lookup_error) ctx.custom.__lookup_error = stored.lookup_error;
  const request_id = ctx.request.id;
  let core;
  if (!ruleset) {
    core = emptyCore(null, snapshot); core.experience = 'UNAVAILABLE'; core.experience_meta = { status: 404 }; core.reason = 'no_ruleset_matches_entry'; core.reasons.push('no active ruleset matches this host/path/entry');
  } else {
    try {
      if (stored.lookup_error) throw new Error('profile_lookup_unavailable: ' + stored.lookup_error);
      core = await evaluateContext(ctx, snapshot, ruleset, { nowIso, campaign });
    } catch (e) { core = failMode(ruleset, snapshot, emptyCore(ruleset, snapshot), e); }
  }
  const decision = await finalizeDecision({ ctx, snapshot, ruleset: ruleset || {}, core, tenant: t, mode: ruleset?.state === 'test' ? 'test' : mode, t0, nowIso, request_id, entry, campaign });
  // grant issuance for destinations that require one (not for blocked outcomes: SMS capture and protected progression are separate decisions)
  if (decision.destination && (decision.destination.grant_required || decision.grant_request) && !decision.experience && decision.outcome !== 'blocked' && !(ctx.grant.valid && ctx.grant.destination === decision.destination_id)) {
    try {
      const dst = snapshot.destinations[decision.destination_id];
      const aud = decision.grant_request?.audience || (dst.url ? new URL(dst.url).hostname : ctx.request.host);
      const g = await issueGrant(secret, { tenant: t, aud, dest: decision.destination_id, sub: profileId, dev: deviceId, rev: decision.ruleset_revision, dec: decision.decision_id, ttl_s: decision.grant_request?.ttl_s || dst.grant_ttl_s || 300, one_time: decision.grant_request ? decision.grant_request.one_time : !!Number(dst.grant_one_time), reason: decision.reason, now });
      decision.grant_jti = g.payload.jti; decision.grant_token = g.token; decision.grant = g.payload;
      decision.reasons.push(`access grant ${g.payload.jti} issued for ${decision.destination_id}`);
      try { await recordGrant(env, { tenant: t, payload: g.payload, reason: decision.reason, decision_id: decision.decision_id }); }
      catch (e) { decision.grant_record_error = String(e.message || e); await ledger(env, { key: 'TRAFFIC_GRANT_ISSUE_FAILED', action: 'record', status: 500, trace_id: decision.decision_id, request: { jti: g.payload.jti }, response: { error: decision.grant_record_error } }); }
    } catch (e) {
      decision.error = (decision.error ? decision.error + '; ' : '') + 'grant_issue_failed: ' + String(e.message || e);
      decision.experience = 'UNAVAILABLE'; decision.reason += ' → grant_issue_failed';
      await ledger(env, { key: 'TRAFFIC_GRANT_ISSUE_FAILED', action: 'issue', status: 500, trace_id: decision.decision_id, request: { destination: decision.destination_id }, response: { error: String(e.message || e) } });
    }
  }
  const persist = async () => {
    try {
      if (decision.experience === 'DENY' || decision.error || (decision.fallback_used && decision.fail_mode_used)) {
        decision.ledger_event_id = await ledger(env, { key: decision.error ? 'TRAFFIC_DECISION_ERROR' : (decision.experience === 'DENY' ? 'TRAFFIC_DENY' : 'TRAFFIC_FALLBACK'), action: 'decide', status: decision.error ? 500 : 200, trace_id: decision.decision_id, route: u.pathname, request: { entry, ruleset: decision.ruleset_id, revision: decision.ruleset_revision, profile: profileId, device: deviceId }, response: { destination: decision.destination_id, experience: decision.experience, outcome: decision.outcome, reason: decision.reason, error: decision.error, evidence_hash: decision.evidence_hash } });
      }
      await persistDecision(env, decision);
      const tags = decision.tags_add.length || decision.tags_remove.length ? ctx.profile.tags : null;
      const attrs = Object.keys(decision.persist).length ? Object.assign({}, stored.profile?.attrs || {}, decision.persist) : null;
      await persistVisit(env, { tenant: t, ctx, decision, deviceId, profileId, sessionId, newDevice, newProfile, secret, tags, attrs });
      await appendEvent(env, { tenant: t, kind: 'routing_decision', event_type: 'ROUTING_DECISION', decision_id: decision.decision_id, profile_id: profileId, device_id: deviceId, session_id: sessionId, destination_id: decision.destination_id, campaign_id: decision.campaign_id, url: u.pathname, source: 'engine', payload: { experience: decision.experience, outcome: decision.outcome, reason: decision.reason, ruleset: decision.ruleset_id, revision: decision.ruleset_revision }, attribution: { utm_source: ctx.attribution.utm_source, utm_medium: ctx.attribution.utm_medium, utm_campaign: ctx.attribution.utm_campaign, utm_content: ctx.attribution.utm_content, utm_term: ctx.attribution.utm_term, click_ids: ctx.attribution.click_ids, referring_domain: ctx.attribution.referring_domain, landing_page: ctx.attribution.landing_page } });
      if (decision.experiment?.id && decision.experiment.variant) await appendEvent(env, { tenant: t, kind: 'exposure', event_type: 'EXPERIMENT_EXPOSURE', decision_id: decision.decision_id, profile_id: profileId, device_id: deviceId, session_id: sessionId, destination_id: decision.destination_id, experiment_id: decision.experiment.id, variant: decision.experiment.variant, campaign_id: decision.campaign_id, payload: { existing: !!decision.experiment.existing, method: decision.experiment.reason } });
      if (decision.experience === 'VERIFY') await appendEvent(env, { tenant: t, kind: 'turnstile_challenge', event_type: 'TURNSTILE_CHALLENGE', decision_id: decision.decision_id, profile_id: profileId, device_id: deviceId, session_id: sessionId, campaign_id: decision.campaign_id });
      for (const e of decision.emits) await appendEvent(env, { tenant: t, kind: String(e.kind).slice(0, 40), decision_id: decision.decision_id, profile_id: profileId, device_id: deviceId, session_id: sessionId, destination_id: decision.destination_id, campaign_id: decision.campaign_id, payload: e.payload });
      for (const m of decision.memberships) await upsertMembership(env, { tenant: t, subject_kind: m.subject === 'device' ? 'device' : 'profile', subject_value: m.subject === 'device' ? deviceId : profileId, status: m.status, population: m.population, source: 'rule:' + m.rule_id, provenance: { decision_id: decision.decision_id, rule_id: m.rule_id }, confidence: 0.8, actor: 'engine' });
      for (const c of decision.capabilities) {
        if (!(ruleset?.allowed_capabilities || []).includes(c.key)) { await ledger(env, { key: 'TRAFFIC_CAPABILITY_REFUSED', action: 'refuse', status: 403, trace_id: decision.decision_id, request: c, response: { allowed: ruleset?.allowed_capabilities || [] } }); continue; }
        const body = JSON.stringify({ tenant: t, profile_id: profileId, device_id: deviceId, decision_id: decision.decision_id, capability: c.key, args: c.args });
        if (env.TASKS) await env.TASKS.send({ key: 'TRAFFIC_ENRICH', body, ts: nowIso }); else await appendEvent(env, { tenant: t, kind: 'enrichment_skipped_no_queue', decision_id: decision.decision_id, profile_id: profileId, payload: { capability: c.key } });
      }
      for (const en of (ruleset?.enrichment || [])) {
        if (!en || !en.capability) continue;
        if (en.when && !evaluate(en.when, ctx).result) continue;
        if (env.TASKS) await env.TASKS.send({ key: 'TRAFFIC_ENRICH', body: JSON.stringify({ tenant: t, profile_id: profileId, device_id: deviceId, decision_id: decision.decision_id, capability: en.capability, args: en.args || null }), ts: nowIso });
      }
      if (newProfile && env.TASKS) await env.TASKS.send({ key: 'TRAFFIC_ENRICH', body: JSON.stringify({ tenant: t, profile_id: profileId, device_id: deviceId, decision_id: decision.decision_id, capability: 'PROFILE_REFRESH' }), ts: nowIso });
    } catch (e) {
      await ledger(env, { key: 'TRAFFIC_PERSIST_FAILED', action: 'persist', status: 500, trace_id: decision.decision_id, request: { decision_id: decision.decision_id }, response: { error: String(e.message || e) } });
    }
  };
  if (waitUntil) waitUntil(persist()); else await persist();
  return { decision, ctx, snapshot, ruleset, campaign, cookies_to_set, stored, deviceId, sessionId, profileId };
}

/**
 * Dry run. `sim` = { url, method?, headers?, user_agent?, cf?, cookies?, ip?, country?, region?, timezone?, asn?, bot_score?,
 * profile?, device?, acks?, turnstile?, memberships?, history?, now?, custom?, entry?, ruleset_id?, phase? }.
 * No cookies are set, nothing is persisted, no Ledger row is written. The full evaluation is returned.
 */
export async function explain(env, { tenant, sim = {}, snapshot = null }) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const t = tenantOf(tenant);
  const now = sim.now ? new Date(sim.now).getTime() : Date.now();
  const nowIso = buildNowIso(now);
  const u = new URL(sim.url || 'https://miscsubjects.com/go/acceptance');
  snapshot = snapshot || await loadSnapshot(env, t);
  const entry = sim.entry || (u.pathname.startsWith('/go/') ? u.pathname.split('/')[2] || null : null);
  const ruleset = sim.ruleset_id ? (snapshot.rulesets.find((r) => r.id === sim.ruleset_id) || null) : pickRuleset(snapshot, { host: u.hostname, path: u.pathname, entry, test: sim.test_ruleset || null });
  const campaign = campaignFor(snapshot, ruleset);
  const headers = Object.fromEntries(Object.entries(sim.headers || {}).map(([k, v]) => [String(k).toLowerCase(), String(v)]));
  if (sim.user_agent) headers['user-agent'] = sim.user_agent;
  if (sim.ip) headers['cf-connecting-ip'] = sim.ip;
  const stored = EMPTY_STORED();
  stored.device = sim.device ? { id: sim.device.id || 'd_simulated', trusted: sim.device.trusted ? 1 : 0, revoked_at: sim.device.revoked ? nowIso : null, trust_expires_at: sim.device.trust_expires_at || null } : null;
  stored.profile = sim.profile ? { id: sim.profile.id || 'prf_simulated', known: sim.profile.known ? 1 : 0, customer: sim.profile.customer ? 1 : 0, account_state: sim.profile.account_state || null, tags: sim.profile.tags || [], attrs: sim.profile.attrs || {}, snapshot: { features: sim.profile.features || {}, segments: sim.profile.segments || [], version: sim.profile.snapshot_version || 1 }, visit_count: sim.profile.visit_count || 0, first_seen: sim.profile.first_seen || null, merged: false, version: sim.profile.snapshot_version || 1 } : null;
  stored.acks = sim.acks || {}; stored.identifier_kinds = sim.profile?.identifier_kinds || []; stored.previous_destinations = sim.profile?.previous_destinations || []; stored.experiments = sim.profile?.experiments || {}; stored.original_attribution = sim.profile?.original_attribution || null;
  stored.turnstile = sim.turnstile?.verified_at ? { verified_at: new Date(sim.turnstile.verified_at).getTime() } : (sim.turnstile?.valid ? { verified_at: now - 1000 } : null);
  stored.grant = sim.grant || null;
  stored.memberships = sim.memberships ? { status: sim.memberships.status || 'unknown', source: sim.memberships.source || 'simulated', list: sim.memberships.list || [] } : (sim.status ? { status: sim.status, source: 'simulated', list: [] } : { status: 'unknown', source: null, list: [] });
  stored.history = sim.history || null;
  stored.visitor_hash = sim.visitor_hash || (sim.ip ? await visitorHashOf(sim.ip) : null);
  const cookies = Object.assign({}, sim.cookies || {});
  if (stored.device) cookies.ms_did = stored.device.id;
  if (sim.session_id) cookies.ms_sid = sim.session_id;
  if (sim.visitor_timezone) cookies.ms_tz = sim.visitor_timezone;
  const cf = Object.assign({}, sim.cf || {});
  if (sim.country && !cf.country) cf.country = sim.country;
  if (sim.region && !cf.regionCode) { cf.regionCode = sim.region; cf.region = sim.region; }
  if (sim.timezone && !cf.timezone) cf.timezone = sim.timezone;
  if (sim.asn && !cf.asn) cf.asn = sim.asn;
  if (sim.as_org && !cf.asOrganization) cf.asOrganization = sim.as_org;
  if (sim.bot_score != null) cf.botManagement = { score: Number(sim.bot_score) };
  const ctx = await normalizeRequest({ request: null, url: u, cf, cookies, entry, now, stored, cfg: ruleset || {}, campaign, secret: env.TRAFFIC_GRANT_SECRET || '', remote: { headers, ip: sim.ip || null, method: sim.method || 'GET', custom: sim.custom || {}, request_id: 'explain', phase: sim.phase || 'visit' } });
  if (stored.device) ctx.device.known = true;
  if (stored.profile) ctx.profile.id = stored.profile.id;
  if (sim.buckets) Object.assign(ctx.buckets, sim.buckets);
  if (!ruleset) return { ok: true, mode: 'explain', tenant: t, ruleset: null, reason: 'no_ruleset_matches_entry', signals: persistableSignals(ctx), candidates: snapshot.rulesets.map((r) => ({ id: r.id, state: r.state, entry: r.entry })), side_effects: 'none' };
  let core;
  try { core = await evaluateContext(ctx, snapshot, ruleset, { nowIso, campaign }); }
  catch (e) { core = failMode(ruleset, snapshot, emptyCore(ruleset, snapshot), e); }
  const decision = await finalizeDecision({ ctx, snapshot, ruleset, core, tenant: t, mode: 'explain', t0, nowIso, request_id: 'explain', entry, campaign });
  return { ok: true, mode: 'explain', tenant: t, side_effects: 'none', snapshot_hash: snapshot.hash, snapshot_cache: snapshot.cache || null, ruleset: { id: ruleset.id, name: ruleset.name, state: ruleset.state, revision: ruleset.revision, fail_mode: ruleset.fail_mode, default_destination: ruleset.default_destination, campaign: campaign ? { id: campaign.id, name: campaign.name } : null }, decision: stripBulk(decision), signals: decision.signals, rule_order: ruleset.rules.map((r) => ({ id: r.id, name: r.name, priority: r.priority, enabled: !!Number(r.enabled), shadow: !!Number(r.shadow) })) };
}

function stripBulk(d) { const c = { ...d }; delete c.signals; delete c.grant_token; return c; }

/** Replay a stored decision against its original revision and against the live configuration. */
export async function replay(env, { tenant, decision_id, against = 'both' }) {
  const t = tenantOf(tenant);
  const stored = await getDecision(env, { tenant: t, decision_id });
  if (!stored) return { ok: false, error: 'decision_not_found' };
  if (!stored.signals) return { ok: false, error: 'decision_has_no_signals (erased or pre-engine)' };
  const runs = {};
  const run = async (label, snap) => {
    if (!snap) { runs[label] = { error: 'snapshot_unavailable' }; return; }
    const rs = snap.rulesets.find((r) => r.id === stored.ruleset_id) || pickRuleset(snap, { host: stored.host, path: stored.path, entry: stored.entry });
    if (!rs) { runs[label] = { error: 'ruleset_not_in_snapshot', ruleset_id: stored.ruleset_id }; return; }
    const ctx = JSON.parse(JSON.stringify(stored.signals));
    ctx.network.ip = ctx.network.ip || null;
    ctx.profile.segments = []; ctx.lists = { allow_match: false, deny_match: false, allow: [], deny: [], kinds: [] }; ctx.experiment = { id: null, variant: null }; ctx.turnstile.skip = false; ctx.custom = ctx.custom || {}; delete ctx.custom.__challenge_required;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let core;
    try { core = await evaluateContext(ctx, snap, rs, { nowIso: stored.ts }); }
    catch (e) { core = failMode(rs, snap, emptyCore(rs, snap), e); }
    const d = await finalizeDecision({ ctx, snapshot: snap, ruleset: rs, core, tenant: t, mode: 'replay', t0, nowIso: stored.ts, request_id: stored.request_id, entry: stored.entry });
    runs[label] = { ruleset_revision: rs.revision ?? snap.revision ?? null, snapshot_hash: snap.hash, destination_id: d.destination_id, experience: d.experience, outcome: d.outcome, matched_rules: d.matched_rules, list_matches: d.list_matches.map((m) => m.id), reason: d.reason, reasons: d.reasons, fallback_used: d.fallback_used, evaluated: d.evaluated, note: 'cidr/ip list entries cannot re-match on replay: the raw IP is never stored' };
  };
  if (against === 'both' || against === 'original') await run('original', stored.ruleset_revision != null ? await loadRevision(env, { tenant: t, ruleset_id: stored.ruleset_id, revision: stored.ruleset_revision }) : null);
  if (against === 'both' || against === 'current') await run('current', await loadSnapshot(env, t, { fresh: true }));
  const recorded = { destination_id: stored.destination_id, experience: stored.experience, outcome: stored.outcome, matched_rules: stored.matched_rules, reason: stored.reason, ruleset_revision: stored.ruleset_revision };
  const diff = {};
  for (const [label, r] of Object.entries(runs)) {
    if (r.error) { diff[label] = r; continue; }
    diff[label] = { same_destination: r.destination_id === recorded.destination_id, same_experience: (r.experience || null) === (recorded.experience || null), same_outcome: (r.outcome || null) === (recorded.outcome || null), same_rules: JSON.stringify(r.matched_rules) === JSON.stringify(recorded.matched_rules), destination: [recorded.destination_id, r.destination_id], experience: [recorded.experience, r.experience], outcome: [recorded.outcome, r.outcome], matched_rules: [recorded.matched_rules, r.matched_rules] };
  }
  await ledger(env, { key: 'TRAFFIC_REPLAY', action: 'replay', trace_id: decision_id, route: `/api/traffic/replay/${decision_id}`, request: { tenant: t, against }, response: Object.fromEntries(Object.entries(diff).map(([k, v]) => [k, v.error ? v : { same_destination: v.same_destination, same_experience: v.same_experience, same_rules: v.same_rules }])) });
  return { ok: true, decision_id, recorded, runs, diff, side_effects: 'ledger row only' };
}
