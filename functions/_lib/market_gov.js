import { getContext, bindContext, explainContext } from './capability_context.js';
import { publicJwkFromPrivate } from './oip_envelope.js';
import { homePrivateJwk, homeAgentId, homeDomain } from './oip_federation.js';

const ORIGIN = 'https://miscsubjects.com';
const DAY = 86400;
function err(code, message, extra = {}) { return 'ERR:' + code + ' ' + JSON.stringify({ ok: false, error: code, message: String(message || code), ...extra }); }
function ok(o) { return JSON.stringify({ ok: true, ...o }); }
function newId(prefix) { const b = crypto.getRandomValues(new Uint8Array(8)); return prefix + '_' + [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); }
const enc = new TextEncoder();
async function sha256Hex(s) { const d = await crypto.subtle.digest('SHA-256', enc.encode(String(s))); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function isOwnerCall(env) { return !!env?.TRACE_CTX?.authContext?.ownerAuthed; }
function actorOf(env) { return env?.TRACE_CTX?.actor || (isOwnerCall(env) ? 'owner' : 'unknown'); }
function presenterProfile(env) { return env?.TRACE_CTX?.authContext?.presenter?.profile_id || null; }
function j(v, d) { if (v == null || v === '') return d; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return String(v).split(',').map((x) => x.trim()).filter(Boolean); } }
function cents(v) { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) : 0; }
export function parseFields(raw, names) {
  const s = raw == null ? '' : String(raw);
  if (s.trim().startsWith('{')) { try { return JSON.parse(s); } catch { return { _bad_json: true }; } }
  const parts = s.split('|'); const out = {};
  names.forEach((n, i) => { out[n] = i === names.length - 1 ? parts.slice(i).join('|').trim() : (parts[i] ?? '').trim(); });
  return out;
}
const GRADES = ['self-attested', 'execution-receipted', 'source-authenticated', 'method-reproducible', 'causally-supported', 'privacy-preserving'];

const COARSE = { OWNER_ONLY: 'this operation belongs to the owner', NOT_THE_LESSEE: 'this lease belongs to another token', NOT_THE_BUYER: 'this want belongs to another profile', RIGHTS_MISSING: 'this row is not for sale', RESALE_NOT_ALLOWED: 'this row is not for sale', DEVICE_NOT_APPROVED: 'the presenting device is not approved', SESSION_NOT_APPROVED: 'the presenting session is not approved', POLICY_DENIED: 'a policy refused this invocation' };
export function tierDenials(map) {
  const out = {};
  for (const [name, fn] of Object.entries(map)) {
    out[name] = async (env, ...args) => {
      const r = await fn(env, ...args);
      if (typeof r === 'string' && r.startsWith('ERR:') && !isOwnerCall(env)) {
        const code = (r.match(/^ERR:([A-Z_]+)/) || [])[1] || 'REFUSED';
        if (COARSE[code]) return 'ERR:' + code + ' ' + JSON.stringify({ ok: false, error: code, message: COARSE[code], detail: 'the full reason is on the owner\'s ledger' });
      }
      return r;
    };
  }
  return out;
}

// ── aggregation datasets: bounded computations over the market's own tables ────────────────
// Each dataset names the table, the member key, the numeric field and the allowed filters. The
// answer is an aggregate over at least MIN_COHORT members; the members are hashed, never returned.
const MIN_COHORT = 5;
const DATASETS = {
  sales_by_row: { sql: 'SELECT id AS member, amount_cents AS value, row_key AS f_row_key, substr(created_at,1,7) AS f_month FROM market_sales', filters: ['row_key', 'month'], describe: 'amount per sale, by row and month' },
  claims_by_method: { sql: "SELECT id AS member, CAST(json_extract(value_json,'$.delta_pct') AS REAL) AS value, methodology_key AS f_methodology_key, evidence_grade AS f_grade FROM market_claims WHERE json_extract(value_json,'$.delta_pct') IS NOT NULL", filters: ['methodology_key', 'grade'], describe: 'percentage change per verified claim, by methodology and grade' },
  leases_by_kind: { sql: 'SELECT l.id AS member, l.uses AS value, r.kind AS f_kind, l.return_status AS f_return_status FROM market_leases l JOIN market_resources r ON r.id = l.resource_id', filters: ['kind', 'return_status'], describe: 'actions per lease, by resource kind and return status' },
};

