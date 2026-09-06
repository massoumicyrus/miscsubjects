// TRAFFIC ENGINE — the SMS / iMessage squeeze funnel.
//
// visitor → squeeze variant assigned (sticky) → CTA opens a composer pre-filled "JOIN ABC123" →
// inbound Blooio message resolves ABC123 → phone joins the profile → policy is re-evaluated in
// phase post_sms → VERIFIED_AND_APPROVED (grant + progression link) | VERIFIED_BUT_BLOCKED
// (contact kept, no grant) | VERIFIED_REVIEW_REQUIRED (held). Every stage is a traffic_events row,
// so funnel rates per variant are derived, never separately counted.

import { buildNowIso } from '../build_time.js';
import { bucketOf } from './signals.js';
import { issueGrant, identifierHash, maskIdentifier } from './grants.js';
import { appendEvent, ledger, linkIdentifiers, loadSnapshot, tenantOf, newId, recordGrant, getDecision, upsertMembership } from './store.js';
import { evaluateContext, finalizeDecision, pickRuleset } from './engine.js';
import { persistDecision } from './store.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export const CODE_TTL_S = 3600;

export function newCode(len = 6) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return s;
}

export function normalizePhone(v) {
  const digits = String(v || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits;
}

/** Pick the squeeze variant for this visitor: enabled, active-window pages of the campaign, weighted, sticky by profile/device. */
export async function pickSqueezePage(env, { tenant, campaign, ctx, nowIso }) {
  const t = tenantOf(tenant);
  const rows = (await env.DB.prepare("SELECT * FROM traffic_squeeze_pages WHERE tenant_id=? AND campaign_id=? AND enabled=1 AND status='active' AND (start_at IS NULL OR start_at='' OR start_at<=?) AND (end_at IS NULL OR end_at='' OR end_at>=?) ORDER BY id").bind(t, campaign.id, nowIso, nowIso).all()).results || [];
  if (!rows.length) return { page: null, reason: 'no_active_squeeze_page' };
  const unit = ctx.profile?.id || ctx.device?.id;
  const bucket = unit ? await bucketOf(unit, 'squeeze:' + campaign.id) : Math.floor(Math.random() * 100);
  const total = rows.reduce((s, r) => s + Math.max(0, Number(r.weight) || 0), 0) || rows.length;
  const target = (bucket / 100) * total;
  let acc = 0, pick = rows[rows.length - 1];
  for (const r of rows) { acc += Math.max(0, Number(r.weight) || (total === rows.length ? 1 : 0)); if (target < acc) { pick = r; break; } }
  return { page: { ...pick, media: safeJson(pick.media_json, []) }, bucket, reason: `sticky_bucket=${bucket}` };
}

function safeJson(v, f) { if (v == null || v === '') return f; try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return f; } }

/** Issue the correlation code for a squeeze view (one small insert; the page needs it). */
export async function issueCode(env, { tenant, campaign, page, decision, ctx }) {
  const t = tenantOf(tenant);
  const now = buildNowIso();
  const exp = buildNowIso(Date.now() + CODE_TTL_S * 1000);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newCode(6);
    try {
      await env.DB.prepare('INSERT INTO traffic_codes (code, tenant_id, campaign_id, squeeze_page_id, profile_id, device_id, session_id, decision_id, issued_at, expires_at, status, meta_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(code, t, campaign.id, page.id, ctx.profile?.id || null, ctx.device?.id || null, ctx.session?.id || null, decision.decision_id, now, exp, 'issued', JSON.stringify({ variant: page.id, version: page.version, entry: decision.entry || null })).run();
      return { code, expires_at: exp };
    } catch (e) { if (!/UNIQUE|constraint/i.test(String(e.message || e))) throw e; }
  }
  throw new Error('code_collision');
}

export function composeMessage(template, code) { return String(template || 'JOIN {code}').replace(/\{code\}/gi, code); }

