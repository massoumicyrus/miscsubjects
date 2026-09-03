// Race-proof invoke idempotency claim (D1 INSERT OR IGNORE).
// KV get→fire→put races: parallel identical calls all miss, all fire.
// Claim BEFORE dispatch; loser returns the winner's inv_ id without firing.

const CREATE_SQL = `CREATE TABLE IF NOT EXISTS invoke_idem (
  k TEXT PRIMARY KEY,
  inv_id TEXT NOT NULL,
  ts TEXT NOT NULL
)`;

let _tableReady = false;

async function ensureTable(env) {
  if (_tableReady || !env?.LEDGER) return;
  try {
    await env.LEDGER.prepare(CREATE_SQL).run();
    _tableReady = true;
  } catch {
    /* table may already exist on another isolate */
  }
}

/** @returns {{ claimed: boolean, invId: string|null } | null} null = claim path unavailable */
export async function claimIdem(env, idemKey, provisionalInvId, windowMs) {
  if (!env?.LEDGER || !idemKey || !provisionalInvId) return null;
  await ensureTable(env);
  const nowIso = new Date().toISOString();
  const win = Number(windowMs) || 1000;
  try {
    const r = await env.LEDGER.prepare(
      "INSERT OR IGNORE INTO invoke_idem (k, inv_id, ts) VALUES (?, ?, ?)",
    )
      .bind(String(idemKey), String(provisionalInvId), nowIso)
      .run();
    if ((r.meta?.changes || 0) > 0) {
      return { claimed: true, invId: String(provisionalInvId) };
    }
    // changes === 0 means a claim ALREADY EXISTS on the primary. Read it back to dedupe. D1 read
    // replicas can lag the just-written row by a fraction of a second, so a null read here is
    // replica lag, NOT proof the row is stale — retry briefly before deciding anything.
    let row = await env.LEDGER.prepare("SELECT inv_id, ts FROM invoke_idem WHERE k = ?")
      .bind(String(idemKey))
      .first();
    for (let i = 0; i < 3 && !row; i++) {
      await new Promise((res) => setTimeout(res, 120));
      row = await env.LEDGER.prepare("SELECT inv_id, ts FROM invoke_idem WHERE k = ?")
        .bind(String(idemKey))
        .first();
    }
    const ageMs = row?.ts ? (Date.now() - Date.parse(row.ts)) : Infinity;
    // Inside the burst window this is a duplicate of the live fire — dedupe to its receipt.
    if (row && Number.isFinite(ageMs) && ageMs <= win) {
      return { claimed: false, invId: row.inv_id ? String(row.inv_id) : null };
    }
    // Fail SAFE for an idempotency guard: a claim provably exists (changes === 0) but we still
    // cannot read it after retries — do NOT re-fire on a guess. Only take the row over when it is
    // POSITIVELY stale (a real timestamp older than the window). An unreadable row is treated as a
    // live duplicate: dedupe with a null target rather than double-fire a possibly-destructive call.
    if (!row) {
      return { claimed: false, invId: null };
    }
    // Window has passed — the row is positively stale. Take it over and fire again; never a long bar.
    try {
      await env.LEDGER.prepare("UPDATE invoke_idem SET inv_id = ?, ts = ? WHERE k = ?")
        .bind(String(provisionalInvId), nowIso, String(idemKey))
        .run();
    } catch { /* ignore */ }
    return { claimed: true, invId: String(provisionalInvId) };
  } catch {
    return null;
  }
}

/** After fire: stamp the real inv_ id (if different) and mirror into KV for fast path. */
export async function finalizeIdem(env, idemKey, invId, ttlSec) {
  if (!idemKey || !invId) return;
  // Stamp the REAL receipt id, but keep the window measured from the ORIGINAL claim: preserve
  // the stored timestamp so a same-burst duplicate still reads the correct age. Store "invId|ts".
  if (env?.LEDGER) {
    try {
      await env.LEDGER.prepare("UPDATE invoke_idem SET inv_id = ? WHERE k = ?")
        .bind(String(invId), String(idemKey))
        .run();
    } catch { /* ignore */ }
  }
  if (env?.KV) {
    try {
      const existing = await env.KV.get(String(idemKey));
      const bar = existing ? String(existing).indexOf('|') : -1;
      const ts = bar >= 0 ? String(existing).slice(bar + 1) : String(Date.now());
      await env.KV.put(String(idemKey), String(invId) + '|' + ts, {
        expirationTtl: Math.max(60, Number(ttlSec) || 60),
      });
    } catch { /* ignore */ }
  }
}