export function makeMarketGovFnMap(deps) {
  const { dispatch, mintCapability, loadDirectory, logEvent, buildNowIso, getInvocation, revokeCapability, sendBlooio, market } = deps;
  const now = () => buildNowIso();
  async function ledger(env, key, action, request, response, status = 200) {
    try { return await logEvent(env, { source: 'market', key, action, direction: 'out', status, actor: actorOf(env), request, response }); } catch { return null; }
  }
  const parseOut = (r) => { let v = r?.result ?? r; if (typeof v === 'string') { const s = v.replace(/^ERR:[A-Z_]+ /, ''); try { return JSON.parse(s); } catch { return { raw: v }; } } return v || {}; };

  const MAP = {
    // ── A1 NODE_RECORD — record|read : this node's key, domain and subscribed facets ─────────
    async nodeRecord(env, raw) {
      const b = parseFields(raw, ['op', 'facets', 'note']);
      const op = String(b.op || 'read').toLowerCase();
      if (op === 'read') {
        const row = await env.DB.prepare('SELECT * FROM market_nodes ORDER BY updated_at DESC LIMIT 1').first().catch(() => null);
        if (!row) return err('NODE_RECORD_MISSING', 'no node record yet; the owner records one with NODE_RECORD record|<facets>');
        return ok({ node: { ...row, facets: j(row.facets_json, []), public_jwk: j(row.public_jwk_json, null) } });
      }
      if (!isOwnerCall(env)) return err('OWNER_ONLY', 'the node record is written by the owner');
      const priv = homePrivateJwk(env); if (!priv) return err('NODE_KEY_MISSING', 'no home signing key bound (OIP_HOME_KEY)');
      const pub = publicJwkFromPrivate(priv);
      let kernelHash = null; try { const g = await (await fetch(ORIGIN + '/api/governance')).json(); kernelHash = g?.core?.hash || null; } catch {}
      const facets = j(b.facets, ['execution-receipts', 'capability-authority', 'repair-lineage', 'federated-messages']);
      const t = now(); const id = 'node_' + (await sha256Hex(JSON.stringify(pub))).slice(0, 12);
      try {
        await env.DB.prepare('INSERT INTO market_nodes (id, domain, agent_id, public_jwk_json, facets_json, kernel_hash, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET facets_json = excluded.facets_json, kernel_hash = excluded.kernel_hash, note = excluded.note, updated_at = excluded.updated_at')
          .bind(id, homeDomain(env), homeAgentId(env), JSON.stringify(pub), JSON.stringify(facets), kernelHash, b.note || null, t, t).run();
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'NODE_RECORD', 'node_recorded', { id, domain: homeDomain(env), facets }, { kernel_hash: kernelHash });
      return ok({ node_id: id, domain: homeDomain(env), agent_id: homeAgentId(env), facets, kernel_hash: kernelHash, well_known: ORIGIN + '/.well-known/oip.json', ledger_event_id: ev });
    },

    // ── A2 PROFILE_MERGE — from_profile|into_profile|reason ─────────────────────────────────
    async profileMerge(env, raw) {
      if (!isOwnerCall(env)) return err('OWNER_ONLY', 'merging two profiles is an owner decision');
      const b = parseFields(raw, ['from', 'into', 'reason']);
      const from = String(b.from || '').trim(), into = String(b.into || '').trim();
      if (!from || !into || from === into) return err('BAD_REQUEST', 'from and into profile ids required and distinct');
      const [pf, pi] = await Promise.all([env.DB.prepare('SELECT * FROM traffic_profiles WHERE id = ?').bind(from).first(), env.DB.prepare('SELECT * FROM traffic_profiles WHERE id = ?').bind(into).first()]);
      if (!pf || !pi) return err('SESSION_NOT_FOUND', 'both profiles must exist');
      if (pf.merged_into) return err('BAD_REQUEST', `${from} was already merged into ${pf.merged_into}`);
      const t = now(); const moved = {};
      try {
        const upd = async (sql, ...binds) => { const r = await env.DB.prepare(sql).bind(...binds).run(); return r.meta?.changes ?? 0; };
        moved.identifiers = await upd('UPDATE OR IGNORE traffic_identifiers SET profile_id = ?, last_seen = ? WHERE profile_id = ?', into, t, from);
        moved.devices = await upd('UPDATE traffic_devices SET profile_id = ? WHERE profile_id = ?', into, from);
        moved.events = await upd('UPDATE traffic_events SET profile_id = ? WHERE profile_id = ?', into, from);
        moved.sales = await upd('UPDATE market_sales SET profile_id = ? WHERE profile_id = ?', into, from);
        moved.wants = await upd('UPDATE market_wants SET profile_id = ? WHERE profile_id = ?', into, from);
        moved.leases = await upd('UPDATE market_leases SET lessee_profile_id = ? WHERE lessee_profile_id = ?', into, from);
        try { moved.contexts = (await env.LEDGER.prepare('UPDATE capability_contexts SET profile_id = ?, updated_at = ?, updated_by = ? WHERE profile_id = ?').bind(into, t, 'merge', from).run()).meta?.changes ?? 0; } catch { moved.contexts = 'ledger_unreachable'; }
        const fromList = j(pi.merged_from_json, []); fromList.push(from);
        await env.DB.prepare('UPDATE traffic_profiles SET merged_into = ?, updated_at = ?, version = version + 1 WHERE id = ?').bind(into, t, from).run();
        await env.DB.prepare('UPDATE traffic_profiles SET merged_from_json = ?, known = 1, updated_at = ?, version = version + 1 WHERE id = ?').bind(JSON.stringify(fromList), t, into).run();
        try { await env.DB.prepare('INSERT INTO traffic_merge_log (id, tenant_id, from_profile_id, into_profile_id, reason, actor, moved_json, created_at) VALUES (?,?,?,?,?,?,?,?)').bind(newId('mrg'), 't_root', from, into, b.reason || null, actorOf(env), JSON.stringify(moved), t).run(); } catch {}
      } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'PROFILE_MERGE', 'profiles_merged', { from, into, reason: b.reason || null }, { moved });
      if (!ev) return err('LEDGER_WRITE_FAILED', 'merged but the ledger refused the receipt');
      return ok({ from, into, moved, ledger_event_id: ev });
    },

    // ── A8 WANT_EXECUTE — want_id : run the best match unattended when the mandate allows ────
    async wantExecute(env, raw) {
      const id = String(parseFields(raw, ['want_id']).want_id || '').trim();
      const W = await env.DB.prepare('SELECT * FROM market_wants WHERE id = ?').bind(id).first();
      if (!W) return err('WANT_NOT_FOUND', `no want ${id}`);
      if (!W.mandate_id) return err('NO_MANDATE', 'no mandate; nothing executes');
      if (!isOwnerCall(env) && presenterProfile(env) !== W.profile_id) return err('NOT_THE_BUYER', 'only the want\'s profile executes it');
      const M = await env.DB.prepare('SELECT * FROM market_mandates WHERE id = ?').bind(W.mandate_id).first();
      const S = await env.DB.prepare("SELECT * FROM market_solicitations WHERE want_id = ? AND mode = 'direct' ORDER BY created_at DESC LIMIT 1").bind(id).first();
      if (!S) return err('BAD_REQUEST', 'solicit the want directly first (WANT_SOLICIT direct)');
      const best = j(S.matches_json, {})?.best_match; if (!best) return err('NO_MATCH', 'no priced row matched the want');
      if (Number(best.price_cents) > Number(M.auto_execute_cents || 0)) return err('CONFIRMATION_REQUIRED', `${best.price_cents} cents is above the auto-execute threshold of ${M.auto_execute_cents} cents; the person confirms`);
      const allowed = j(M.allowed_actions_json, []); if (allowed.length && !allowed.includes(best.key)) return err('FORBIDDEN_ACTION', `${best.key} is not in the mandate's allowed actions`);
      // The buyer pays with a capability they already hold for that row; the run consumes one use.
      const caps = (await env.LEDGER.prepare(`SELECT c.fingerprint, c.max_uses, c.uses_consumed FROM capability_contexts x JOIN capabilities c ON c.fingerprint = x.fingerprint WHERE x.profile_id = ? AND c.row_key = ? AND c.revoked = 0 AND c.purpose LIKE 'paid:%' AND c.expires_at > ? ORDER BY c.ts DESC`).bind(W.profile_id, best.key, now()).all()).results || [];
      const cap = caps.find((c) => !c.max_uses || Number(c.uses_consumed || 0) < Number(c.max_uses));
      if (!cap) return err('NOT_A_BUYER', `the profile holds no live paid capability for ${best.key}; buy it first`, { row_key: best.key, price_cents: best.price_cents });
      const out = await dispatch(env, best.key, W.text, { actor: 'cap:' + cap.fingerprint });
      const invId = out?.invocation?.id || out?.proof?.invocation_id || null;
      try { await env.LEDGER.prepare('UPDATE capabilities SET uses_consumed = COALESCE(uses_consumed, 0) + 1 WHERE fingerprint = ?').bind(cap.fingerprint).run(); } catch {}
      try { await env.DB.prepare("UPDATE market_wants SET state = 'executed', updated_at = ? WHERE id = ?").bind(now(), id).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'WANT_EXECUTE', 'want_executed', { want_id: id, row_key: best.key, price_cents: best.price_cents, authority: 'agent-approved-under-mandate' }, { invocation_id: invId });
      return ok({ want_id: id, ran: best.key, invocation_id: invId, authority_grade: 'agent-approved-under-mandate', result: out?.result ?? out, ledger_event_id: ev });
    },

    // ── B9 LEASE_SWEEP — expire unclaimed reservations and overdue leases; free their resources ─
    async leaseSweep(env) {
      const t = now();
      const stale = (await env.DB.prepare("SELECT id, resource_id, state, fingerprint FROM market_leases WHERE state IN ('reserved','active') AND expires_at <= ?").bind(t).all()).results || [];
      const swept = [];
      for (const L of stale) {
        try {
          await env.DB.prepare("UPDATE market_leases SET state = 'expired', ended_at = ?, return_status = COALESCE(return_status, 'expired'), updated_at = ? WHERE id = ?").bind(t, t, L.id).run();
          await env.DB.prepare("UPDATE market_resources SET state = 'available', updated_at = ? WHERE id = ? AND state IN ('reserved','active')").bind(t, L.resource_id).run();
          if (L.fingerprint) await revokeCapability(env, L.fingerprint).catch(() => {});
          swept.push({ lease_id: L.id, was: L.state });
        } catch (e) { swept.push({ lease_id: L.id, error: e.message }); }
      }
      const ev = await ledger(env, 'LEASE_SWEEP', 'leases_swept', { at: t }, { swept });
      return ok({ swept, ledger_event_id: ev });
    },

    // ── C4 SETTLEMENT_SWEEP — completed tasks release their held settlements; refused ones queue a refund ─
    async settlementSweep(env) {
      const t = now();
      const held = (await env.DB.prepare("SELECT a.id AS agreement_id, a.task_id, a.settlement_id, a.provider_profile_id, s.state FROM market_agreements a JOIN market_settlements s ON s.id = a.settlement_id WHERE s.state = 'held'").all()).results || [];
      const moved = [];
      for (const A of held) {
        const task = await env.DB.prepare('SELECT state FROM work_tasks WHERE id = ?').bind(A.task_id).first().catch(() => null);
        if (!task) continue;
        if (task.state === 'completed') {
          await env.DB.prepare("UPDATE market_settlements SET state = 'released', finality_state = 'released_pending_payout', updated_at = ? WHERE id = ?").bind(t, A.settlement_id).run();
          await env.DB.prepare("UPDATE market_agreements SET state = 'completed' WHERE id = ?").bind(A.agreement_id).run();
          moved.push({ agreement_id: A.agreement_id, to: 'released' });
          await ledger(env, 'SETTLEMENT_RELEASE', 'settlement_released', { agreement_id: A.agreement_id, task_id: A.task_id }, { settlement_id: A.settlement_id });
        } else if (task.state === 'refused' || task.state === 'failed') {
          await env.DB.prepare("UPDATE market_settlements SET state = 'refund_pending', updated_at = ? WHERE id = ?").bind(t, A.settlement_id).run();
          await env.DB.prepare("UPDATE market_agreements SET state = 'refused' WHERE id = ?").bind(A.agreement_id).run();
          moved.push({ agreement_id: A.agreement_id, to: 'refund_pending', note: 'the refund itself is a Stripe write and waits on SETTLEMENT_REFUND with the owner phrase' });
          await ledger(env, 'SETTLEMENT_REFUND', 'refund_pending', { agreement_id: A.agreement_id, task_id: A.task_id }, { settlement_id: A.settlement_id }, 202);
        }
      }
      const ev = await ledger(env, 'SETTLEMENT_SWEEP', 'settlements_swept', { at: t, held: held.length }, { moved });
      return ok({ examined: held.length, moved, ledger_event_id: ev });
    },

    async settlementRefund(env, raw) {
      if (!isOwnerCall(env)) return err('OWNER_ONLY', 'refunds are the owner\'s');
      const b = parseFields(raw, ['settlement_id', 'confirm']);
      const S = await env.DB.prepare('SELECT * FROM market_settlements WHERE id = ?').bind(String(b.settlement_id || '')).first();
      if (!S) return err('SETTLEMENT_NOT_FOUND', `no settlement ${b.settlement_id}`);
      if (!/^go ahead/i.test(String(b.confirm || ''))) return err('STRIPE_WRITE_GATED', 'a refund is a Stripe write: put "go ahead and refund" in the second field', { law: 'LAW_002' });
      const sale = S.kind === 'sale' ? await env.DB.prepare('SELECT * FROM market_sales WHERE id = ?').bind(S.ref_id).first() : null;
      if (!sale?.stripe_session_id) { await env.DB.prepare("UPDATE market_settlements SET state = 'refunded_offline', updated_at = ? WHERE id = ?").bind(now(), S.id).run(); return ok({ settlement_id: S.id, state: 'refunded_offline', note: 'no Stripe payment behind this settlement; recorded as refunded' }); }
      if (!env.STRIPE_SECRET_KEY) return err('STRIPE_KEY_MISSING', 'no STRIPE_SECRET_KEY bound');
      const auth = { Authorization: 'Basic ' + btoa(String(env.STRIPE_SECRET_KEY) + ':'), 'Content-Type': 'application/x-www-form-urlencoded' };
      const sess = await (await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sale.stripe_session_id), { headers: auth })).json();
      if (!sess?.payment_intent) return err('STRIPE_REFUND_FAILED', 'the session names no payment intent');
      const r = await fetch('https://api.stripe.com/v1/refunds', { method: 'POST', headers: auth, body: new URLSearchParams({ payment_intent: String(sess.payment_intent) }).toString() });
      const body = await r.json();
      if (r.status !== 200) return err('STRIPE_REFUND_FAILED', JSON.stringify(body).slice(0, 300));
      await env.DB.prepare("UPDATE market_settlements SET state = 'refunded', updated_at = ? WHERE id = ?").bind(now(), S.id).run();
      await env.DB.prepare("UPDATE market_sales SET refund_status = 'refunded' WHERE id = ?").bind(sale.id).run();
      const ev = await ledger(env, 'SETTLEMENT_REFUND', 'refunded', { settlement_id: S.id, sale_id: sale.id }, { refund_id: body.id });
      return ok({ settlement_id: S.id, refund_id: body.id, ledger_event_id: ev });
    },

    // ── C2 WANT_DELIVER — solicitation_id|targets(csv phone/email/profile) : private delivery ─
    async wantDeliver(env, raw) {
      const b = parseFields(raw, ['solicitation_id', 'targets']);
      const S = await env.DB.prepare('SELECT * FROM market_solicitations WHERE id = ?').bind(String(b.solicitation_id || '')).first();
      if (!S) return err('SOLICITATION_NOT_FOUND', `no solicitation ${b.solicitation_id}`);
      const W = await env.DB.prepare('SELECT * FROM market_wants WHERE id = ?').bind(S.want_id).first();
      if (!isOwnerCall(env) && presenterProfile(env) !== W?.profile_id) return err('NOT_THE_BUYER', 'only the want\'s profile delivers its solicitation');
      const targets = j(b.targets, j(S.targets_json, []));
      if (!targets.length) return err('BAD_REQUEST', 'targets required: phones, emails or provider profile ids');
      const text = `A private solicitation on miscsubjects.com. Scope: ${S.scope}. Budget class: ${S.budget_class}. Evidence required: ${S.evidence_required}. Deadline: ${S.deadline || 'none'}. Answer with OFFER_NEW ${S.id}|<your profile>|<scope>|<method>|<price_usd>|<timing>|<evidence>|<human|ai|hybrid>|<authority_grade> — ${ORIGIN}/api/dispatch?key=OFFER_NEW`;
      const results = [];
      for (const tg of targets) {
        const target = String(tg).trim(); let channel = 'stored', status = 'stored', detail = null;
        if (/^\+?\d{10,15}$/.test(target.replace(/[\s-]/g, ''))) { channel = 'blooio_text'; try { const r = await sendBlooio(env, target, text); status = r && !String(r).startsWith('ERR') ? 'sent' : 'failed'; detail = status === 'failed' ? String(r).slice(0, 160) : null; } catch (e) { status = 'failed'; detail = e.message; } }
        else if (/@/.test(target)) { channel = 'email'; status = 'gated'; detail = 'email to a stranger waits on the mail law; stored for the owner to forward'; }
        try { await env.DB.prepare('INSERT INTO market_deliveries (id, solicitation_id, target, channel, status, detail, created_at) VALUES (?,?,?,?,?,?,?)').bind(newId('dlv'), S.id, target.replace(/\d(?=\d{4})/g, '*'), channel, status, detail, now()).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
        results.push({ target: target.replace(/\d(?=\d{4})/g, '*'), channel, status, detail });
      }
      const ev = await ledger(env, 'WANT_DELIVER', 'solicitation_delivered', { solicitation_id: S.id, targets: results.length }, { results });
      return ok({ solicitation_id: S.id, deliveries: results, ledger_event_id: ev });
    },

    // ── C6 OFFERS_RANK — solicitation_id : open offers ranked into a set under the buyer's trust policy ─
    async offersRank(env, raw) {
      const sid = String(parseFields(raw, ['solicitation_id']).solicitation_id || '').trim();
      const S = await env.DB.prepare('SELECT * FROM market_solicitations WHERE id = ?').bind(sid).first();
      if (!S) return err('SOLICITATION_NOT_FOUND', `no solicitation ${sid}`);
      const W = await env.DB.prepare('SELECT * FROM market_wants WHERE id = ?').bind(S.want_id).first();
      const policy = W ? await env.DB.prepare('SELECT * FROM market_trust_policies WHERE profile_id = ?').bind(W.profile_id).first().catch(() => null) : null;
      const minGrade = policy?.minimum_grade ? GRADES.indexOf(policy.minimum_grade) : -1;
      const maxAge = policy?.max_evidence_age_days ? Number(policy.max_evidence_age_days) : null;
      const offers = (await env.DB.prepare("SELECT * FROM market_offers WHERE solicitation_id = ? AND state = 'open' AND expires_at > ?").bind(sid, now()).all()).results || [];
      const scored = [];
      for (const o of offers) {
        const claims = (await env.DB.prepare("SELECT evidence_grade, state, created_at FROM market_claims WHERE provider_profile_id = ? AND state = 'verified'").bind(o.provider_profile_id).all()).results || [];
        const eligible = claims.filter((c) => (minGrade < 0 || GRADES.indexOf(c.evidence_grade) >= minGrade) && (!maxAge || (Date.now() - Date.parse(c.created_at)) <= maxAge * DAY * 1000));
        const disputes = (await env.DB.prepare("SELECT COUNT(*) n FROM market_challenges g JOIN market_claims c ON c.id = g.claim_id WHERE c.provider_profile_id = ? AND g.state = 'upheld'").bind(o.provider_profile_id).first())?.n || 0;
        const done = (await env.DB.prepare("SELECT COUNT(*) n, COUNT(DISTINCT buyer_profile_id) cp FROM market_agreements WHERE provider_profile_id = ? AND state = 'completed'").bind(o.provider_profile_id).first()) || {};
        scored.push({ offer_id: o.id, provider: o.provider_profile_id, price_cents: o.price_cents, composition: o.composition, timing: o.timing, verified_claims_eligible: eligible.length, upheld_disputes: Number(disputes), completed_agreements: Number(done.n || 0), counterparties: Number(done.cp || 0), trust_ok: eligible.length > 0 || !policy });
      }
      const trusted = scored.filter((s) => s.trust_ok);
      const set = { best_verified: [...trusted].sort((a, b2) => (b2.verified_claims_eligible - a.verified_claims_eligible) || (a.upheld_disputes - b2.upheld_disputes))[0] || null, cheapest_acceptable: [...trusted].sort((a, b2) => a.price_cents - b2.price_cents)[0] || null, fastest_acceptable: [...trusted].sort((a, b2) => String(a.timing || '').localeCompare(String(b2.timing || '')))[0] || null, excluded_by_trust_policy: scored.filter((s) => !s.trust_ok).map((s) => s.offer_id) };
      return ok({ solicitation_id: sid, policy: policy ? { minimum_grade: policy.minimum_grade, max_evidence_age_days: policy.max_evidence_age_days } : null, set, all: scored, note: 'a set, never one winner; payment does not move an offer into the trusted set' });
    },

    // ── D10 TRUST_POLICY_SET / GET ─────────────────────────────────────────────────────────────
    async trustPolicySet(env, raw) {
      const b = parseFields(raw, ['profile_id', 'minimum_grade', 'max_evidence_age_days', 'verifier_set', 'accepted_methods', 'conflict_policy', 'appeal_policy']);
      const pid = String(b.profile_id || presenterProfile(env) || '').trim(); if (!pid) return err('BAD_REQUEST', 'profile_id required');
      if (!isOwnerCall(env) && presenterProfile(env) !== pid) return err('NOT_THE_BUYER', 'a trust policy is set by its own profile');
      const grade = String(b.minimum_grade || 'method-reproducible'); if (!GRADES.includes(grade)) return err('BAD_REQUEST', `minimum_grade must be one of ${GRADES.join(', ')}`);
      const t = now();
      try { await env.DB.prepare('INSERT INTO market_trust_policies (profile_id, verifier_set_json, accepted_methods_json, minimum_grade, max_evidence_age_days, conflict_policy, appeal_policy, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(profile_id) DO UPDATE SET verifier_set_json = excluded.verifier_set_json, accepted_methods_json = excluded.accepted_methods_json, minimum_grade = excluded.minimum_grade, max_evidence_age_days = excluded.max_evidence_age_days, conflict_policy = excluded.conflict_policy, appeal_policy = excluded.appeal_policy, updated_at = excluded.updated_at').bind(pid, JSON.stringify(j(b.verifier_set, ['VERIFY_CLAIM'])), JSON.stringify(j(b.accepted_methods, [])), grade, Number(b.max_evidence_age_days) || 180, b.conflict_policy || 'a provider may not verify its own claim', b.appeal_policy || 'a governed panel', t, t).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'TRUST_POLICY_SET', 'trust_policy_recorded', { profile_id: pid, minimum_grade: grade, max_evidence_age_days: Number(b.max_evidence_age_days) || 180 }, { ok: true });
      return ok({ profile_id: pid, minimum_grade: grade, max_evidence_age_days: Number(b.max_evidence_age_days) || 180, ledger_event_id: ev });
    },
    async trustPolicyGet(env, raw) {
      const pid = String(parseFields(raw, ['profile_id']).profile_id || presenterProfile(env) || '').trim();
      const p = await env.DB.prepare('SELECT * FROM market_trust_policies WHERE profile_id = ?').bind(pid).first();
      if (!p) return err('TRUST_POLICY_MISSING', `no trust policy for ${pid}; the default accepts method-reproducible claims up to 180 days old`);
      return ok({ policy: { ...p, verifier_set: j(p.verifier_set_json, []), accepted_methods: j(p.accepted_methods_json, []) } });
    },

    // ── D8 CLAIM_PANEL — challenge_id : three seats across two families judge the dispute; the seal resolves it ─
    async claimPanel(env, raw) {
      if (!isOwnerCall(env)) return err('OWNER_ONLY', 'the panel is convened by the owner or the dispute automation');
      const gid = String(parseFields(raw, ['challenge_id']).challenge_id || '').trim();
      const G = await env.DB.prepare('SELECT * FROM market_challenges WHERE id = ?').bind(gid).first();
      if (!G) return err('CHALLENGE_NOT_FOUND', `no challenge ${gid}`);
      if (G.state !== 'open') return err('CHALLENGE_STATE', `challenge is ${G.state}`);
      const C = await env.DB.prepare('SELECT * FROM market_claims WHERE id = ?').bind(G.claim_id).first();
      const recompute = parseOut(await dispatch(env, 'VERIFY_CLAIM', C.id, { actor: 'owner:panel:' + gid }));
      const brief = `CLAIM: ${C.statement}\nMETHODOLOGY: ${C.methodology_key} v${C.methodology_version}\nVALUE: ${C.value_json}\nEVIDENCE RECEIPTS: ${C.evidence_receipts_json}\nRECOMPUTE: ${JSON.stringify(recompute).slice(0, 600)}\nCHALLENGE: ${G.evidence}\nQUESTION: Does the challenge defeat the claim as stated under its methodology? Answer with exactly one word first, UPHOLD or REJECT, then one sentence.`;
      const seats = ['ADJUDICATE_GLM_52', 'ADJUDICATE_KIMI_K27', 'ADJUDICATE_ADVERSARY_GLM52'];
      const answers = [];
      for (const seat of seats) {
        const r = await dispatch(env, seat, seat.includes('ADVERSARY') ? `RULESET: CPC_DELTA_V1 methodology as published | RULESET_HASH: ${C.dataset_commitment} | CLAIM: ${C.statement} | SOURCE: receipts ${C.evidence_receipts_json} | MAJORITY: pending | MODEL_TARGET: @cf/zai-org/glm-5.2 | ${brief}` : brief, { actor: 'owner:panel:' + gid }).catch((e) => ({ result: 'ERR:' + e.message }));
        const text = String(r?.result ?? r ?? '');
        const verdict = /\bUPHOLD\b/i.test(text) ? 'uphold' : /\bREJECT\b|\bDENY\b/i.test(text) ? 'reject' : /\bAFFIRM\b/i.test(text) ? 'reject' : 'cannot_conclude';
        answers.push({ seat, verdict, text: text.slice(0, 400), invocation_id: r?.invocation?.id || null });
      }
      const votes = answers.filter((a) => !a.seat.includes('ADVERSARY'));
      const up = votes.filter((a) => a.verdict === 'uphold').length, rj = votes.filter((a) => a.verdict === 'reject').length;
      const converged = up !== rj && votes.every((a) => a.verdict !== 'cannot_conclude');
      const sealed = converged ? (up > rj ? 'upheld' : 'rejected') : null;
      const ev = await ledger(env, 'CLAIM_PANEL', sealed ? 'panel_sealed' : 'panel_refused_to_seal', { challenge_id: gid, claim_id: C.id, seats }, { answers, sealed, recompute_result: recompute?.result || recompute?.error });
      if (!sealed) return err('PANEL_NO_SEAL', 'the seats did not converge; the challenge stays open for a human', { challenge_id: gid, answers, ledger_event_id: ev });
      const res = parseOut(await dispatch(env, 'CLAIM_RESOLVE', `${gid}|${sealed}|panel: ${votes.map((v) => v.seat + '=' + v.verdict).join(', ')}; adversary: ${answers.find((a) => a.seat.includes('ADVERSARY'))?.verdict}`, { actor: 'owner:panel:' + gid }));
      return ok({ challenge_id: gid, sealed, answers, resolution: res, ledger_event_id: ev });
    },

    // ── H6 CAP_EVALUATE — fingerprint|profile_id|device_id|session_id|key : the decision, without executing ─
    async capEvaluate(env, raw) {
      const b = parseFields(raw, ['fingerprint', 'profile_id', 'device_id', 'session_id', 'key']);
      const fp = String(b.fingerprint || '').trim(); if (!fp) return err('BAD_REQUEST', 'fingerprint required');
      const cap = await env.LEDGER.prepare('SELECT * FROM capabilities WHERE fingerprint = ?').bind(fp).first().catch(() => null);
      if (!cap) return err('CAPABILITY_NOT_FOUND', `no capability ${fp}`);
      if (!isOwnerCall(env) && env?.TRACE_CTX?.authContext?.capFingerprint !== fp) return err('OWNER_ONLY', 'a token is simulated by its holder or the owner');
      const presenter = { profile_id: b.profile_id || null, device_id: b.device_id || null, session_id: b.session_id || null };
      const x = await explainContext(env, cap, presenter);
      const authority = { live: !cap.revoked && cap.expires_at > now(), revoked: !!cap.revoked, expires_at: cap.expires_at, scope: cap.scope, uses_left: cap.max_uses ? Number(cap.max_uses) - Number(cap.uses_consumed || 0) : 'unlimited' };
      const keyOk = !b.key || cap.scope === 'act' || cap.scope === 'row:' + String(b.key).toUpperCase() || (cap.scope.startsWith('rows:') && cap.scope.slice(5).split(',').includes(String(b.key).toUpperCase()));
      return ok({ fingerprint: fp, authority, scope_allows_key: keyOk, context: x, would: authority.live && keyOk && (x?.decision?.decision !== 'deny') ? 'allow' : 'deny', note: 'nothing executed and no nonce consumed' });
    },

    // ── H5 DECISION_GET — id : one authorization decision as an addressable object ────────────
    async decisionGet(env, raw) {
      const id = String(parseFields(raw, ['id']).id || '').replace(/^decision:\/\//, '').trim();
      let row; try { row = await env.LEDGER.prepare("SELECT id, ts, key, status, request_json, response_json FROM events WHERE id = ? AND action = 'context_decision'").bind(id).first(); } catch (e) { return err('LEDGER_LOOKUP_FAILED', 'the ledger did not answer', { detail: e.message }); }
      if (!row) return err('DECISION_NOT_FOUND', `no decision ${id}`);
      const d = j(row.response_json, {}); const rq = j(row.request_json, {});
      const full = isOwnerCall(env);
      return ok({ decision: 'decision://' + row.id, at: row.ts, key: row.key, status: row.status, outcome: d.decision, code: d.code, checks: full ? d.checks : (d.checks || []).map((c) => ({ check: c.check, ok: c.ok })), detail: full ? d.detail : null, policy_rev: d.policy_rev, decision_hash: d.decision_hash, presenter: full ? rq.presenter : undefined });
    },

    // ── H7 PANIC_REVOKE — profile|device|session : end every token in a tree at once ────────────
    async panicRevoke(env, raw) {
      if (!isOwnerCall(env)) return err('OWNER_ONLY', 'the panic switch is the owner\'s');
      const b = parseFields(raw, ['kind', 'id', 'reason']);
      const kind = String(b.kind || '').toLowerCase(), id = String(b.id || '').trim();
      if (!['profile', 'device', 'session'].includes(kind) || !id) return err('BAD_REQUEST', 'kind (profile|device|session) and id required');
      const col = kind === 'profile' ? 'profile_id = ?' : kind === 'device' ? 'device_ids_json LIKE ?' : 'session_ids_json LIKE ?';
      const bind = kind === 'profile' ? id : '%"' + id + '"%';
      const ctxs = (await env.LEDGER.prepare(`SELECT fingerprint FROM capability_contexts WHERE ${col}`).bind(bind).all()).results || [];
      const revoked = [];
      for (const c of ctxs) { try { await revokeCapability(env, c.fingerprint); revoked.push(c.fingerprint); } catch {} }
      const t = now(); let leases = 0, devices = 0;
      if (kind === 'profile') {
        leases = (await env.DB.prepare("UPDATE market_leases SET state = 'ended', ended_at = ?, return_status = 'revoked', updated_at = ? WHERE lessee_profile_id = ? AND state IN ('reserved','active')").bind(t, t, id).run()).meta?.changes || 0;
        devices = (await env.DB.prepare("UPDATE traffic_devices SET trusted = 0, revoked_at = ?, trust_reason = ? WHERE profile_id = ? AND revoked_at IS NULL").bind(t, 'PANIC_REVOKE: ' + (b.reason || 'owner'), id).run()).meta?.changes || 0;
      } else if (kind === 'device') {
        devices = (await env.DB.prepare("UPDATE traffic_devices SET trusted = 0, revoked_at = ?, trust_reason = ? WHERE id = ? AND revoked_at IS NULL").bind(t, 'PANIC_REVOKE: ' + (b.reason || 'owner'), id).run()).meta?.changes || 0;
      }
      const ev = await ledger(env, 'PANIC_REVOKE', 'tree_revoked', { kind, id, reason: b.reason || null }, { tokens_revoked: revoked.length, leases_ended: leases, devices_revoked: devices });
      return ok({ kind, id, tokens_revoked: revoked, leases_ended: leases, devices_revoked: devices, staleness: 'contexts and capabilities are read from the ledger on every call; there is no cache to age', ledger_event_id: ev });
    },

    // ── G2 AGGREGATE_QUERY — buyer|dataset|filters_json : an aggregate over at least five members, under a budget ─
    async aggregateQuery(env, raw) {
      const b = parseFields(raw, ['buyer', 'dataset', 'filters']);
      const buyer = String(b.buyer || presenterProfile(env) || actorOf(env)).trim();
      const ds = DATASETS[String(b.dataset || '')]; if (!ds) return err('DATASET_UNKNOWN', `datasets: ${Object.keys(DATASETS).join(', ')}`);
      const filters = j(b.filters, {}); const bad = Object.keys(filters).filter((k) => !ds.filters.includes(k)); if (bad.length) return err('BAD_REQUEST', `filters allowed: ${ds.filters.join(', ')}`);
      const fingerprint = 'sha256:' + await sha256Hex(b.dataset + '|' + JSON.stringify(Object.entries(filters).sort()));
      // Budget: ten distinct queries per buyer per dataset; a repeated fingerprint is free.
      const bud = await env.DB.prepare('SELECT * FROM market_privacy_budgets WHERE buyer = ? AND dataset = ?').bind(buyer, b.dataset).first();
      const seen = await env.DB.prepare('SELECT id FROM market_aggregate_queries WHERE buyer = ? AND fingerprint = ? AND refused IS NULL').bind(buyer, fingerprint).first();
      if (!seen && bud && Number(bud.spent) >= Number(bud.budget)) return err('PRIVACY_BUDGET_SPENT', `budget of ${bud.budget} distinct queries on ${b.dataset} is spent`);
      const rows = (await env.DB.prepare(ds.sql).all()).results || [];
      const members = rows.filter((r) => Object.entries(filters).every(([k, v]) => String(r['f_' + k]) === String(v)));
      const memberIds = members.map((m) => String(m.member)).sort();
      const t = now(); const qid = newId('agq');
      const record = async (refused, result) => { try { await env.DB.prepare('INSERT INTO market_aggregate_queries (id, buyer, dataset, fingerprint, filters_json, cohort_size, cohort_hash, members_json, result_json, refused, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(qid, buyer, b.dataset, fingerprint, JSON.stringify(filters), memberIds.length, 'sha256:' + await sha256Hex(memberIds.join(',')), JSON.stringify(memberIds), result ? JSON.stringify(result) : null, refused, t).run(); } catch {} };
      if (memberIds.length < MIN_COHORT) { await record('COHORT_TOO_SMALL', null); return err('COHORT_TOO_SMALL', `the cohort has ${memberIds.length} members; the minimum is ${MIN_COHORT}`); }
      // Overlap: a prior answered cohort that differs from this one by fewer than MIN_COHORT members would let a subtraction isolate someone.
      const prior = (await env.DB.prepare('SELECT members_json FROM market_aggregate_queries WHERE buyer = ? AND dataset = ? AND refused IS NULL AND fingerprint != ?').bind(buyer, b.dataset, fingerprint).all()).results || [];
      for (const p of prior) { const pm = new Set(j(p.members_json, [])); const cur = new Set(memberIds); const diff = [...cur].filter((x) => !pm.has(x)).length + [...pm].filter((x) => !cur.has(x)).length; if (diff > 0 && diff < MIN_COHORT) { await record('OVERLAP_REFUSED', null); return err('OVERLAP_REFUSED', `this cohort differs from an earlier answered cohort by ${diff} member(s); the difference would isolate them`); } }
      const vals = members.map((m) => Number(m.value)).filter(Number.isFinite).sort((a, c) => a - c);
      const sum = vals.reduce((a, c) => a + c, 0); const median = vals.length ? vals[Math.floor(vals.length / 2)] : null;
      const result = { dataset: b.dataset, describe: ds.describe, filters, cohort: memberIds.length, sum: +sum.toFixed(2), mean: vals.length ? +(sum / vals.length).toFixed(2) : null, median, min: vals[0] ?? null, max: vals[vals.length - 1] ?? null };
      await record(null, result);
      if (!seen) { try { await env.DB.prepare('INSERT INTO market_privacy_budgets (buyer, dataset, budget, spent, updated_at) VALUES (?,?,?,1,?) ON CONFLICT(buyer, dataset) DO UPDATE SET spent = spent + 1, updated_at = excluded.updated_at').bind(buyer, b.dataset, 10, t).run(); } catch {} }
      const after = await env.DB.prepare('SELECT budget, spent FROM market_privacy_budgets WHERE buyer = ? AND dataset = ?').bind(buyer, b.dataset).first();
      const ev = await ledger(env, 'AGGREGATE_QUERY', 'aggregate_answered', { buyer, dataset: b.dataset, fingerprint, cohort: memberIds.length }, { result, budget: after });
      return ok({ query_id: qid, result, budget: after, note: 'members are hashed and never returned', ledger_event_id: ev });
    },

    async holdRecord(env, raw) {
      const b = parseFields(raw, ['kind', 'ref_id', 'party', 'amount_usd', 'confirm']);
      const kind = String(b.kind || '').toLowerCase(); if (!['bond', 'escrow'].includes(kind)) return err('BAD_REQUEST', 'kind is bond or escrow');
      if (!b.ref_id) return err('BAD_REQUEST', 'ref_id (challenge or agreement) required');
      const amount = cents(b.amount_usd); if (!amount) return err('BAD_REQUEST', 'amount_usd required');
      const id = newId('hold'); const t = now();
      let state = 'recorded_offline', providerRef = null;
      if (/^go ahead/i.test(String(b.confirm || '')) && isOwnerCall(env)) {
        if (!env.STRIPE_SECRET_KEY) return err('STRIPE_KEY_MISSING', 'no STRIPE_SECRET_KEY bound');
        const auth = { Authorization: 'Basic ' + btoa(String(env.STRIPE_SECRET_KEY) + ':'), 'Content-Type': 'application/x-www-form-urlencoded' };
        const r = await fetch('https://api.stripe.com/v1/payment_intents', { method: 'POST', headers: auth, body: new URLSearchParams({ amount: String(amount), currency: 'usd', capture_method: 'manual', 'metadata[kind]': kind, 'metadata[ref_id]': String(b.ref_id) }).toString() });
        const body = await r.json(); if (r.status !== 200) return err('STRIPE_HOLD_FAILED', JSON.stringify(body).slice(0, 300));
        state = 'authorization_pending_card'; providerRef = body.id;
      }
      try { await env.DB.prepare('INSERT INTO market_holds (id, kind, ref_id, party, amount_cents, rail, provider_ref, state, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id, kind, String(b.ref_id), b.party || presenterProfile(env) || null, amount, providerRef ? 'stripe' : 'none', providerRef, state, t, t).run(); } catch (e) { return err('DURABLE_WRITE_FAILED', e.message); }
      const ev = await ledger(env, 'HOLD_RECORD', 'hold_recorded', { id, kind, ref_id: b.ref_id, amount_cents: amount }, { state, provider_ref: providerRef });
      return ok({ hold_id: id, kind, amount_cents: amount, state, provider_ref: providerRef, note: state === 'recorded_offline' ? 'recorded; the card authorization is a Stripe write and waits on the owner phrase "go ahead and hold"' : 'a manual-capture payment intent exists; the payer completes it on the card', ledger_event_id: ev });
    },
  };
  return tierDenials(MAP);
}