/** Beacon from the squeeze page: cta_tap / sms_open. */
export async function recordTap(env, { tenant, code, kind = 'cta_tap' }) {
  const t = tenantOf(tenant);
  const row = await env.DB.prepare('SELECT * FROM traffic_codes WHERE tenant_id=? AND code=?').bind(t, String(code || '').toUpperCase()).first();
  if (!row) return { ok: false, error: 'code_not_found' };
  const k = ['cta_tap', 'sms_open'].includes(kind) ? kind : 'cta_tap';
  const already = safeJson(row.meta_json, {});
  if (already[k]) return { ok: true, deduped: true };
  already[k] = buildNowIso();
  await env.DB.prepare('UPDATE traffic_codes SET meta_json=? WHERE tenant_id=? AND code=?').bind(JSON.stringify(already), t, row.code).run();
  await appendEvent(env, { tenant: t, kind: k, decision_id: row.decision_id, profile_id: row.profile_id, device_id: row.device_id, payload: { code: row.code, campaign_id: row.campaign_id, squeeze_page_id: row.squeeze_page_id } });
  return { ok: true };
}

/** Status the squeeze page polls. Only the browser that was issued the code (same device cookie) learns the next URL. */
export async function codeStatus(env, { tenant, code, deviceId }) {
  const row = await env.DB.prepare('SELECT * FROM traffic_codes WHERE tenant_id=? AND code=?').bind(tenantOf(tenant), String(code || '').toUpperCase()).first();
  if (!row) return { status: 'unknown' };
  if (row.status === 'issued' && row.expires_at < buildNowIso()) return { status: 'expired' };
  const sameDevice = !row.device_id || row.device_id === deviceId;
  const out = { status: row.status, outcome: row.outcome || null };
  if (row.status === 'verified' && sameDevice) { const meta = safeJson(row.meta_json, {}); out.next_url = meta.next_url || null; out.completion = meta.completion || null; }
  return out;
}

export function extractCode(text) {
  const s = String(text || '').toUpperCase();
  const m = /\b(?:JOIN|GO|START|YES|VERIFY)?\s*([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6})\b/.exec(s);
  return m ? m[1] : null;
}

/**
 * Inbound message from Blooio/2chat. Resolves the code, joins the phone to the profile, re-evaluates
 * policy in phase post_sms, records the outcome, replies through SEND_BY_CHANNEL. Returns the outcome
 * and its explanation. Idempotent per code: a second message with the same code re-sends the reply.
 */
