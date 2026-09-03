// R2-backed append-only revisions.
//
// Every article write snapshots the prior head into meta.revisions[] (cont 17 append-only law).
// A snapshot carries the full body + claims + sources, so meta.revisions[] grows ~135KB per write
// and D1 rejects the row at its 2,000,000-byte per-value cap (SQLITE_TOOBIG).
//
// Fix: the heavy snapshot body lives in R2 (bucket binding env.R2); D1 keeps only a lightweight,
// hash-chain-verifiable index entry per revision. The append-only guarantee is preserved — nothing
// is erased, the full prior head is still retrievable at ?rev=n — but the D1 row stays small no
// matter how many times an article is rewritten.

const PREFIX = "revisions/";
function r2Key(slug, n) { return `${PREFIX}${slug}/${n}.json`; }

// A revision entry is "fat" (legacy inline storage in D1) if it still carries the heavy fields.
export function isFatRevision(r) {
  return !!r && (typeof r.body === "string" || Array.isArray(r.claims) || Array.isArray(r.sources));
}

// Write the full snapshot to R2 and return the slim index entry kept in D1 meta.revisions[].
// The slim entry preserves the hash chain (hash + prev_hash) so chain verification still works
// from D1 alone; the heavy content is fetched from R2 only when a specific revision is read.
// If no R2 binding is present (e.g. a test env), the full snapshot is returned unchanged so
// behavior matches the legacy inline path.
export async function offloadRevision(env, slug, snap) {
  const full = {
    n: snap.n,
    ts: snap.ts,
    title: snap.title,
    body: snap.body || "",
    claims: snap.claims || [],
    sources: snap.sources || [],
    register: snap.register || null,
    status: snap.status || "published",
    meta: snap.meta && typeof snap.meta === "object" ? snap.meta : {},
    prev_hash: snap.prev_hash || "genesis",
    hash: snap.hash,
  };
  if (!env || !env.R2) return full;
  const key = r2Key(slug, snap.n);
  await env.R2.put(key, JSON.stringify(full), { httpMetadata: { contentType: "application/json" } });
  return {
    n: full.n,
    ts: full.ts,
    title: full.title,
    hero: full.meta.hero || null,
    status: full.status,
    register: full.register,
    bytes: full.body.length,
    prev_hash: full.prev_hash,
    hash: full.hash,
    r2_key: key,
  };
}

// Migrate any inline (fat) revisions in meta.revisions[] to R2, leaving slim index entries in place.
// Idempotent: already-slim entries are skipped. Returns the number of entries migrated.
// Called at the top of pushRevision so any write heals a bloated article before adding to it.
export async function migrateRevisions(env, slug, meta) {
  const revs = Array.isArray(meta.revisions) ? meta.revisions : [];
  let migrated = 0;
  for (let i = 0; i < revs.length; i++) {
    if (!isFatRevision(revs[i])) continue;
    const r = revs[i];
    if (typeof r.n !== "number") r.n = i;
    revs[i] = await offloadRevision(env, slug, r);
    migrated++;
  }
  meta.revisions = revs;
  return migrated;
}

// Load the full content of a revision index entry (fetched from R2). Falls back to the inline
// entry for legacy/unmigrated revisions, or to the slim entry if R2 is unavailable.
export async function loadRevision(env, slug, entry) {
  if (isFatRevision(entry)) return entry;
  if (env && env.R2 && entry && entry.r2_key) {
    const obj = await env.R2.get(entry.r2_key);
    if (obj) {
      try { return JSON.parse(await obj.text()); } catch { /* fall through to slim entry */ }
    }
  }
  return entry;
}
