// THE CAPABILITY MARKET — rights, pay-to-token, leases over scarce resources, claims and their
// verification, wants → mandates → offers → agreements, settlement terms, quotes.
//
// Every operation here is a Directory row (type fn) that receives the raw body and returns a JSON
// string, so every one inherits the six invocation surfaces. Nothing here holds a credential; a
// buyer or a lessee receives a capability token bound to their profile, never a cookie or a key.
// Nothing reports ok when the durable write or the ledger write failed.
import { identifierHash, ensureProfile, recordProfileEvent } from './identity_fns.js';
import { bindContext } from './capability_context.js';
import { createTask } from './work_object.js';

const ORIGIN = 'https://miscsubjects.com';
const DAY = 86400;

function err(code, message, extra = {}) { return 'ERR:' + code + ' ' + JSON.stringify({ ok: false, error: code, message: String(message || code), ...extra }); }
function ok(o) { return JSON.stringify({ ok: true, ...o }); }
function newId(prefix) { const b = crypto.getRandomValues(new Uint8Array(8)); return prefix + '_' + [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); }
const enc = new TextEncoder();
async function sha256Hex(s) { const d = await crypto.subtle.digest('SHA-256', enc.encode(String(s))); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function identifierSecret(env) { return env.TRAFFIC_GRANT_SECRET || env.ADMIN_SESSION_SECRET || env.TERMINAL_KEY || ''; }
function normPhone(p) { const d = String(p || '').replace(/\D/g, ''); if (!d) return ''; return '+' + (d.length === 10 ? '1' + d : d); }
function maskPhone(p) { const d = String(p || '').replace(/\D/g, ''); return d ? '***' + d.slice(-4) : null; }
function maskEmail(e) { const s = String(e || ''); const i = s.indexOf('@'); return i > 0 ? s[0] + '***' + s.slice(i) : null; }
function isOwnerCall(env) { const a = env?.TRACE_CTX?.authContext; return !!(a && a.ownerAuthed); }
function actorOf(env) { return env?.TRACE_CTX?.actor || (isOwnerCall(env) ? 'owner' : 'unknown'); }

/** `a|b|c` positional fields or a JSON object. The LAST named field swallows the rest (pipes kept). */
export function parseFields(raw, names) {
  const s = raw == null ? '' : String(raw);
  if (s.trim().startsWith('{')) { try { return JSON.parse(s); } catch { return { _bad_json: true }; } }
  const parts = s.split('|');
  const out = {};
  names.forEach((n, i) => {
    if (i === names.length - 1) out[n] = parts.slice(i).join('|').trim();
    else out[n] = (parts[i] ?? '').trim();
  });
  return out;
}
function j(v, d) { if (v == null || v === '') return d; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return String(v).split(',').map((x) => x.trim()).filter(Boolean); } }
function cents(v) { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) : 0; }
function ttlForMeter(meter) {
  const m = String(meter || '').toLowerCase();
  if (/minute/.test(m)) return 3600;                 // a minute-metered row: the token lives an hour
  if (/hour/.test(m)) return DAY;
  if (/day/.test(m)) return 7 * DAY;
  if (/month/.test(m)) return 31 * DAY;
  return 30 * DAY;                                   // per-call meters: a month to spend the uses
}