export async function handleInbound(env, { tenant, from, text, channel = 'blooio', raw = null, inboundEventId = null, waitUntil = null, sendImpl = null }) {
  const t = tenantOf(tenant);
  const code = extractCode(text);
  const phone = normalizePhone(from);
  if (!code) return { ok: false, ignored: true, reason: 'no_code_in_message' };
  if (!phone) return { ok: false, ignored: true, reason: 'no_sender' };
  const row = await env.DB.prepare('SELECT * FROM traffic_codes WHERE tenant_id=? AND code=?').bind(t, code).first();
  if (!row) { await appendEvent(env, { tenant: t, kind: 'sms_inbound_unmatched', payload: { code, channel } }); return { ok: false, reason: 'code_not_found', code }; }
  const now = buildNowIso();
  const secret = env.TRAFFIC_GRANT_SECRET || env.TERMINAL_KEY || '';
  const phoneHash = await identifierHash(secret, 'phone', phone);
  const campaign = await env.DB.prepare('SELECT * FROM traffic_campaigns WHERE tenant_id=? AND id=?').bind(t, row.campaign_id).first();
  if (!campaign) return { ok: false, reason: 'campaign_missing' };
  const meta = safeJson(row.meta_json, {});
  if (row.status === 'verified') {
    // Same code again: re-send the stored reply, nothing else changes.
    if (meta.reply) await sendReply(env, { campaign, to: phone, text: meta.reply, sendImpl });
    return { ok: true, repeated: true, outcome: row.outcome, code };
  }
  if (row.expires_at < now) {
    await env.DB.prepare("UPDATE traffic_codes SET status='expired' WHERE tenant_id=? AND code=?").bind(t, code).run();
    await appendEvent(env, { tenant: t, kind: 'sms_inbound_expired', decision_id: row.decision_id, profile_id: row.profile_id, device_id: row.device_id, payload: { code } });
    return { ok: false, reason: 'code_expired', code };
  }
  await env.DB.prepare("UPDATE traffic_codes SET status='received', phone_hash=?, phone_masked=?, received_at=?, inbound_event_id=? WHERE tenant_id=? AND code=?").bind(phoneHash, maskIdentifier('phone', phone), now, inboundEventId, t, code).run();
  await appendEvent(env, { tenant: t, kind: 'sms_inbound', decision_id: row.decision_id, profile_id: row.profile_id, device_id: row.device_id, payload: { code, channel, campaign_id: row.campaign_id, squeeze_page_id: row.squeeze_page_id } });
  // 1. identity: the phone is a deterministic identifier → joins (or creates) the canonical profile
  const link = await linkIdentifiers(env, { tenant: t, identifiers: [{ kind: 'phone', value: phone, match_type: 'deterministic', confidence: 1 }], device_id: row.device_id, profile_id: row.profile_id, source: 'sms_verification', secret, actor: 'funnel' });
  const profileId = link.profile_id;
  // 2. re-evaluate policy in phase post_sms with the original visit's signals + the updated profile
  const original = row.decision_id ? await getDecision(env, { tenant: t, decision_id: row.decision_id }) : null;
  const snapshot = await loadSnapshot(env, t, { fresh: true });
  const ruleset = (campaign.ruleset_id && snapshot.rulesets.find((r) => r.id === campaign.ruleset_id)) || (original ? snapshot.rulesets.find((r) => r.id === original.ruleset_id) : null) || pickRuleset(snapshot, { host: 'miscsubjects.com', path: '/go/' + (campaign.entry || ''), entry: campaign.entry || null });
  const reasons = ['SMS verified: code ' + code + ' received from ' + maskIdentifier('phone', phone) + ' via ' + channel, link.merged.length ? 'profile matched an existing profile (merged ' + link.merged.join(',') + ')' : (link.found.length ? 'profile matched existing customer identity' : 'profile ' + profileId + (row.profile_id === profileId ? ' confirmed' : ' created'))];
  let outcomeKey = 'review', decision = null, grant = null, nextUrl = null;
  const memberships = await loadMembershipsFor(env, { tenant: t, profile_id: profileId, device_id: row.device_id, phone_hash: phoneHash });
  if (ruleset && original && original.signals) {
    const ctx = original.signals;
    ctx.request = ctx.request || {}; ctx.request.phase = 'post_sms';
    ctx.profile = Object.assign(ctx.profile || {}, { id: profileId, known: true, identifier_kinds: [...new Set([...(ctx.profile?.identifier_kinds || []), 'phone'])], segments: [], memberships: memberships.list, status: memberships.status, status_source: memberships.source });
    ctx.lists = { allow_match: false, deny_match: false, allow: [], deny: [], kinds: [] }; ctx.experiment = { id: null, variant: null }; ctx.turnstile = ctx.turnstile || { valid: false, skip: false };
    ctx.campaign = { id: campaign.id, name: campaign.name };
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let core;
    try { core = await evaluateContext(ctx, snapshot, ruleset, { nowIso: now, campaign }); } catch (e) { core = null; reasons.push('rule evaluation failed: ' + String(e.message || e)); }
    if (core) {
      decision = await finalizeDecision({ ctx, snapshot, ruleset, core, tenant: t, mode: 'post_sms', t0, nowIso: now, request_id: 'sms:' + code, entry: original.entry, campaign });
      outcomeKey = decision.outcome || (decision.experience === 'DENY' ? 'blocked' : (decision.destination_id && decision.destination_id === campaign.approved_destination ? 'approved' : 'review'));
      for (const m of decision.matched_rules) reasons.push('rule matched: ' + m);
      if (decision.list_matches.length) reasons.push('list matches: ' + decision.list_matches.map((m) => m.list + ':' + m.id).join(', '));
      if (!decision.matched_rules.length) reasons.push('no rule matched in phase post_sms → outcome ' + outcomeKey);
      reasons.push('profile status ' + memberships.status + (memberships.source ? ' (from ' + memberships.source + ')' : ''));
      if (waitUntil) waitUntil(persistDecision(env, decision).catch(() => {})); else await persistDecision(env, decision).catch(() => {});
    }
  } else reasons.push(ruleset ? 'original decision signals unavailable → review' : 'no ruleset for campaign → review');
  const policy = safeJson(campaign.access_policy_json, {});
  let outcome, replyText;
  if (outcomeKey === 'approved') {
    outcome = 'VERIFIED_AND_APPROVED';
    const destId = campaign.approved_destination;
    const dest = destId ? snapshot.destinations[destId] : null;
    if (!dest) { outcome = 'VERIFIED_REVIEW_REQUIRED'; reasons.push('approved destination missing → held'); }
    else {
      const aud = dest.url ? new URL(dest.url).hostname : 'miscsubjects.com';
      const g = await issueGrant(secret, { tenant: t, aud, dest: destId, sub: profileId, dev: row.device_id, rev: ruleset?.revision ?? null, dec: decision?.decision_id || row.decision_id, ttl_s: policy.grant_ttl_s || dest.grant_ttl_s || 900, one_time: policy.one_time !== false, reason: 'sms_verified:' + code });
      await recordGrant(env, { tenant: t, payload: g.payload, reason: 'sms_verified', decision_id: decision?.decision_id || row.decision_id });
      grant = g.payload; nextUrl = `https://miscsubjects.com/go/_/enter?g=${encodeURIComponent(g.token)}`;
      reasons.push('access grant ' + g.payload.jti + ' issued for ' + destId + ' (ttl ' + (g.payload.exp - g.payload.iat) + 's, ' + (g.payload.ot ? 'one-time' : 'reusable') + ')');
      if (row.device_id && policy.trust_device_days !== 0) {
        const days = Number(policy.trust_device_days) || 30;
        const until = buildNowIso(Date.now() + days * 86400 * 1000);
        await env.DB.prepare('UPDATE traffic_devices SET trusted=1, revoked_at=NULL, trust_reason=?, trust_expires_at=? WHERE tenant_id=? AND id=?').bind('sms_verified:' + code, until, t, row.device_id).run();
        if (policy.max_trusted_devices) {
          const extra = (await env.DB.prepare('SELECT id FROM traffic_devices WHERE tenant_id=? AND profile_id=? AND trusted=1 ORDER BY last_seen DESC').bind(t, profileId).all()).results || [];
          for (const d of extra.slice(Number(policy.max_trusted_devices))) await env.DB.prepare("UPDATE traffic_devices SET trusted=0, revoked_at=?, trust_reason='max_trusted_devices' WHERE tenant_id=? AND id=?").bind(now, t, d.id).run();
        }
        reasons.push('first-party device trust created for ' + days + ' days');
      }
      await upsertMembership(env, { tenant: t, subject_kind: 'profile', subject_value: profileId, status: 'approved', population: 'sms_verified', source: 'sms_verification', provenance: { code, phone: maskIdentifier('phone', phone), decision_id: decision?.decision_id || null, rules: decision?.matched_rules || [] }, confidence: 0.9, actor: 'funnel' });
      replyText = fill(campaign.sms_reply_approved || 'You are verified. Continue here: {link}', { link: nextUrl, code });
    }
  }
  if (outcomeKey === 'blocked') {
    outcome = 'VERIFIED_BUT_BLOCKED';
    reasons.push('protected progression denied; messaging contact retained');
    await upsertMembership(env, { tenant: t, subject_kind: 'profile', subject_value: profileId, status: 'blocked', population: 'rule', source: 'post_sms_policy', provenance: { code, decision_id: decision?.decision_id || null, rules: decision?.matched_rules || [] }, confidence: 0.8, actor: 'funnel' });
    replyText = fill(campaign.sms_reply_blocked || 'Thanks — you are on the list. We will be in touch.', { code });
    const bd = campaign.blocked_destination && snapshot.destinations[campaign.blocked_destination];
    if (bd && bd.type === 'redirect' && bd.url) nextUrl = bd.url; else if (bd) nextUrl = `https://miscsubjects.com/go/_/dest/${encodeURIComponent(bd.id)}`;
  }
  if (!outcome) {
    outcome = 'VERIFIED_REVIEW_REQUIRED';
    await upsertMembership(env, { tenant: t, subject_kind: 'profile', subject_value: profileId, status: 'review', population: 'sms_verified', source: 'post_sms_policy', provenance: { code, decision_id: decision?.decision_id || null }, confidence: 0.5, actor: 'funnel' });
    replyText = fill(campaign.sms_reply_review || 'Thanks — we received your message and will follow up shortly.', { code });
    const rd = campaign.review_destination && snapshot.destinations[campaign.review_destination];
    if (rd) nextUrl = rd.type === 'redirect' && rd.url ? rd.url : `https://miscsubjects.com/go/_/dest/${encodeURIComponent(rd.id)}`;
  }
  const completion = { outcome, reasons };
  await env.DB.prepare("UPDATE traffic_codes SET status='verified', verified_at=?, outcome=?, outcome_decision_id=?, progression_grant_jti=?, profile_id=?, meta_json=? WHERE tenant_id=? AND code=?")
    .bind(now, outcome, decision?.decision_id || null, grant?.jti || null, profileId, JSON.stringify({ ...meta, next_url: nextUrl, completion, reply: replyText }), t, code).run();
  await appendEvent(env, { tenant: t, kind: 'verified', decision_id: decision?.decision_id || row.decision_id, profile_id: profileId, device_id: row.device_id, payload: { code, campaign_id: campaign.id, squeeze_page_id: row.squeeze_page_id, outcome } });
  await appendEvent(env, { tenant: t, kind: outcome === 'VERIFIED_AND_APPROVED' ? 'progressed' : outcome === 'VERIFIED_BUT_BLOCKED' ? 'blocked_completion' : 'review_hold', decision_id: decision?.decision_id || row.decision_id, profile_id: profileId, device_id: row.device_id, destination_id: outcome === 'VERIFIED_AND_APPROVED' ? campaign.approved_destination : (outcome === 'VERIFIED_BUT_BLOCKED' ? campaign.blocked_destination : campaign.review_destination), payload: { code, campaign_id: campaign.id, squeeze_page_id: row.squeeze_page_id, grant_jti: grant?.jti || null } });
  const sent = await sendReply(env, { campaign, to: phone, text: replyText, sendImpl });
  await ledger(env, { key: 'TRAFFIC_SMS_OUTCOME', action: outcome, actor: 'funnel', route: '/api/traffic/sms/inbound', trace_id: decision?.decision_id || row.decision_id, request: { code, campaign: campaign.id, phone: maskIdentifier('phone', phone), channel }, response: { outcome, reasons, grant: grant?.jti || null, reply_sent: sent } });
  return { ok: true, outcome, code, profile_id: profileId, decision_id: decision?.decision_id || null, grant_jti: grant?.jti || null, next_url: nextUrl, reasons, reply: replyText, reply_sent: sent };
}

