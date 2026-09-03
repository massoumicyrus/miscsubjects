// GET /api/invocations — OIP invocation events (yield, waste, trace).
// Read-tier gated (terminal key / admin cookie / ?share= read-or-act token); schema stays public.
import { invocationStats, listInvocations } from "../_lib/invocation_log.js";
import { INVOCATION_EVENT_SCHEMA, OIP_VERSION } from "../_lib/object_contract.js";
import { isBuildAuthed, verifyShareToken, getCapabilityByNonce, isOwnerTenant } from "../_lib/admin_session.js";

// Owner sees the whole ledger. A delegated capability sees only invocations whose actor is
// that capability fingerprint; a root/unbound token never falls through to owner-wide data.
async function callerScope(request, env) {
  if (await isBuildAuthed(request, env)) return { owner: true, actor: null, tenant_id: null };
  try {
    const tok = await verifyShareToken(request, env);
    if (!tok?.nonce) return null;
    const cap = await getCapabilityByNonce(env, tok.nonce);
    if (!cap) return null;
    return {
      owner: false,
      actor: "cap:" + cap.fingerprint,
      tenant_id: !isOwnerTenant(cap.tenant_id) ? cap.tenant_id : null,
    };
  } catch {}
  return null;
}

const BASE = "https://miscsubjects.com";

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const p = new URL(request.url).searchParams;
  if (p.get("schema") === "invocation") {
    return json({ protocol: "OIP", version: OIP_VERSION, schema: INVOCATION_EVENT_SCHEMA });
  }
  const caller = await callerScope(request, env);
  // Outside-model audit 2026-08-04: a bare 404/401 here read as "the supposedly public
  // ledger is closed" — a thesis contradiction. The per-actor list stays credentialed
  // (it can include private turns), but the unauthenticated answer is now the map to the
  // genuinely public record, not a dead end.
  if (!caller) {
    return json({
      what: 'Per-actor invocation lists require a credential (they can contain private operator turns). The PUBLIC record is open without one:',
      public_record: {
        any_receipt: 'https://miscsubjects.com/receipt/<invocation id> — every inv_ id resolves keylessly',
        chain_head: 'https://miscsubjects.com/api/chain/head — the hash-chained ledger head, with the verify recipe',
        anchors: 'https://miscsubjects.com/api/anchor — each anchor with its drand round and Bitcoin block, verify-yourself URLs inline',
        per_article: 'https://miscsubjects.com/api/articles/<slug>/invocations — the invocations of one public object',
      },
      get_a_credential: 'https://miscsubjects.com/start mints a bounded one keylessly, if your operator asked you to act here.',
    }, 200);
  }
  if (p.get("stats") === "1" || p.get("stats") === "24h") {
    const hours = p.get("hours") || 24;
    return json({
      protocol: "OIP",
      version: OIP_VERSION,
      ledger_scope: caller.owner ? "owner" : caller.actor,
      stats: await invocationStats(env, hours, caller.tenant_id, caller.actor),
    });
  }
  const data = await listInvocations(env, {
    trace_id: p.get("trace_id"),
    object_id: p.get("object_id"),
    actor: caller.owner ? p.get("actor") : caller.actor,
    material: p.get("material"),
    waste: p.get("waste"),
    slug: p.get("slug"),
    limit: p.get("limit"),
    tenant_id: caller.tenant_id,
  });
  return json({
    protocol: "OIP",
    version: OIP_VERSION,
    ledger_scope: caller.owner ? "owner" : caller.actor,
    ...data,
    observe: {
      dispatch: BASE + "/api/dispatch",
      registry: BASE + "/api/dispatch?registry=1",
      ledger: BASE + "/api/ledger",
    },
  });
}
