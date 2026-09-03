// Append OIP invocation events to LEDGER invocations table.
import { buildInvocationEvent } from "./object_contract.js";
import { redactPublicSecrets } from './public_secret_guard.js';
import { bindCandidatesToInvocation } from './execution_case.js';

import { buildNowIso, buildSinceIso } from './build_time.js';
export async function logInvocation(env, opts) {
  if (!env?.LEDGER) return null;
  const o = opts || {};
  let inv =
    o.invocation ||
    await buildInvocationEvent({
      id: o.id,
      trace_id: o.trace_id,
      object_id: o.object_id,
      row: o.row,
      actor: o.actor,
      input: redactPublicSecrets(o.input, env),
      result: redactPublicSecrets(o.result, env),
      cost_usd: o.cost_usd,
      event_id: o.event_id,
      replay_of: o.replay_of,
      repairs: o.repairs,
    });
  inv = redactPublicSecrets(inv, env);
  if (o.replay_of && !inv.replay_of) inv.replay_of = o.replay_of;
  if (o.repairs && !inv.repairs) inv.repairs = o.repairs;
  try {
    await env.LEDGER.prepare(
      `INSERT INTO invocations
       (id, ts, trace_id, object_id, object_type, runner, actor, material, waste,
        tokens_in, tokens_out, cost_usd, material_outputs, event_id, invocation_json,
        replay_of, repairs, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        inv.id,
        inv.ts,
        inv.trace_id,
        inv.object_id,
        inv.object_type,
        inv.runner,
        inv.actor,
        inv.material ? 1 : 0,
        inv.waste ? 1 : 0,
        inv.yield?.tokens_in || 0,
        inv.yield?.tokens_out || 0,
        inv.yield?.cost_usd || 0,
        inv.yield?.material_outputs || 0,
        inv.event_id,
        JSON.stringify(inv),
        inv.replay_of || null,
        inv.repairs || null,
        o.tenant_id || null,
      )
      .run();
    // A runner that returned task-bound candidate ids gets those rows stamped with this
    // receipt id — the row the ledger just wrote is the receipt they resolve to.
    try { await bindCandidatesToInvocation(env, inv.id, o.result, buildNowIso()); } catch {}
    return inv.id;
  } catch {
    return null;
  }
}

/** Tenant balance + status, from the LEDGER tenants table. Null when the tenant is unknown. */
export async function tenantBalance(env, tenantId) {
  if (!env?.LEDGER || !tenantId) return null;
  try {
    return await env.LEDGER.prepare('SELECT tenant_id, status, balance_usd FROM tenants WHERE tenant_id = ?')
      .bind(String(tenantId)).first();
  } catch { return null; }
}

/** One charge row per billable invocation (minimum proof, 2026-07-28).
 *  Reads units/meter_unit/object_ids from the runner's result JSON, prices them at the
 *  directory row's price_usd, inserts the charge, and debits the tenant balance.
 *  No tenant, no price, or zero units → no charge (owner and untenanted calls stay free). */
export async function recordChargeFromResult(env, { row, tenant_id, invocation_id, trace_id, cost_usd, result }) {
  if (!env?.LEDGER || !tenant_id || !row) return null;
  const unitPrice = Number(row.price_usd || 0);
  if (!(unitPrice > 0)) return null;
  let j = null;
  try { j = JSON.parse(String(result || '')); } catch { return null; }
  const units = Math.max(0, Math.floor(Number(j?.units || 0)));
  if (!units) return null;
  const price = Math.round(units * unitPrice * 1e6) / 1e6;
  const id = 'ch_' + (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 20) : Math.random().toString(36).slice(2, 14));
  const refs = Array.isArray(j?.object_ids) ? JSON.stringify(j.object_ids.slice(0, 500)) : null;
  try {
    await env.LEDGER.prepare(
      'INSERT INTO charges (id, ts, tenant_id, invocation_id, trace_id, capability, units, meter_unit, cost_usd, price_usd, object_refs, outcome) VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL)',
    ).bind(id, buildNowIso(), String(tenant_id), invocation_id || null, trace_id || null, String(row.key || ''),
      units, row.meter_unit || j?.meter_unit || null, Number(cost_usd || 0), price, refs).run();
    await env.LEDGER.prepare('UPDATE tenants SET balance_usd = ROUND(COALESCE(balance_usd,0) - ?, 6) WHERE tenant_id = ?')
      .bind(price, String(tenant_id)).run();
    return { id, units, meter_unit: row.meter_unit || j?.meter_unit || null, price_usd: price, cost_usd: Number(cost_usd || 0) };
  } catch {
    return null;
  }
}

/** One invocation row by inv_ id — full row including invocation_json and lineage. */
export async function getInvocation(env, id) {
  if (!env?.LEDGER || !id) return null;
  try {
    return await env.LEDGER.prepare("SELECT * FROM invocations WHERE id = ?").bind(String(id)).first();
  } catch {
    return null;
  }
}

/** Reverse link: stamp repaired_by on the old invocation when a repair lands. */
export async function linkRepairedBy(env, repairedId, byId) {
  if (!env?.LEDGER || !repairedId || !byId) return false;
  try {
    await env.LEDGER.prepare("UPDATE invocations SET repaired_by = ? WHERE id = ?")
      .bind(String(byId), String(repairedId))
      .run();
    return true;
  } catch {
    return false;
  }
}

/** Rolling invocation stats for ops dashboards. */
export async function invocationStats(env, hours = 24, tenantId = null, actor = null) {
  if (!env?.LEDGER) return { error: "LEDGER binding missing" };
  const h = Math.min(Math.max(Number(hours) || 24, 1), 168);
  const since = buildSinceIso(h);
  try {
    const binds = [since];
    let tenantClause = "";
    if (tenantId) { tenantClause = " AND tenant_id = ?"; binds.push(String(tenantId)); }
    if (actor) { tenantClause += " AND actor = ?"; binds.push(String(actor)); }
    const row = await env.LEDGER.prepare(
      "SELECT COUNT(*) AS n, SUM(material) AS material, SUM(waste) AS waste, " +
        "SUM(cost_usd) AS cost, SUM(tokens_in) AS ti, SUM(tokens_out) AS to_ " +
        "FROM invocations WHERE ts >= ?" + tenantClause,
    )
      .bind(...binds)
      .first();
    const count = Number(row?.n || 0);
    const material = Number(row?.material || 0);
    const waste = Number(row?.waste || 0);
    const cost = Number(row?.cost || 0);
    const tokens = Number(row?.ti || 0) + Number(row?.to_ || 0);
    return {
      since,
      hours: h,
      count,
      material,
      waste,
      material_rate: count ? Math.round((material / count) * 1000) / 1000 : null,
      waste_rate: count ? Math.round((waste / count) * 1000) / 1000 : null,
      cost_usd: Math.round(cost * 1e6) / 1e6,
      tokens_total: tokens,
      observe: {
        waste: "https://miscsubjects.com/api/invocations?waste=1",
        invocations: "https://miscsubjects.com/api/invocations",
      },
    };
  } catch (e) {
    return { error: String(e?.message || e), since, hours: h };
  }
}

export async function listInvocations(env, params = {}) {
  if (!env?.LEDGER) return { error: "LEDGER binding missing", invocations: [] };
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 500);
  const where = [];
  const binds = [];
  if (params.trace_id) {
    where.push("trace_id = ?");
    binds.push(String(params.trace_id));
  }
  if (params.object_id) {
    where.push("object_id = ?");
    binds.push(String(params.object_id));
  }
  if (params.actor) {
    where.push("actor = ?");
    binds.push(String(params.actor));
  }
  if (params.material === "1" || params.material === "true") {
    where.push("material = 1");
  }
  if (params.waste === "1" || params.waste === "true") {
    where.push("waste = 1");
  }
  if (params.slug) {
    where.push("invocation_json LIKE ?");
    binds.push('%"slug":"' + String(params.slug).replace(/"/g, "") + '"%');
  }
  // Tenant isolation: a tenant-scoped caller sees ONLY its own invocations. Owner plane
  // (tenant_id null) passes no filter and sees all. Fulfils 0215's "read ONLY its own ledger".
  if (params.tenant_id) {
    where.push("tenant_id = ?");
    binds.push(String(params.tenant_id));
  }
  const sql =
    "SELECT id, ts, trace_id, object_id, object_type, runner, actor, material, waste, " +
    "tokens_in, tokens_out, cost_usd, material_outputs, event_id, replay_of, repairs, repaired_by FROM invocations " +
    (where.length ? "WHERE " + where.join(" AND ") + " " : "") +
    "ORDER BY ts DESC LIMIT ?";
  binds.push(limit);
  try {
    const r = await env.LEDGER.prepare(sql).bind(...binds).all();
    const rows = r.results || [];
    let total_cost = 0;
    let total_material = 0;
    let total_waste = 0;
    for (const row of rows) {
      total_cost += Number(row.cost_usd || 0);
      if (row.material) total_material++;
      if (row.waste) total_waste++;
    }
    return {
      count: rows.length,
      limit,
      summary: {
        total_cost_usd: Math.round(total_cost * 1e6) / 1e6,
        material_count: total_material,
        waste_count: total_waste,
      },
      invocations: rows.map((row) => ({
        ...row,
        material: !!row.material,
        waste: !!row.waste,
        links: {
          receipt: "https://miscsubjects.com/api/dispatch?receipt=" + encodeURIComponent(row.id),
          trace: row.trace_id
            ? "https://miscsubjects.com/api/invocations?trace_id=" + encodeURIComponent(row.trace_id)
            : null,
          event: row.event_id
            ? "https://miscsubjects.com/api/events/" + row.event_id
            : null,
          object: "https://miscsubjects.com/api/dispatch?key=" + encodeURIComponent(row.object_id),
        },
      })),
    };
  } catch (e) {
    return { error: String(e?.message || e), invocations: [] };
  }
}