function fill(t, vars) { return String(t || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k]))); }

async function sendReply(env, { campaign, to, text, sendImpl }) {
  if (!text) return { skipped: 'no_reply_text' };
  if (sendImpl) return sendImpl({ to, text, channel: campaign.sms_channel || 'blooio' });
  try {
    const r = await fetch('https://miscsubjects.com/api/dispatch', { method: 'POST', headers: { 'content-type': 'application/json', 'x-terminal-key': String(env.TERMINAL_KEY || '') }, body: JSON.stringify({ key: 'SEND_BY_CHANNEL', body: `${campaign.sms_channel || 'blooio'}|${to}|${String(text).replace(/\|/g, '/')}` }) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok && j.ok !== false, status: r.status, receipt: j.proof?.public_receipt || null, result: String(j.result || '').slice(0, 200) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

export async function loadMembershipsFor(env, { tenant, profile_id, device_id, phone_hash, visitor_hash = null, precedence = null }) {
  const t = tenantOf(tenant);
  const rows = (await env.DB.prepare("SELECT * FROM traffic_memberships WHERE tenant_id=? AND superseded_at IS NULL AND ((subject_kind='profile' AND subject_value=?) OR (subject_kind='device' AND subject_value=?) OR (subject_kind='phone_hash' AND subject_value=?) OR (subject_kind='visitor_hash' AND subject_value=?))")
    .bind(t, profile_id || '', device_id || '', phone_hash || '', visitor_hash || '').all()).results || [];
  return effectiveStatus(rows, precedence);
}

export const DEFAULT_PRECEDENCE = ['manual', 'sms_verified', 'customer', 'trusted_device', 'rule', 'behavior', 'external', 'approved_history', 'blocked_history'];

/** Effective status from memberships by population precedence. Mixed statuses in the deciding population → review. */
export function effectiveStatus(rows, precedence = null) {
  const order = Array.isArray(precedence) && precedence.length ? precedence : DEFAULT_PRECEDENCE;
  const list = rows.map((r) => ({ id: r.id, population: r.population, status: r.effective_status || r.status, subject_kind: r.subject_kind, source: r.source, confidence: r.confidence }));
  for (const pop of order) {
    const here = list.filter((m) => m.population === pop || (pop === 'approved_history' && m.population === 'blocked_history' && false));
    if (!here.length) continue;
    const statuses = new Set(here.map((m) => m.status));
    if (statuses.size === 1) return { status: [...statuses][0], source: pop, list };
    return { status: 'review', source: pop + ':mixed', list };
  }
  // historical populations: approved_history and blocked_history are one pair
  return { status: 'unknown', source: null, list };
}
