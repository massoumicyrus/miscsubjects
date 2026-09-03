// WORKSPACE OBJECT (owner order 2026-08-03: "ship this as a new type of working thing").
// A workspace is a first-class object on the existing grammar: it IS an article whose
// meta.extra.workspace block declares members, roles, the capability pool, policies, the
// contained work objects and their lineage, and the receipted mutation log. Nothing here
// is a second architecture — tokens are the same signed share tokens, receipts land on the
// same ledger, objects are the same articles, and the human view is the same page.
//
// The one real authority change lives here: a pool:<workspace>:<role> token resolves AT
// EXERCISE TIME to the rows the workspace declares for that role, bounded to the
// workspace's own object set for slug-bearing mutations. Authority follows the work.

export function parseWorkspace(metaRaw) {
  let meta = metaRaw;
  if (typeof meta === 'string') { try { meta = JSON.parse(meta || '{}'); } catch { meta = {}; } }
  const ws = meta?.extra?.workspace;
  if (!ws || typeof ws !== 'object') return null;
  return ws;
}

export async function loadWorkspace(env, slug) {
  const row = await env.DB.prepare('SELECT slug,title,body,meta FROM articles WHERE slug=?')
    .bind(String(slug || '').toLowerCase()).first();
  if (!row) return { error: 'workspace_not_found', slug };
  const ws = parseWorkspace(row.meta);
  if (!ws) return { error: 'not_a_workspace', slug, note: 'The article exists but declares no meta.extra.workspace block.' };
  return { article: row, ws };
}

// The rows a role may invoke. A role must be declared; an undeclared role gets nothing.
export function roleGrant(ws, role) {
  const r = ws?.roles?.[String(role || '').toLowerCase()];
  if (!r || typeof r !== 'object') return null;
  return {
    rows: Array.isArray(r.rows) ? r.rows.map((k) => String(k || '').toUpperCase()).filter(Boolean) : [],
    ops: Array.isArray(r.ops) ? r.ops.map((o) => String(o || '').toLowerCase()).filter(Boolean) : [],
    public: !!r.public,
  };
}

// Resolve a verified pool token against its workspace: fills rowKeys with the role's
// declared rows and pins the object set for slug-bound mutation keys. Fail closed — any
// missing piece leaves the token allowing nothing.
export async function resolvePoolToken(env, tokenInfo) {
  if (!tokenInfo || tokenInfo.scope !== 'pool' || !tokenInfo.pool) return tokenInfo;
  const loaded = await loadWorkspace(env, tokenInfo.pool.workspace);
  if (loaded.error) { tokenInfo.rowKeys = []; tokenInfo.poolError = loaded.error; return tokenInfo; }
  const grant = roleGrant(loaded.ws, tokenInfo.pool.role);
  if (!grant) { tokenInfo.rowKeys = []; tokenInfo.poolError = 'role_not_declared'; return tokenInfo; }
  tokenInfo.rowKeys = grant.rows;
  tokenInfo.poolObjects = [String(tokenInfo.pool.workspace), ...(Array.isArray(loaded.ws.objects) ? loaded.ws.objects.map(String) : [])];
  tokenInfo.poolOps = grant.ops;
  return tokenInfo;
}

// Slug-bearing mutation bodies must stay inside the workspace's object set. Applies to any
// invocation whose JSON body names a slug — the pool grants rows against the POOL'S work,
// never account-wide. Returns { ok } or { ok:false, reason, slug }.
export function poolObjectBoundary(tokenInfo, bodyArg) {
  if (!tokenInfo || tokenInfo.scope !== 'pool' || !Array.isArray(tokenInfo.poolObjects)) return { ok: true };
  let parsed = null;
  try { parsed = JSON.parse(String(bodyArg || '')); } catch { return { ok: true }; }
  const slug = parsed && typeof parsed === 'object' ? String(parsed.slug || '') : '';
  if (!slug) return { ok: true };
  if (tokenInfo.poolObjects.includes(slug)) return { ok: true };
  return { ok: false, reason: 'pool_object_boundary', slug };
}

// THE MUTATION CONTRACT (demo-minimum by design, 2026-08-03): a structural change to the
// workspace is a REQUEST evaluated against the workspace's declared policy — the role's
// op list. In-policy → APPROVED and applied; out-of-policy → DENIED and recorded. Both
// outcomes are receipts. Verbs beyond these get added when a real workspace demands them,
// not before.
export const MUTATION_OPS = Object.freeze(['add-object', 'propose-repair', 'file-objection']);

export function evaluateMutation(ws, role, op) {
  const grant = roleGrant(ws, role);
  if (!grant) return { decision: 'DENIED', reason: 'role_not_declared_in_workspace' };
  const wanted = String(op || '').toLowerCase();
  if (!MUTATION_OPS.includes(wanted)) {
    return { decision: 'DENIED', reason: 'op_not_in_mutation_contract', contract: MUTATION_OPS };
  }
  if (!grant.ops.includes(wanted)) {
    return { decision: 'DENIED', reason: 'op_outside_role_authority', role_ops: grant.ops };
  }
  return { decision: 'APPROVED', reason: 'op_within_declared_role_authority' };
}

// Append a mutation record to the workspace object (capped) and return the stored entry.
export async function appendMutation(env, slug, entry) {
  const row = await env.DB.prepare('SELECT meta FROM articles WHERE slug=?').bind(slug).first();
  if (!row) return null;
  let meta = {}; try { meta = JSON.parse(row.meta || '{}'); } catch {}
  const ws = meta?.extra?.workspace;
  if (!ws || typeof ws !== 'object') return null;
  ws.mutations = (Array.isArray(ws.mutations) ? ws.mutations : []).slice(-199);
  ws.mutations.push(entry);
  if (entry.decision === 'APPROVED' && entry.op === 'add-object' && entry.target) {
    ws.objects = Array.isArray(ws.objects) ? ws.objects : [];
    if (!ws.objects.includes(entry.target)) ws.objects.push(entry.target);
    if (entry.detail && entry.detail.derives_from) {
      ws.lineage = Array.isArray(ws.lineage) ? ws.lineage : [];
      ws.lineage.push({ from: String(entry.detail.derives_from), to: String(entry.target), rel: 'derives' });
    }
  }
  meta.extra = { ...(meta.extra || {}), workspace: ws };
  await env.DB.prepare('UPDATE articles SET meta=? WHERE slug=?').bind(JSON.stringify(meta), slug).run();
  return entry;
}