// ── methodologies: the versioned definitions VERIFY_CLAIM executes ─────────────────────────
// Each recompute reads the recorded receipts (invocation_json.result) named by the claim and
// returns the number the methodology defines. The claim is verified when the recompute matches.
function num(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }
function pick(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function parseLoose(r) {
  if (r == null) return null;
  if (typeof r !== 'string') return r;
  const s = r.replace(/^HTTP \d+:/, '').trim();
  try { return JSON.parse(s); } catch { return { _raw: r, _truncated: true }; }
}
// The receipt row stores an output preview; the full response lives on the ledger event it names.
// Read the preview first, and when it does not parse whole, read the event's full response.
function receiptResult(rec, fullResponse = null) {
  try {
    const inv = JSON.parse(rec.invocation_json || '{}');
    const preview = parseLoose(inv.result ?? inv.response ?? inv.output ?? inv.output_preview);
    if (preview && !preview._truncated) return preview;
    if (fullResponse) { const full = parseLoose(fullResponse); if (full && !full._truncated) return full; }
    return preview;
  } catch { return null; }
}
async function loadReceipts(env, ids, getInvocation) {
  const recs = [];
  for (const id of ids) {
    const r = await getInvocation(env, id); if (!r) return { missing: id };
    let full = null;
    try { if (r.event_id) { const ev = await env.LEDGER.prepare('SELECT response_json FROM events WHERE id = ?').bind(r.event_id).first(); full = ev?.response_json || null; } } catch {}
    recs.push({ ...r, _full: full });
  }
  return { recs };
}
function insightsTotals(result) {
  // Meta insights shape: {ok, data:[{spend, clicks, impressions, ...}]} or {data:[...]}; sum the rows.
  const rows = Array.isArray(result?.data) ? result.data : Array.isArray(result?.data?.data) ? result.data.data : Array.isArray(result?.insights?.data) ? result.insights.data : Array.isArray(result) ? result : [];
  let spend = 0, clicks = 0, impressions = 0, n = 0;
  for (const r of rows) { spend += num(r.spend) || 0; clicks += num(r.clicks) || 0; impressions += num(r.impressions) || 0; n++; }
  return { rows: n, spend, clicks, impressions };
}
function chargesTotal(result) {
  const rows = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
  let cents_ = 0, n = 0;
  for (const c of rows) { if (c && (c.paid === true || c.status === 'succeeded') && !c.refunded) { cents_ += num(c.amount) || 0; n++; } }
  return { charges: n, revenue: cents_ / 100 };
}
export const METHODOLOGIES = {
  CPC_DELTA_V1: {
    version: 1,
    statement: 'percentage change in cost per click between a baseline window and a test window, from Meta insights receipts',
    evidence: ['META_ADS_INSIGHTS receipt for the baseline window (spend, clicks)', 'META_ADS_INSIGHTS receipt for the test window (spend, clicks)'],
    exclusions: 'rows with zero clicks are excluded from a window; a window with zero clicks overall makes the claim EVIDENCE_MISSING',
    grade_ceiling: 'method-reproducible; a causal grade needs a declared control in the commitment',
    compute(receipts) {
      const [base, test] = receipts;
      const b = insightsTotals(receiptResult(base, base._full)); const t = insightsTotals(receiptResult(test, test._full));
      if (!b.clicks || !t.clicks) return { error: 'EVIDENCE_MISSING', detail: 'a window has no clicks', baseline: b, test: t };
      const bc = b.spend / b.clicks, tc = t.spend / t.clicks;
      return { baseline_cpc: +bc.toFixed(4), test_cpc: +tc.toFixed(4), delta_pct: +(((tc - bc) / bc) * 100).toFixed(2), baseline: b, test: t };
    },
    compare(a, b) { return a && b && a.delta_pct != null && b.delta_pct != null && Math.abs(a.delta_pct - b.delta_pct) <= 0.5; },
  },
  ROAS_V1: {
    version: 1,
    statement: 'revenue divided by ad spend over one window: Stripe succeeded charges (revenue) over Meta insights spend',
    evidence: ['META_ADS_INSIGHTS receipt for the window (spend)', 'STRIPE_CHARGES_LIST receipt for the same window (succeeded, unrefunded charges)'],
    exclusions: 'refunded charges excluded; a window with zero spend makes the claim EVIDENCE_MISSING',
    grade_ceiling: 'method-reproducible; attribution of revenue to spend is not claimed',
    compute(receipts) {
      const [meta, stripe] = receipts;
      const m = insightsTotals(receiptResult(meta, meta._full)); const s = chargesTotal(receiptResult(stripe, stripe._full));
      if (!m.spend) return { error: 'EVIDENCE_MISSING', detail: 'no spend in the window', spend: m, revenue: s };
      return { spend: +m.spend.toFixed(2), revenue: +s.revenue.toFixed(2), roas: +(s.revenue / m.spend).toFixed(4), charges: s.charges };
    },
    compare(a, b) { return a && b && a.roas != null && b.roas != null && Math.abs(a.roas - b.roas) <= 0.005; },
  },
};
export const EVIDENCE_GRADES = ['self-attested', 'execution-receipted', 'source-authenticated', 'method-reproducible', 'causally-supported', 'privacy-preserving'];

export function makeMarketFnMap(deps) {
  const { dispatch, mintCapability, loadDirectory, logEvent, buildNowIso, getInvocation, getCapabilityByFingerprint, revokeCapability, sendBlooio } = deps;
  const now = () => buildNowIso();
  async function ledger(env, key, action, request, response, status = 200) {
    try { return await logEvent(env, { source: 'market', key, action, direction: 'out', status, actor: actorOf(env), request, response }); } catch { return null; }
  }
  async function rightsRow(env, key) { return env.DB.prepare('SELECT * FROM market_rights WHERE row_key = ?').bind(key).first().catch(() => null); }
  async function dirRow(env, key) { const dir = await loadDirectory(env); return dir[key] || null; }

  // A phone or email → the profile it belongs to (created if new). Never stores the raw value.
  async function profileForIdentifier(env, kind, value, source) {
    const secret = identifierSecret(env); if (!secret) throw new Error('no identifier secret bound');
    const v = kind === 'phone' ? normPhone(value) : String(value).trim().toLowerCase();
    const hash = await identifierHash(secret, kind, v);
    const hit = await env.DB.prepare('SELECT profile_id FROM traffic_identifiers WHERE kind = ? AND value_hash = ? AND active = 1').bind(kind, hash).first();
    if (hit) return { profile_id: hit.profile_id, created: false };
    const { profile } = await ensureProfile(env, { kind: 'human', display: kind === 'phone' ? maskPhone(v) : maskEmail(v), attrs: { origin: source || 'market' }, tags: ['buyer'] });
    const t = now();
    await env.DB.prepare(
      `INSERT INTO traffic_identifiers (id, tenant_id, profile_id, kind, value_hash, value_masked, match_type, match_method, confidence, source, first_seen, last_seen, active, provenance_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?) ON CONFLICT(profile_id, kind, value_hash) DO UPDATE SET last_seen = excluded.last_seen, active = 1`,
    ).bind(newId('idn'), 't_root', profile.id, kind, hash, kind === 'phone' ? maskPhone(v) : maskEmail(v), 'deterministic', 'declared', 1.0, source || 'market', t, t, JSON.stringify({ by: 'market', at: t })).run();
    await env.DB.prepare('UPDATE traffic_profiles SET known = 1, updated_at = ?, version = version + 1 WHERE id = ?').bind(t, profile.id).run();
    return { profile_id: profile.id, created: true };
  }

  // Live paid capabilities held by a profile: bound by context, unexpired, unrevoked, uses left.
  async function paidCapabilitiesFor(env, profile_id) {
    const rows = (await env.LEDGER.prepare(
      `SELECT c.fingerprint, c.row_key, c.scope, c.max_uses, c.uses_consumed, c.expires_at, c.purpose, c.nonce
       FROM capability_contexts x JOIN capabilities c ON c.fingerprint = x.fingerprint
       WHERE x.profile_id = ? AND c.revoked = 0 AND c.purpose LIKE 'paid:%' AND c.expires_at > ?
       ORDER BY c.ts DESC LIMIT 20`,
    ).bind(profile_id, now()).all()).results || [];
    return rows.filter((c) => !c.max_uses || Number(c.uses_consumed || 0) < Number(c.max_uses));
  }

  const MAP = {
    // ── RIGHTS ────────────────────────────────────────────────────────────────────────────
    // RIGHTS_SET — row_key|entitlement_source|resale_allowed|read_only|platform_terms_version|expires_at|purpose|region
    async rightsSet(env, raw) {
      if (!isOwnerCall(env)) return err('OWNER_ONLY', 'only the owner records the right to sell a row');
      const b = parseFields(raw, ['row_key', 'entitlement_source', 'resale_allowed', 'read_only', 'platform_terms_version', 'expires_at', 'purpose', 'region']);
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const key = String(b.row_key || '').trim(); if (!key) return err('BAD_REQUEST', 'row_key required');
      if (!(await dirRow(env, key))) return err('UNKNOWN_KEY', `no directory row ${key}`);
      if (!b.entitlement_source) return err('BAD_REQUEST', 'entitlement_source required: what the owner holds that makes this row sellable');
      const resale = /^(1|true|yes)$/i.test(String(b.resale_allowed ?? '1')) ? 1 : 0;
      const readOnly = /^(1|true|yes)$/i.test(String(b.read_only ?? '1')) ? 1 : 0;
      const t = now();
      try {
        await env.DB.prepare(
          `INSERT INTO market_rights (row_key, entitlement_source, owner, delegation_allowed, resale_allowed, read_only, approved_users_json, region, purpose, platform_terms_version, rate_limit, expires_at, revocation_source, created_at, updated_at, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(row_key) DO UPDATE SET entitlement_source = excluded.entitlement_source, resale_allowed = excluded.resale_allowed, read_only = excluded.read_only, platform_terms_version = excluded.platform_terms_version, expires_at = excluded.expires_at, purpose = excluded.purpose, region = excluded.region, updated_at = excluded.updated_at`,
        ).bind(key, String(b.entitlement_source), 'owner', 1, resale, readOnly, JSON.stringify(j(b.approved_users, [])), b.region || null, b.purpose || null, b.platform_terms_version || null, b.rate_limit || null, b.expires_at || null, 'owner', t, t, actorOf(env)).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'RIGHTS_SET', 'rights_recorded', { row_key: key, entitlement_source: b.entitlement_source, resale_allowed: resale, read_only: readOnly }, { ok: true });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'rights recorded but the ledger refused the receipt');
      return ok({ row_key: key, resale_allowed: resale, read_only: readOnly, ledger_event_id: ev });
    },
    async rightsGet(env, raw) {
      const key = String(parseFields(raw, ['row_key']).row_key || '').trim();
      const r = await rightsRow(env, key);
      if (!r) return err('RIGHTS_MISSING', `no rights record for ${key}; the row cannot be sold until the owner records its entitlement with RIGHTS_SET`, { row_key: key });
      return ok({ rights: r });
    },

    // ── PRICE, QUOTE, PAYMENT LINK ────────────────────────────────────────────────────────
    // QUOTE — row_key|units|resource_id? : the priced answer to a specific request, risk separate from usage.
    async quoteGet(env, raw) {
      const b = parseFields(raw, ['row_key', 'units', 'resource_id']);
      const key = String(b.row_key || '').trim(); const units = Math.max(1, Number(b.units) || 1);
      const row = await dirRow(env, key); if (!row) return err('UNKNOWN_KEY', `no directory row ${key}`);
      const rights = await rightsRow(env, key); if (!rights) return err('RIGHTS_MISSING', `no rights record for ${key}`, { row_key: key });
      if (!rights.resale_allowed) return err('RESALE_NOT_ALLOWED', `${key} may not be resold under its entitlement`, { row_key: key });
      const unit = cents(row.price_usd); if (!unit) return err('PRICE_MISSING', `${key} has no price_usd; set it on the row`, { row_key: key });
      let resource = null, collateral = 0, risk = 0;
      if (b.resource_id) {
        resource = await env.DB.prepare('SELECT * FROM market_resources WHERE id = ?').bind(String(b.resource_id)).first();
        if (!resource) return err('RESOURCE_NOT_FOUND', `no resource ${b.resource_id}`);
        collateral = Number(resource.collateral_cents || 0); risk = Number(resource.risk_premium_cents || 0);
      }
      const marginal = unit * units;
      const settlement = Math.round(marginal * 0.029 + 30);          // the card rail's own fee shape, stated not hidden
      const verifier = 0;                                              // verification is a separate priced row
      const total = marginal + settlement + risk;
      const q = { id: newId('qt'), row_key: key, units, resource_id: resource?.id || null, marginal_cents: marginal, capacity_cents: 0, verifier_cents: verifier, settlement_cents: settlement, risk_premium_cents: risk, collateral_cents: collateral, total_cents: total, currency: 'usd', meter_unit: row.meter_unit || 'call', expires_at: buildNowIso(Date.now() + 15 * 60 * 1000), created_at: now() };
      try {
        await env.DB.prepare('INSERT INTO market_quotes (id, row_key, resource_id, profile_id, marginal_cents, capacity_cents, verifier_cents, settlement_cents, risk_premium_cents, collateral_cents, total_cents, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(q.id, key, q.resource_id, null, marginal, 0, verifier, settlement, risk, collateral, total, q.expires_at, q.created_at).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      return ok({ quote: q, pay: `POST /api/dispatch {"key":"PAY_LINK","body":"${key}|${units}"} (owner) → a payment link; or a PAID_GRANT by the owner` });
    },

    async payLink(env, raw) {
      if (!isOwnerCall(env)) return err('OWNER_ONLY', 'payment links are created by the owner');
      const b = parseFields(raw, ['row_key', 'units', 'confirm']);
      const key = String(b.row_key || '').trim(); const units = Math.max(1, Number(b.units) || 1);
      const row = await dirRow(env, key); if (!row) return err('UNKNOWN_KEY', `no directory row ${key}`);
      const rights = await rightsRow(env, key); if (!rights) return err('RIGHTS_MISSING', `no rights record for ${key}; record the entitlement with RIGHTS_SET first`, { row_key: key });
      if (!rights.resale_allowed) return err('RESALE_NOT_ALLOWED', `${key} may not be resold under its entitlement`, { row_key: key });
      const unit = cents(row.price_usd); if (!unit) return err('PRICE_MISSING', `${key} has no price_usd`, { row_key: key });
      if (!/^go ahead/i.test(String(b.confirm || ''))) return err('STRIPE_WRITE_GATED', 'a Stripe write needs the owner\'s go-ahead phrase in the third field: "go ahead and create the payment link"', { law: 'LAW_002' });
      if (!env.STRIPE_SECRET_KEY) return err('STRIPE_KEY_MISSING', 'no STRIPE_SECRET_KEY bound');
      const existing = await env.DB.prepare('SELECT * FROM market_pay_links WHERE row_key = ? AND units = ? AND active = 1').bind(key, units).first().catch(() => null);
      if (existing) return ok({ pay_link: existing, reused: true });
      const auth = { Authorization: 'Basic ' + btoa(String(env.STRIPE_SECRET_KEY) + ':'), 'Content-Type': 'application/x-www-form-urlencoded' };
      const post = async (path, form) => { const r = await fetch('https://api.stripe.com/v1/' + path, { method: 'POST', headers: auth, body: new URLSearchParams(form).toString() }); const t = await r.text(); let jn; try { jn = JSON.parse(t); } catch { jn = { raw: t }; } return { status: r.status, body: jn }; };
      const product = await post('products', { name: `${key} × ${units} (${row.meter_unit || 'call'})`, description: `Metered use of the capability ${key} on miscsubjects.com. ${units} ${row.meter_unit || 'call'}(s). A token arrives by text after payment.`, 'metadata[row_key]': key, 'metadata[units]': String(units) });
      if (product.status !== 200) return err('STRIPE_PRODUCT_FAILED', JSON.stringify(product.body).slice(0, 300));
      const price = await post('prices', { product: product.body.id, unit_amount: String(unit), currency: 'usd' });
      if (price.status !== 200) return err('STRIPE_PRICE_FAILED', JSON.stringify(price.body).slice(0, 300));
      const link = await post('payment_links', { 'line_items[0][price]': price.body.id, 'line_items[0][quantity]': String(units), 'phone_number_collection[enabled]': 'true', 'metadata[row_key]': key, 'metadata[units]': String(units), 'after_completion[type]': 'hosted_confirmation', 'after_completion[hosted_confirmation][custom_message]': `Paid. Your token for ${key} arrives by text at the number you gave, within a minute. Text the build's number with what you want run.` });
      if (link.status !== 200) return err('STRIPE_LINK_FAILED', JSON.stringify(link.body).slice(0, 300));
      const rec = { id: link.body.id, row_key: key, units, unit_amount_cents: unit, currency: 'usd', price_id: price.body.id, product_id: product.body.id, url: link.body.url, created_at: now(), active: 1 };
      try { await env.DB.prepare('INSERT INTO market_pay_links (id, row_key, units, unit_amount_cents, currency, price_id, product_id, url, created_at, active) VALUES (?,?,?,?,?,?,?,?,?,1)').bind(rec.id, key, units, unit, 'usd', rec.price_id, rec.product_id, rec.url, rec.created_at).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message, { stripe_link: rec.url }); }
      const ev = await ledger(env, 'PAY_LINK', 'payment_link_created', { row_key: key, units, unit_amount_cents: unit }, { id: rec.id, url: rec.url });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'payment link created but the ledger refused the receipt', { url: rec.url });
      return ok({ pay_link: rec, ledger_event_id: ev });
    },

    async paidGrant(env, raw) {
      const b = parseFields(raw, ['row_key', 'units', 'buyer_phone', 'buyer_email', 'source_id', 'amount_cents']);
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const internal = env?.TRACE_CTX?.actor === 'stripe:webhook';
      if (!internal && !isOwnerCall(env)) return err('OWNER_ONLY', 'a grant is minted by a verified payment or by the owner, never by the buyer');
      const key = String(b.row_key || '').trim(); const units = Math.max(1, Number(b.units) || 1);
      const row = await dirRow(env, key); if (!row) return err('UNKNOWN_KEY', `no directory row ${key}`);
      const rights = await rightsRow(env, key); if (!rights) return err('RIGHTS_MISSING', `no rights record for ${key}`, { row_key: key });
      if (!rights.resale_allowed) return err('RESALE_NOT_ALLOWED', `${key} may not be resold`, { row_key: key });
      const phone = normPhone(b.buyer_phone); const email = String(b.buyer_email || '').trim().toLowerCase();
      if (!phone && !email) return err('BAD_REQUEST', 'buyer_phone or buyer_email required');
      const sourceId = String(b.source_id || '').trim() || ('comped_' + newId('g'));
      const prior = await env.DB.prepare('SELECT * FROM market_sales WHERE source_id = ?').bind(sourceId).first().catch(() => null);
      if (prior) return ok({ sale: prior, already_granted: true, note: 'this payment was already granted; nothing was minted twice' });
      let prof; try { prof = await profileForIdentifier(env, phone ? 'phone' : 'email', phone || email, 'market:' + (internal ? 'stripe' : 'owner')); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ttl = ttlForMeter(row.meter_unit);
      const minted = await mintCapability(env, ORIGIN, { scope: 'row', key, ttl, uses: units, purpose: 'paid:' + sourceId, actor: 'buyer:' + prof.profile_id, risk_ceiling: 'low', owner_gate: rights.read_only ? '0' : '1', mint_actor: internal ? 'stripe:webhook' : 'owner' });
      if (!minted || minted.error) return err('MINT_FAILED', minted?.note || minted?.error || 'mint failed');
      try { await bindContext(env, minted.fingerprint, { profile_id: prof.profile_id, actor_kind: 'human' }, { by: internal ? 'stripe:webhook' : 'owner' }); } catch (e) { await revokeCapability(env, minted.fingerprint).catch(() => {}); return err('DURABLE_WRITE_FAILED', 'context bind failed; token revoked: ' + e.message); }
      const saleId = newId('sale'); const t = now();
      const amount = Number(b.amount_cents) || 0;
      const reversibleUntil = amount ? buildNowIso(Date.now() + 120 * DAY * 1000) : null;   // a card payment is disputable for 120 days
      try {
        await env.DB.prepare(
          `INSERT INTO market_sales (id, source_id, stripe_session_id, payment_link_id, row_key, units, amount_cents, currency, buyer_phone_masked, buyer_email_masked, profile_id, fingerprint, token_delivered_via, delivered_at, finality_state, reversible_until, dispute_window_days, fees_cents, payout_date, refund_status, created_at, raw_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).bind(saleId, sourceId, b.stripe_session_id || null, b.payment_link_id || null, key, units, amount, 'usd', maskPhone(phone), maskEmail(email), prof.profile_id, minted.fingerprint, null, null, amount ? 'settled_reversible' : 'comped', reversibleUntil, amount ? 120 : 0, amount ? Math.round(amount * 0.029 + 30) : 0, null, 'none', t, JSON.stringify({ source: internal ? 'stripe' : 'owner', units, meter_unit: row.meter_unit || null })).run();
        await env.DB.prepare('INSERT INTO market_settlements (id, kind, ref_id, rail, amount_cents, fees_cents, currency, finality_state, reversible_until, dispute_window_days, chargeback_reserve_cents, refund_policy, tax_treatment, payout_date, state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(newId('stl'), 'sale', saleId, amount ? 'stripe' : 'comped', amount, amount ? Math.round(amount * 0.029 + 30) : 0, 'usd', amount ? 'settled_reversible' : 'final', reversibleUntil, amount ? 120 : 0, amount ? Math.round(amount * 0.1) : 0, 'refund on a refused acceptance or a lost dispute', 'sales tax not collected', null, 'recorded', t, t).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message, { fingerprint: minted.fingerprint }); }
      // Deliver by the channel the buyer paid from. Text first; email is gated by the mail law for strangers.
      const tokenUrl = minted.short_url || (ORIGIN + '/api/dispatch?share=' + encodeURIComponent(minted.token || ''));
      const msg = `Your ${key} token (${units} ${row.meter_unit || 'use'}${units === 1 ? '' : 's'}): ${tokenUrl}\nText this number with what you want ${key} to do and it runs under that token. Every run has a public receipt.\nExample: ${(row.examples && JSON.parse(row.examples || '[]')[0]) || 'your request in plain words'}`;
      let via = null, deliveryError = null;
      if (phone) { try { const s = await sendBlooio(env, phone, msg); via = s && !String(s).startsWith('ERR') ? 'blooio_text' : null; if (!via) deliveryError = String(s).slice(0, 200); } catch (e) { deliveryError = e.message; } }
      if (!via && email) { deliveryError = (deliveryError ? deliveryError + '; ' : '') + 'email delivery to a stranger is gated by the mail law; the token is on the sale record for the owner to forward'; }
      if (via) await env.DB.prepare('UPDATE market_sales SET token_delivered_via = ?, delivered_at = ? WHERE id = ?').bind(via, now(), saleId).run().catch(() => {});
      await recordProfileEvent(env, { profile_id: prof.profile_id, event_type: 'CAPABILITY_PURCHASED', payload: { row_key: key, units, amount_cents: amount, sale_id: saleId }, source: 'market' }).catch(() => {});
      const ev = await ledger(env, 'PAID_GRANT', 'paid_capability_minted', { row_key: key, units, source_id: sourceId, profile_id: prof.profile_id, amount_cents: amount }, { sale_id: saleId, fingerprint: minted.fingerprint, delivered_via: via, delivery_error: deliveryError });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'grant minted but the ledger refused the receipt', { sale_id: saleId });
      return ok({ sale_id: saleId, profile_id: prof.profile_id, fingerprint: minted.fingerprint, token_url: tokenUrl, expires_at: minted.expires_at, uses: units, delivered_via: via, delivery_error: deliveryError, ledger_event_id: ev });
    },

    // PAID_LANE_LOOKUP — phone : what a sender may run. Used by the messaging pre-route.
    async paidLaneLookup(env, raw) {
      const phone = normPhone(parseFields(raw, ['phone']).phone);
      if (!phone) return err('BAD_REQUEST', 'phone required');
      const secret = identifierSecret(env); const hash = await identifierHash(secret, 'phone', phone);
      const hit = await env.DB.prepare('SELECT profile_id FROM traffic_identifiers WHERE kind = ? AND value_hash = ? AND active = 1').bind('phone', hash).first();
      if (!hit) return ok({ profile_id: null, capabilities: [] });
      const caps = await paidCapabilitiesFor(env, hit.profile_id);
      return ok({ profile_id: hit.profile_id, capabilities: caps.map((c) => ({ fingerprint: c.fingerprint, row_key: c.row_key, uses_left: c.max_uses ? c.max_uses - Number(c.uses_consumed || 0) : 'unlimited', expires_at: c.expires_at })) });
    },

    // ── RESOURCES AND LEASES ──────────────────────────────────────────────────────────────
    // RESOURCE_NEW — kind|label|snapshot_key|snapshot_body|snapshot_fields|collateral_usd|risk_premium_usd
    async resourceNew(env, raw) {
      if (!isOwnerCall(env)) return err('OWNER_ONLY', 'resources are declared by their owner');
      const b = parseFields(raw, ['kind', 'label', 'snapshot_key', 'snapshot_body', 'snapshot_fields', 'collateral_usd', 'risk_premium_usd']);
      if (!b.kind || !b.label) return err('BAD_REQUEST', 'kind and label required');
      const id = newId('res'); const t = now();
      try {
        await env.DB.prepare('INSERT INTO market_resources (id, kind, label, owner_profile_id, state, snapshot_key, snapshot_body, snapshot_fields_json, collateral_cents, risk_premium_cents, quarantine_reason, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(id, String(b.kind), String(b.label), null, 'available', b.snapshot_key || null, b.snapshot_body || null, JSON.stringify(j(b.snapshot_fields, [])), cents(b.collateral_usd), cents(b.risk_premium_usd), null, t, t).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'RESOURCE_NEW', 'resource_declared', { id, kind: b.kind, label: b.label }, { ok: true });
      return ok({ resource_id: id, state: 'available', ledger_event_id: ev });
    },

    // RESOURCE_SNAPSHOT — resource_id|lease_id|phase : hash of the resource's material fields, taken now.
    async resourceSnapshot(env, raw) {
      const b = parseFields(raw, ['resource_id', 'lease_id', 'phase']);
      const res = await env.DB.prepare('SELECT * FROM market_resources WHERE id = ?').bind(String(b.resource_id || '')).first();
      if (!res) return err('RESOURCE_NOT_FOUND', `no resource ${b.resource_id}`);
      if (!res.snapshot_key) return err('BAD_REQUEST', 'this resource declares no snapshot capability');
      const out = await dispatch(env, res.snapshot_key, res.snapshot_body || '', { actor: 'owner:market:snapshot:' + res.id });
      let data = out?.result ?? out; if (typeof data === 'string') { const s = data.replace(/^HTTP \d+:/, '').trim(); try { data = JSON.parse(s); } catch { data = { raw: s }; } }
      const fields = j(res.snapshot_fields_json, []);
      const picked = {}; for (const f of fields) picked[f] = pick(data, f) ?? pick(data?.account || data?.data || {}, f);
      const stateJson = JSON.stringify(fields.length ? picked : data); const hash = 'sha256:' + await sha256Hex(stateJson);
      const id = newId('snap');
      try { await env.DB.prepare('INSERT INTO market_snapshots (id, resource_id, lease_id, phase, state_hash, state_json, taken_at) VALUES (?,?,?,?,?,?,?)').bind(id, res.id, b.lease_id || null, b.phase || 'adhoc', hash, stateJson.slice(0, 20000), now()).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      return ok({ snapshot_id: id, resource_id: res.id, phase: b.phase || 'adhoc', state_hash: hash, fields: fields.length ? picked : undefined });
    },

    // LEASE_NEW — resource_id|lessee_phone_or_profile|hours|allowed_actions|forbidden_actions|spend_ceiling_usd|exclusive
    async leaseNew(env, raw) {
      if (!isOwnerCall(env)) return err('OWNER_ONLY', 'a lease is granted by the resource owner');
      const b = parseFields(raw, ['resource_id', 'lessee', 'hours', 'allowed_actions', 'forbidden_actions', 'spend_ceiling_usd', 'exclusive']);
      const res = await env.DB.prepare('SELECT * FROM market_resources WHERE id = ?').bind(String(b.resource_id || '')).first();
      if (!res) return err('RESOURCE_NOT_FOUND', `no resource ${b.resource_id}`);
      if (res.state === 'quarantined' || res.state === 'under_review' || res.state === 'retired') return err('RESOURCE_UNAVAILABLE', `resource is ${res.state}`, { reason: res.quarantine_reason || null });
      const exclusive = !/^(0|false|no)$/i.test(String(b.exclusive ?? '1'));
      if (exclusive) {
        const busy = await env.DB.prepare("SELECT id FROM market_leases WHERE resource_id = ? AND state IN ('reserved','active') AND expires_at > ?").bind(res.id, now()).first();
        if (busy) return err('RESOURCE_BUSY', `resource ${res.id} is held by lease ${busy.id}`, { lease_id: busy.id });
      }
      let lessee = String(b.lessee || '').trim(); if (!lessee) return err('BAD_REQUEST', 'lessee (phone or profile id) required');
      if (!lessee.startsWith('prf_')) { try { lessee = (await profileForIdentifier(env, /@/.test(lessee) ? 'email' : 'phone', lessee, 'market:lease')).profile_id; } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); } }
      const hours = Math.max(1, Math.min(24 * 30, Number(b.hours) || 24));
      const allowed = j(b.allowed_actions, []); const forbidden = j(b.forbidden_actions, []);
      if (!allowed.length) return err('BAD_REQUEST', 'allowed_actions required: the directory keys the lessee may run');
      const id = newId('lease'); const t = now(); const expires = buildNowIso(Date.now() + hours * 3600 * 1000);
      // The lessee's authority is a token scoped to LEASE_ACT and LEASE_STATUS only, bound to their profile.
      const minted = await mintCapability(env, ORIGIN, { scope: 'rows', keys: 'LEASE_ACT,LEASE_STATUS', ttl: hours * 3600, uses: Math.max(10, Number(b.usage_limit) || 500), purpose: 'lease:' + id, actor: 'lessee:' + lessee, risk_ceiling: 'low', owner_gate: '0', mint_actor: 'owner' });
      if (!minted || minted.error) return err('MINT_FAILED', minted?.note || minted?.error || 'mint failed');
      try { await bindContext(env, minted.fingerprint, { profile_id: lessee, actor_kind: 'human' }, { by: 'owner' }); } catch (e) { await revokeCapability(env, minted.fingerprint).catch(() => {}); return err('DURABLE_WRITE_FAILED', e.message); }
      try {
        await env.DB.prepare(
          `INSERT INTO market_leases (id, resource_id, lessee_profile_id, fingerprint, state, exclusive, reserved_from, expires_at, activated_at, ended_at, concurrency_limit, usage_limit, uses, allowed_actions_json, forbidden_actions_json, spend_ceiling_cents, collateral_cents, pre_state_hash, post_state_hash, checkout_receipt, return_status, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).bind(id, res.id, lessee, minted.fingerprint, 'reserved', exclusive ? 1 : 0, t, expires, null, null, 1, Number(b.usage_limit) || 500, 0, JSON.stringify(allowed), JSON.stringify(forbidden), cents(b.spend_ceiling_usd), Number(res.collateral_cents || 0), null, null, null, null, t, t).run();
        await env.DB.prepare("UPDATE market_resources SET state = 'reserved', updated_at = ? WHERE id = ?").bind(t, res.id).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'LEASE_NEW', 'lease_reserved', { lease_id: id, resource_id: res.id, lessee, hours, allowed, forbidden, spend_ceiling_cents: cents(b.spend_ceiling_usd) }, { fingerprint: minted.fingerprint });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'lease written but the ledger refused the receipt');
      return ok({ lease_id: id, resource_id: res.id, lessee_profile_id: lessee, state: 'reserved', expires_at: expires, lessee_token_url: minted.short_url || null, fingerprint: minted.fingerprint, allowed_actions: allowed, forbidden_actions: forbidden, ledger_event_id: ev });
    },

    // LEASE_ACTIVATE — lease_id : takes the before snapshot and opens the lease.
    async leaseActivate(env, raw) {
      const id = String(parseFields(raw, ['lease_id']).lease_id || '').trim();
      const L = await env.DB.prepare('SELECT * FROM market_leases WHERE id = ?').bind(id).first();
      if (!L) return err('LEASE_NOT_FOUND', `no lease ${id}`);
      if (L.state !== 'reserved') return err('LEASE_STATE', `lease is ${L.state}`);
      if (L.expires_at <= now()) { await env.DB.prepare("UPDATE market_leases SET state = 'expired', updated_at = ? WHERE id = ?").bind(now(), id).run(); return err('LEASE_EXPIRED', 'the reservation window passed'); }
      let pre = null;
      const res = await env.DB.prepare('SELECT * FROM market_resources WHERE id = ?').bind(L.resource_id).first();
      if (res?.snapshot_key) { const s = await MAP.resourceSnapshot(env, `${L.resource_id}|${id}|before`); try { pre = JSON.parse(s).state_hash || null; } catch { return s; } }
      const t = now(); const receipt = newId('chk');
      try {
        await env.DB.prepare("UPDATE market_leases SET state = 'active', activated_at = ?, pre_state_hash = ?, checkout_receipt = ?, updated_at = ? WHERE id = ?").bind(t, pre, receipt, t, id).run();
        await env.DB.prepare("UPDATE market_resources SET state = 'active', updated_at = ? WHERE id = ?").bind(t, L.resource_id).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'LEASE_ACTIVATE', 'lease_activated', { lease_id: id, resource_id: L.resource_id }, { pre_state_hash: pre, checkout_receipt: receipt });
      return ok({ lease_id: id, state: 'active', pre_state_hash: pre, checkout_receipt: receipt, expires_at: L.expires_at, ledger_event_id: ev });
    },

    // LEASE_ACT — lease_id|KEY|body : the lessee runs one allowed action on the leased resource.
    async leaseAct(env, raw) {
      const b = parseFields(raw, ['lease_id', 'key', 'body']);
      const L = await env.DB.prepare('SELECT * FROM market_leases WHERE id = ?').bind(String(b.lease_id || '')).first();
      if (!L) return err('LEASE_NOT_FOUND', `no lease ${b.lease_id}`);
      const a = env?.TRACE_CTX?.authContext;
      if (!isOwnerCall(env)) { const fp = a?.capFingerprint || null; if (!fp || fp !== L.fingerprint) return err('NOT_THE_LESSEE', 'this lease belongs to another token'); }
      if (L.state !== 'active') return err('LEASE_STATE', `lease is ${L.state}; activate it first`);
      if (L.expires_at <= now()) { await env.DB.prepare("UPDATE market_leases SET state = 'expired', updated_at = ? WHERE id = ?").bind(now(), L.id).run(); return err('LEASE_EXPIRED', 'the lease has expired'); }
      if (Number(L.uses) >= Number(L.usage_limit)) return err('USES_EXHAUSTED', `the lease allowed ${L.usage_limit} actions`);
      const key = String(b.key || '').trim().toUpperCase();
      const allowed = j(L.allowed_actions_json, []); const forbidden = j(L.forbidden_actions_json, []);
      if (forbidden.includes(key) || !allowed.includes(key)) {
        await ledger(env, 'LEASE_ACT', 'forbidden_action_refused', { lease_id: L.id, key }, { ok: false, error: 'FORBIDDEN_ACTION' }, 403);
        return err('FORBIDDEN_ACTION', `${key} is not an allowed action on lease ${L.id}`, { allowed, forbidden });
      }
      // Spend rows carry a number; a spend above the ceiling is refused before anything runs.
      if (/BUDGET|SPEND|CHARGE|PAY/.test(key) && L.spend_ceiling_cents != null) {
        const nums = (String(b.body || '').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
        const amt = cents(nums.length ? Math.max(...nums) : 0);   // the largest number in a spend body is the spend
        if (amt > Number(L.spend_ceiling_cents)) { await ledger(env, 'LEASE_ACT', 'spend_ceiling_refused', { lease_id: L.id, key, amount_cents: amt }, { ok: false, error: 'SPEND_CEILING' }, 403); return err('SPEND_CEILING', `${amt} cents exceeds the lease ceiling of ${L.spend_ceiling_cents} cents`); }
      }
      const out = await dispatch(env, key, String(b.body || ''), { actor: 'owner:lease:' + L.id });
      try { await env.DB.prepare('UPDATE market_leases SET uses = uses + 1, updated_at = ? WHERE id = ?').bind(now(), L.id).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'LEASE_ACT', 'lease_action_ran', { lease_id: L.id, key, body_chars: String(b.body || '').length }, { ok: out?.ok !== false, invocation_id: out?.invocation?.id || out?.proof?.invocation_id || null });
      return ok({ lease_id: L.id, key, result: out?.result ?? out, invocation_id: out?.invocation?.id || out?.proof?.invocation_id || null, ledger_event_id: ev });
    },

    // LEASE_END — lease_id : takes the after snapshot, compares, closes or quarantines.
    async leaseEnd(env, raw) {
      const id = String(parseFields(raw, ['lease_id']).lease_id || '').trim();
      const L = await env.DB.prepare('SELECT * FROM market_leases WHERE id = ?').bind(id).first();
      if (!L) return err('LEASE_NOT_FOUND', `no lease ${id}`);
      if (!isOwnerCall(env) && env?.TRACE_CTX?.authContext?.capFingerprint !== L.fingerprint) return err('NOT_THE_LESSEE', 'this lease belongs to another token');
      let post = null;
      const res = await env.DB.prepare('SELECT * FROM market_resources WHERE id = ?').bind(L.resource_id).first();
      if (res?.snapshot_key) { const s = await MAP.resourceSnapshot(env, `${L.resource_id}|${id}|after`); try { post = JSON.parse(s).state_hash || null; } catch { return s; } }
      const clean = !L.pre_state_hash || !post || L.pre_state_hash === post;
      const t = now();
      try {
        await env.DB.prepare("UPDATE market_leases SET state = 'ended', ended_at = ?, post_state_hash = ?, return_status = ?, updated_at = ? WHERE id = ?").bind(t, post, clean ? 'clean' : 'dirty', t, id).run();
        await env.DB.prepare('UPDATE market_resources SET state = ?, quarantine_reason = ?, updated_at = ? WHERE id = ?').bind(clean ? 'available' : 'quarantined', clean ? null : `lease ${id} returned the resource changed`, t, L.resource_id).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      await revokeCapability(env, L.fingerprint).catch(() => {});
      let task = null;
      if (!clean) {
        const r = await createTask(env, { kind: 'failure', objective: `Resource ${L.resource_id} returned changed after lease ${id}: SNAPSHOT_MISMATCH`, detail: `pre ${L.pre_state_hash} → post ${post}. The resource is quarantined until an owner reviews it.`, priority: 1, acceptance: [{ id: 'resource_released', type: 'sql_count_at_least', sql: `SELECT COUNT(*) FROM market_resources WHERE id='${L.resource_id}' AND state='available'`, min: 1 }] }, 'market').catch(() => null);
        task = r?.task?.task_id || r?.task?.id || null;
      }
      const ev = await ledger(env, 'LEASE_END', clean ? 'lease_ended_clean' : 'lease_ended_dirty', { lease_id: id, resource_id: L.resource_id, uses: L.uses }, { post_state_hash: post, pre_state_hash: L.pre_state_hash, quarantined: !clean, task }, clean ? 200 : 409);
      if (!clean) return err('SNAPSHOT_MISMATCH', 'the resource changed during the lease; it is quarantined and a work task names the lease', { lease_id: id, pre_state_hash: L.pre_state_hash, post_state_hash: post, task, ledger_event_id: ev });
      return ok({ lease_id: id, state: 'ended', return_status: 'clean', pre_state_hash: L.pre_state_hash, post_state_hash: post, uses: L.uses, ledger_event_id: ev });
    },

    async leaseStatus(env, raw) {
      const id = String(parseFields(raw, ['lease_id']).lease_id || '').trim();
      const L = await env.DB.prepare('SELECT * FROM market_leases WHERE id = ?').bind(id).first();
      if (!L) return err('LEASE_NOT_FOUND', `no lease ${id}`);
      const res = await env.DB.prepare('SELECT id, kind, label, state FROM market_resources WHERE id = ?').bind(L.resource_id).first();
      const snaps = (await env.DB.prepare('SELECT id, phase, state_hash, taken_at FROM market_snapshots WHERE lease_id = ? ORDER BY taken_at').bind(id).all()).results || [];
      return ok({ lease: { ...L, allowed_actions: j(L.allowed_actions_json, []), forbidden_actions: j(L.forbidden_actions_json, []) }, resource: res, snapshots: snaps, denials: { not_allowed: 'FORBIDDEN_ACTION', over_ceiling: 'SPEND_CEILING', after_expiry: 'LEASE_EXPIRED', another_token: 'NOT_THE_LESSEE' } });
    },

    // ── CLAIMS, COMMITMENTS, VERIFICATION, DISPUTES ───────────────────────────────────────
    // CLAIM_COMMIT — methodology_key|hypothesis|metric|cohort|exclusions|baseline|window_from|window_to|stopping_rule|method|control
    async claimCommit(env, raw) {
      const b = parseFields(raw, ['methodology_key', 'hypothesis', 'metric', 'cohort', 'exclusions', 'baseline', 'window_from', 'window_to', 'stopping_rule', 'method', 'control']);
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const mk = String(b.methodology_key || '').toUpperCase(); if (!METHODOLOGIES[mk]) return err('METHODOLOGY_UNKNOWN', `no methodology ${mk}; known: ${Object.keys(METHODOLOGIES).join(', ')}`);
      for (const f of ['hypothesis', 'metric', 'cohort', 'baseline', 'window_from', 'window_to', 'method']) if (!b[f]) return err('BAD_REQUEST', `${f} required before any outcome is read`);
      const id = newId('cmt'); const t = now();
      const ev = await ledger(env, 'CLAIM_COMMIT', 'claim_committed', { id, methodology_key: mk, hypothesis: b.hypothesis, metric: b.metric, cohort: b.cohort, exclusions: b.exclusions || null, baseline: b.baseline, window_from: b.window_from, window_to: b.window_to, stopping_rule: b.stopping_rule || null, method: b.method, control: b.control || null }, { ok: true });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'the commitment must be a receipt; the ledger refused it');
      try {
        await env.DB.prepare('INSERT INTO market_claim_commits (id, claim_id, provider_profile_id, methodology_key, hypothesis, metric, cohort, exclusions, baseline, window_from, window_to, stopping_rule, method, control, ledger_event_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(id, null, b.provider_profile_id || 'owner', mk, b.hypothesis, b.metric, b.cohort, b.exclusions || null, b.baseline, b.window_from, b.window_to, b.stopping_rule || null, b.method, b.control || null, ev, t).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      return ok({ commit_id: id, methodology_key: mk, committed_at: t, ledger_event_id: ev, note: 'read the outcome only after this receipt exists; a claim that cites it is preregistered' });
    },

    // CLAIM_NEW — methodology_key|statement|period_from|period_to|evidence_receipts(csv inv ids)|commit_id|provider
    async claimNew(env, raw) {
      const b = parseFields(raw, ['methodology_key', 'statement', 'period_from', 'period_to', 'evidence_receipts', 'commit_id', 'provider']);
      if (b._bad_json) return err('BAD_REQUEST', 'body started with { but is not valid JSON');
      const mk = String(b.methodology_key || '').toUpperCase(); const M = METHODOLOGIES[mk];
      if (!M) return err('METHODOLOGY_UNKNOWN', `no methodology ${mk}`);
      const ids = j(b.evidence_receipts, []).map(String).filter((x) => /^inv_/.test(x));
      if (ids.length < M.evidence.length) return err('EVIDENCE_MISSING', `${mk} needs ${M.evidence.length} receipts: ${M.evidence.join('; ')}`);
      const loaded = await loadReceipts(env, ids, getInvocation); if (loaded.missing) return err('EVIDENCE_MISSING', `receipt ${loaded.missing} not found`); const recs = loaded.recs;
      const value = M.compute(recs); if (value?.error) return err(value.error, value.detail || 'compute failed', { value });
      const commitment = 'sha256:' + await sha256Hex(recs.map((r) => r.id + ':' + (JSON.parse(r.invocation_json || '{}').fingerprints?.response || r.event_id || '')).join('|'));
      let grade = 'execution-receipted';
      const sourceBacked = recs.every((r) => /^(META_|STRIPE_|BC|KLAVIYO|GOOGLE_)/.test(String(r.object_id || '')));
      if (sourceBacked) grade = 'method-reproducible';   // recomputed here from provider-API receipts
      let commit = null;
      if (b.commit_id) { commit = await env.DB.prepare('SELECT * FROM market_claim_commits WHERE id = ?').bind(String(b.commit_id)).first(); if (!commit) return err('BAD_REQUEST', `no commitment ${b.commit_id}`); }
      const preregistered = !!(commit && recs.every((r) => String(r.ts) > String(commit.created_at)));
      const id = newId('clm'); const t = now();
      try {
        await env.DB.prepare('INSERT INTO market_claims (id, provider_profile_id, statement, period_from, period_to, methodology_key, methodology_version, evidence_receipts_json, dataset_commitment, evidence_grade, commit_id, preregistered, value_json, state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(id, b.provider || 'owner', String(b.statement || M.statement), b.period_from || null, b.period_to || null, mk, M.version, JSON.stringify(ids), commitment, grade, commit?.id || null, preregistered ? 1 : 0, JSON.stringify(value), 'open', t, t).run();
        if (commit) await env.DB.prepare('UPDATE market_claim_commits SET claim_id = ? WHERE id = ?').bind(id, commit.id).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'CLAIM_NEW', 'claim_created', { id, methodology_key: mk, evidence_receipts: ids, commit_id: commit?.id || null }, { value, evidence_grade: grade, preregistered, dataset_commitment: commitment });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'claim written but the ledger refused the receipt');
      return ok({ claim_id: id, methodology_key: mk, methodology_version: M.version, value, evidence_grade: grade, preregistered, dataset_commitment: commitment, verify: `POST /api/dispatch {"key":"VERIFY_CLAIM","body":"${id}"}`, ledger_event_id: ev });
    },

    // VERIFY_CLAIM — claim_id : recompute from the committed receipts with the claim's methodology.
    async verifyClaim(env, raw) {
      const id = String(parseFields(raw, ['claim_id']).claim_id || '').trim();
      const C = await env.DB.prepare('SELECT * FROM market_claims WHERE id = ?').bind(id).first();
      if (!C) return err('CLAIM_NOT_FOUND', `no claim ${id}`);
      const M = METHODOLOGIES[C.methodology_key]; if (!M) return err('METHODOLOGY_UNKNOWN', C.methodology_key);
      const ids = j(C.evidence_receipts_json, []);
      const loaded = await loadReceipts(env, ids, getInvocation); if (loaded.missing) return err('EVIDENCE_MISSING', `receipt ${loaded.missing} not found`); const recs = loaded.recs;
      const commitment = 'sha256:' + await sha256Hex(recs.map((r) => r.id + ':' + (JSON.parse(r.invocation_json || '{}').fingerprints?.response || r.event_id || '')).join('|'));
      const recomputed = M.compute(recs);
      const claimed = j(C.value_json, {});
      const match = commitment === C.dataset_commitment && !recomputed?.error && M.compare(claimed, recomputed);
      const vid = newId('ver'); const t = now();
      try { await env.DB.prepare('INSERT INTO market_verifications (id, claim_id, verifier, methodology_key, methodology_version, recomputed_json, result, detail, ledger_event_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(vid, id, actorOf(env), C.methodology_key, M.version, JSON.stringify(recomputed), match ? 'match' : 'mismatch', commitment === C.dataset_commitment ? (match ? 'recompute equals the claim' : 'recompute differs from the claim') : 'evidence changed since the claim was made', null, t).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'VERIFY_CLAIM', match ? 'verification_match' : 'verification_mismatch', { claim_id: id, methodology_key: C.methodology_key }, { recomputed, claimed, evidence_unchanged: commitment === C.dataset_commitment }, match ? 200 : 409);
      try { await env.DB.prepare('UPDATE market_verifications SET ledger_event_id = ? WHERE id = ?').bind(ev, vid).run(); await env.DB.prepare('UPDATE market_claims SET state = ?, updated_at = ? WHERE id = ?').bind(match ? 'verified' : 'disputed_by_recompute', t, id).run(); } catch {}
      if (!match) return err('VERIFICATION_MISMATCH', 'the recompute does not reproduce the claim', { claim_id: id, verification_id: vid, claimed, recomputed, evidence_unchanged: commitment === C.dataset_commitment, ledger_event_id: ev });
      return ok({ claim_id: id, verification_id: vid, result: 'match', evidence_grade: C.evidence_grade, preregistered: !!C.preregistered, claimed, recomputed, ledger_event_id: ev });
    },

    // CLAIM_CHALLENGE — claim_id|bond_usd|evidence : a bonded dispute inside the window; opens a work task.
    async claimChallenge(env, raw) {
      const b = parseFields(raw, ['claim_id', 'bond_usd', 'evidence']);
      const C = await env.DB.prepare('SELECT * FROM market_claims WHERE id = ?').bind(String(b.claim_id || '')).first();
      if (!C) return err('CLAIM_NOT_FOUND', `no claim ${b.claim_id}`);
      const windowEnd = new Date(new Date(C.created_at).getTime() + 30 * DAY * 1000).toISOString();
      if (now() > windowEnd) return err('CHALLENGE_WINDOW_CLOSED', `the 30-day challenge window closed at ${windowEnd}`);
      const bond = cents(b.bond_usd); if (bond < 500) return err('BOND_REQUIRED', 'a challenge carries a bond of at least $5.00');
      if (!b.evidence) return err('EVIDENCE_MISSING', 'a challenge names its evidence');
      const id = newId('chg'); const t = now();
      const task = await createTask(env, { kind: 'work', objective: `Resolve challenge ${id} against claim ${C.id} (${C.methodology_key})`, detail: `Challenger evidence: ${String(b.evidence).slice(0, 2000)}. Bond ${bond} cents. Resolve by re-running VERIFY_CLAIM and, if judgment is needed, a governed panel; append the resolution to the claim, never overwrite it.`, priority: 2, acceptance: [{ id: 'resolved', type: 'sql_count_at_least', sql: `SELECT COUNT(*) FROM market_challenges WHERE id='${id}' AND state IN ('upheld','rejected')`, min: 1 }] }, actorOf(env)).catch((e) => ({ ok: false, error: e.message }));
      const taskId = task?.task?.task_id || task?.task?.id || null;
      try {
        await env.DB.prepare('INSERT INTO market_challenges (id, claim_id, challenger, bond_cents, evidence, window_ends_at, state, task_id, resolution, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id, C.id, actorOf(env), bond, String(b.evidence), windowEnd, 'open', taskId, null, t, t).run();
        await env.DB.prepare("UPDATE market_claims SET state = 'challenged', updated_at = ? WHERE id = ?").bind(t, C.id).run();
        await env.DB.prepare("UPDATE market_settlements SET state = 'frozen', updated_at = ? WHERE kind = 'agreement' AND ref_id IN (SELECT id FROM market_agreements WHERE claim_id = ?)").bind(t, C.id).run().catch(() => {});
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'CLAIM_CHALLENGE', 'challenge_opened', { challenge_id: id, claim_id: C.id, bond_cents: bond }, { task_id: taskId, window_ends_at: windowEnd });
      return ok({ challenge_id: id, claim_id: C.id, state: 'open', bond_cents: bond, task_id: taskId, window_ends_at: windowEnd, ledger_event_id: ev });
    },

    // CLAIM_RESOLVE — challenge_id|upheld|rejected|reason : owner or panel records the resolution.
    async claimResolve(env, raw) {
      if (!isOwnerCall(env)) return err('OWNER_ONLY', 'resolutions are recorded by the owner or the panel step');
      const b = parseFields(raw, ['challenge_id', 'verdict', 'reason']);
      const G = await env.DB.prepare('SELECT * FROM market_challenges WHERE id = ?').bind(String(b.challenge_id || '')).first();
      if (!G) return err('CHALLENGE_NOT_FOUND', `no challenge ${b.challenge_id}`);
      const verdict = String(b.verdict || '').toLowerCase(); if (!['upheld', 'rejected'].includes(verdict)) return err('BAD_REQUEST', 'verdict is upheld (the challenger wins) or rejected');
      const t = now();
      try {
        await env.DB.prepare('UPDATE market_challenges SET state = ?, resolution = ?, updated_at = ? WHERE id = ?').bind(verdict, String(b.reason || ''), t, G.id).run();
        await env.DB.prepare('UPDATE market_claims SET state = ?, updated_at = ? WHERE id = ?').bind(verdict === 'upheld' ? 'refuted' : 'verified', t, G.claim_id).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'CLAIM_RESOLVE', 'challenge_' + verdict, { challenge_id: G.id, claim_id: G.claim_id }, { reason: b.reason || null, bond_cents: G.bond_cents, bond_outcome: verdict === 'upheld' ? 'returned to challenger' : 'forfeited' });
      return ok({ challenge_id: G.id, claim_id: G.claim_id, verdict, bond_outcome: verdict === 'upheld' ? 'returned' : 'forfeited', ledger_event_id: ev });
    },

    // PROVIDER_RECORD — provider : the evidence-derived record, read from the tables, never a score.
    async providerRecord(env, raw) {
      const p = String(parseFields(raw, ['provider']).provider || 'owner').trim();
      const q = async (sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).all()).results || [];
      const byGrade = await q('SELECT evidence_grade, state, COUNT(*) n FROM market_claims WHERE provider_profile_id = ? GROUP BY evidence_grade, state', p);
      const methods = await q('SELECT methodology_key, methodology_version, COUNT(*) n FROM market_claims WHERE provider_profile_id = ? GROUP BY methodology_key, methodology_version', p);
      const verif = await q('SELECT v.result, COUNT(*) n FROM market_verifications v JOIN market_claims c ON c.id = v.claim_id WHERE c.provider_profile_id = ? GROUP BY v.result', p);
      const disputes = await q('SELECT g.state, COUNT(*) n FROM market_challenges g JOIN market_claims c ON c.id = g.claim_id WHERE c.provider_profile_id = ? GROUP BY g.state', p);
      const agreements = await q('SELECT state, COUNT(*) n, COUNT(DISTINCT buyer_profile_id) counterparties FROM market_agreements WHERE provider_profile_id = ? GROUP BY state', p);
      const preregistered = await q('SELECT COUNT(*) n FROM market_claims WHERE provider_profile_id = ? AND preregistered = 1', p);
      return ok({ provider: p, claims_by_grade_and_state: byGrade, methodologies: methods, verifications: verif, disputes, agreements, preregistered_claims: Number(preregistered[0]?.n || 0), counterparties: agreements.reduce((s, a) => s + Number(a.counterparties || 0), 0), note: 'a record, not a score: read the grades, the methods, the disputes and the counterparties' });
    },

    // ── WANTS, MANDATES, SOLICITATIONS, OFFERS, AGREEMENTS ────────────────────────────────
    // WANT_NEW — phone_or_profile|text|public
    async wantNew(env, raw) {
      const b = parseFields(raw, ['who', 'text', 'public']);
      if (!b.who || !b.text) return err('BAD_REQUEST', 'who (phone, email or profile id) and text required');
      let pid = String(b.who).trim();
      if (!pid.startsWith('prf_')) { try { pid = (await profileForIdentifier(env, /@/.test(pid) ? 'email' : 'phone', pid, 'market:want')).profile_id; } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); } }
      const id = newId('want'); const t = now(); const pub = /^(1|true|yes)$/i.test(String(b.public || '0')) ? 1 : 0;
      try { await env.DB.prepare('INSERT INTO market_wants (id, profile_id, text, public, state, mandate_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(id, pid, String(b.text), pub, 'open', null, t, t).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'WANT_NEW', 'want_recorded', { want_id: id, profile_id: pid, public: pub, text_chars: String(b.text).length }, { ok: true });
      return ok({ want_id: id, profile_id: pid, public: !!pub, state: 'open', next: 'MANDATE_SET before anything executes', ledger_event_id: ev });
    },

    // MANDATE_SET — want_id|budget_usd|deadline|provider_classes|allowed_actions|forbidden_actions|auto_execute_usd|confirm_usd|evidence_required|cancellation
    async mandateSet(env, raw) {
      const b = parseFields(raw, ['want_id', 'budget_usd', 'deadline', 'provider_classes', 'allowed_actions', 'forbidden_actions', 'auto_execute_usd', 'confirm_usd', 'evidence_required', 'cancellation']);
      const W = await env.DB.prepare('SELECT * FROM market_wants WHERE id = ?').bind(String(b.want_id || '')).first();
      if (!W) return err('WANT_NOT_FOUND', `no want ${b.want_id}`);
      if (!isOwnerCall(env) && env?.TRACE_CTX?.authContext?.presenter?.profile_id !== W.profile_id) return err('NOT_THE_BUYER', 'a mandate is set by the want\'s own profile');
      const budget = cents(b.budget_usd); if (!budget) return err('BAD_REQUEST', 'budget_usd required');
      const id = newId('mnd'); const t = now();
      try {
        await env.DB.prepare('INSERT INTO market_mandates (id, want_id, profile_id, objective, acceptable_outcomes, budget_cents, deadline, provider_classes_json, public, allowed_actions_json, forbidden_actions_json, auto_execute_cents, confirm_cents, evidence_required, cancellation_terms, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(id, W.id, W.profile_id, W.text, b.acceptable_outcomes || null, budget, b.deadline || null, JSON.stringify(j(b.provider_classes, [])), W.public, JSON.stringify(j(b.allowed_actions, [])), JSON.stringify(j(b.forbidden_actions, [])), cents(b.auto_execute_usd), cents(b.confirm_usd), b.evidence_required || 'execution-receipted', b.cancellation || 'cancel before agreement at no cost', t).run();
        await env.DB.prepare("UPDATE market_wants SET mandate_id = ?, state = 'mandated', updated_at = ? WHERE id = ?").bind(id, t, W.id).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'MANDATE_SET', 'mandate_recorded', { mandate_id: id, want_id: W.id, budget_cents: budget, auto_execute_cents: cents(b.auto_execute_usd) }, { ok: true });
      return ok({ mandate_id: id, want_id: W.id, budget_cents: budget, next: 'WANT_SOLICIT to match or solicit', ledger_event_id: ev });
    },

    // WANT_SOLICIT — want_id|mode(direct|private|public)|targets(csv row keys or provider ids)
    async wantSolicit(env, raw) {
      const b = parseFields(raw, ['want_id', 'mode', 'targets']);
      const W = await env.DB.prepare('SELECT * FROM market_wants WHERE id = ?').bind(String(b.want_id || '')).first();
      if (!W) return err('WANT_NOT_FOUND', `no want ${b.want_id}`);
      if (!W.mandate_id) return err('NO_MANDATE', 'set a mandate before soliciting; nothing about a want executes without one');
      const M = await env.DB.prepare('SELECT * FROM market_mandates WHERE id = ?').bind(W.mandate_id).first();
      let mode = String(b.mode || 'direct').toLowerCase();
      if (mode === 'public' && !W.public) return err('WANT_PRIVATE', 'this want is private; mark it public on WANT_NEW to post it');
      const targets = j(b.targets, []);
      let matches = [];
      if (mode === 'direct') {
        // Direct resolution: priced rows the buyer could pay for, ranked into a set, never one winner.
        const dir = await loadDirectory(env);
        const rights = (await env.DB.prepare('SELECT row_key FROM market_rights WHERE resale_allowed = 1').all()).results || [];
        const sellable = rights.map((r) => dir[r.row_key]).filter(Boolean).filter((r) => cents(r.price_usd) > 0);
        const words = String(W.text).toLowerCase().split(/\W+/).filter((w) => w.length > 3);
        const scored = sellable.map((r) => { const hay = (r.key + ' ' + (r.content || '')).toLowerCase(); const hits = words.filter((w) => hay.includes(w)).length; return { key: r.key, price_cents: cents(r.price_usd), meter_unit: r.meter_unit, relevance: hits }; }).filter((x) => x.relevance > 0 && x.price_cents <= Number(M.budget_cents));
        const byRel = [...scored].sort((a, b2) => b2.relevance - a.relevance)[0];
        const byPrice = [...scored].sort((a, b2) => a.price_cents - b2.price_cents)[0];
        matches = { best_match: byRel || null, cheapest: byPrice || null, all: scored.slice(0, 10), note: 'a set, not a winner; evidence grade would rank providers, price ranks rows' };
        if (!scored.length) mode = 'private';
      }
      const id = newId('sol'); const t = now();
      try { await env.DB.prepare('INSERT INTO market_solicitations (id, want_id, mandate_id, scope, budget_class, evidence_required, deadline, mode, targets_json, state, matches_json, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, W.id, M.id, W.text, Number(M.budget_cents) >= 100000 ? 'over_1000' : Number(M.budget_cents) >= 10000 ? '100_to_1000' : 'under_100', M.evidence_required, M.deadline, mode, JSON.stringify(targets), 'open', JSON.stringify(matches), t).run(); await env.DB.prepare("UPDATE market_wants SET state = 'solicited', updated_at = ? WHERE id = ?").bind(t, W.id).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'WANT_SOLICIT', 'solicitation_' + mode, { solicitation_id: id, want_id: W.id, mode, targets }, { matches: mode === 'direct' ? matches : null });
      return ok({ solicitation_id: id, want_id: W.id, mode, matches: mode === 'direct' ? matches : undefined, public_post: mode === 'public' ? 'posted to the wanted board' : 'not posted; private', next: 'providers answer with OFFER_NEW', ledger_event_id: ev });
    },

    // OFFER_NEW — solicitation_id|provider|scope|method|price_usd|timing|evidence_promised|composition(human|ai|hybrid)|authority_grade
    async offerNew(env, raw) {
      const b = parseFields(raw, ['solicitation_id', 'provider', 'scope', 'method', 'price_usd', 'timing', 'evidence_promised', 'composition', 'authority_grade']);
      const S = await env.DB.prepare('SELECT * FROM market_solicitations WHERE id = ?').bind(String(b.solicitation_id || '')).first();
      if (!S) return err('SOLICITATION_NOT_FOUND', `no solicitation ${b.solicitation_id}`);
      const comp = String(b.composition || '').toLowerCase(); if (!['human', 'ai', 'hybrid'].includes(comp)) return err('COMPOSITION_REQUIRED', 'composition must be human, ai or hybrid; buyers price accountability by it');
      if (!b.provider || !b.scope || !b.price_usd) return err('BAD_REQUEST', 'provider, scope and price_usd required');
      const grade = String(b.authority_grade || 'agent-inferred');
      const id = newId('ofr'); const t = now(); const exp = buildNowIso(Date.now() + 7 * DAY * 1000);
      try { await env.DB.prepare('INSERT INTO market_offers (id, solicitation_id, provider_profile_id, scope, method, price_cents, timing, evidence_promised, composition, authority_grade, state, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, S.id, String(b.provider), String(b.scope), b.method || null, cents(b.price_usd), b.timing || null, b.evidence_promised || null, comp, grade, 'open', exp, t).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'OFFER_NEW', 'offer_made', { offer_id: id, solicitation_id: S.id, provider: b.provider, price_cents: cents(b.price_usd), composition: comp, authority_grade: grade }, { ok: true });
      return ok({ offer_id: id, solicitation_id: S.id, price_cents: cents(b.price_usd), composition: comp, expires_at: exp, next: 'the buyer accepts with AGREEMENT_ACCEPT', ledger_event_id: ev });
    },

    // AGREEMENT_ACCEPT — offer_id|acceptance_tests_json|authority_grade : binding; creates the work task and the settlement.
    async agreementAccept(env, raw) {
      const b = parseFields(raw, ['offer_id', 'acceptance', 'authority_grade']);
      const O = await env.DB.prepare('SELECT * FROM market_offers WHERE id = ?').bind(String(b.offer_id || '')).first();
      if (!O) return err('OFFER_NOT_FOUND', `no offer ${b.offer_id}`);
      if (O.state !== 'open') return err('OFFER_STATE', `offer is ${O.state}`);
      if (O.expires_at <= now()) { await env.DB.prepare("UPDATE market_offers SET state = 'expired' WHERE id = ?").bind(O.id).run(); return err('OFFER_EXPIRED', 'the offer expired'); }
      const S = await env.DB.prepare('SELECT * FROM market_solicitations WHERE id = ?').bind(O.solicitation_id).first();
      const W = await env.DB.prepare('SELECT * FROM market_wants WHERE id = ?').bind(S.want_id).first();
      const M = await env.DB.prepare('SELECT * FROM market_mandates WHERE id = ?').bind(S.mandate_id).first();
      if (!isOwnerCall(env) && env?.TRACE_CTX?.authContext?.presenter?.profile_id !== W.profile_id) return err('NOT_THE_BUYER', 'only the want\'s profile accepts an offer');
      if (Number(O.price_cents) > Number(M.budget_cents)) return err('OVER_BUDGET', `offer ${O.price_cents} cents exceeds the mandate budget ${M.budget_cents} cents`);
      const grade = String(b.authority_grade || (Number(O.price_cents) <= Number(M.auto_execute_cents || 0) ? 'agent-approved-under-mandate' : 'agent-inferred'));
      if (grade !== 'person-approved' && Number(O.price_cents) > Number(M.auto_execute_cents || 0)) return err('CONFIRMATION_REQUIRED', `${O.price_cents} cents is above the mandate's auto-execute threshold; the person must approve (authority_grade=person-approved)`);
      const acceptance = j(b.acceptance, null) || [{ id: 'evidence_present', type: 'evidence_present', field: 'deliverable' }];
      const id = newId('agr'); const t = now();
      const task = await createTask(env, { kind: 'work', objective: `Agreement ${id}: ${String(W.text).slice(0, 200)}`, detail: `Offer ${O.id} by ${O.provider_profile_id}: ${O.scope}. Method: ${O.method || 'unstated'}. Price ${O.price_cents} cents. Evidence promised: ${O.evidence_promised || 'unstated'}. Composition: ${O.composition}. Authority: ${grade}.`, priority: 3, acceptance }, actorOf(env)).catch((e) => ({ ok: false, error: e.message }));
      if (!task?.ok) return err('DURABLE_WRITE_FAILED', 'the work task could not be created: ' + (task?.error || 'unknown'));
      const taskId = task.task.task_id || task.task.id;
      const stlId = newId('stl');
      try {
        await env.DB.prepare('INSERT INTO market_settlements (id, kind, ref_id, rail, amount_cents, fees_cents, currency, finality_state, reversible_until, dispute_window_days, chargeback_reserve_cents, refund_policy, tax_treatment, payout_date, state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .bind(stlId, 'agreement', id, 'stripe', O.price_cents, Math.round(O.price_cents * 0.029 + 30), 'usd', 'escrow_pending', null, 30, 0, 'released on acceptance; refunded on refusal or a lost dispute', 'sales tax not collected', null, 'held', t, t).run();
        await env.DB.prepare('INSERT INTO market_agreements (id, offer_id, want_id, buyer_profile_id, provider_profile_id, price_cents, acceptance_json, task_id, settlement_id, authority_grade, claim_id, state, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, O.id, W.id, W.profile_id, O.provider_profile_id, O.price_cents, JSON.stringify(acceptance), taskId, stlId, grade, null, 'agreed', t).run();
        await env.DB.prepare("UPDATE market_offers SET state = 'accepted' WHERE id = ?").bind(O.id).run();
        await env.DB.prepare("UPDATE market_wants SET state = 'agreed', updated_at = ? WHERE id = ?").bind(t, W.id).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'AGREEMENT_ACCEPT', 'agreement_made', { agreement_id: id, offer_id: O.id, want_id: W.id, price_cents: O.price_cents, authority_grade: grade }, { task_id: taskId, settlement_id: stlId });
      return ok({ agreement_id: id, task_id: taskId, settlement_id: stlId, settlement_state: 'held', authority_grade: grade, note: 'money and reputation move when the task\'s acceptance tests pass', ledger_event_id: ev });
    },

    // SETTLEMENT_GET — id : the terms and finality of one settlement, sale or agreement.
    async settlementGet(env, raw) {
      const id = String(parseFields(raw, ['id']).id || '').trim();
      const S = await env.DB.prepare('SELECT * FROM market_settlements WHERE id = ? OR ref_id = ?').bind(id, id).first();
      if (!S) return err('SETTLEMENT_NOT_FOUND', `no settlement for ${id}`);
      const final = !!(S.finality_state === 'final' || (S.reversible_until && S.reversible_until <= now()));
      return ok({ settlement: S, final, note: final ? 'final' : 'SETTLEMENT_NOT_FINAL: inside the reversal window' });
    },

    // METHODOLOGY — key : the versioned definition a claim is computed by.
    async methodologyDescribe(env, raw) {
      const k = String(parseFields(raw, ['key']).key || '').toUpperCase().trim();
      if (!k) return ok({ methodologies: Object.fromEntries(Object.entries(METHODOLOGIES).map(([n, m]) => [n, { version: m.version, statement: m.statement }])) });
      const M = METHODOLOGIES[k]; if (!M) return err('METHODOLOGY_UNKNOWN', k);
      return ok({ key: k, version: M.version, statement: M.statement, evidence: M.evidence, exclusions: M.exclusions, grade_ceiling: M.grade_ceiling, grades: EVIDENCE_GRADES });
    },
  };
  return MAP;
}
