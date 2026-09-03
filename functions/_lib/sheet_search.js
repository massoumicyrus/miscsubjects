// FULL-TEXT SEARCH OVER THE WHOLE CORPUS.
//
// The build holds 2,354 articles, 10,389 claims, 7,802 sources and 976 tool definitions, and
// until now finding anything in it meant already knowing where it was. That is why CloudflareOS
// carries a hand-built FILE TREE and RepoMap: indexes existed because search did not.
//
// D1 ships FTS5, so this is an index and a query rather than a product. The index is external
// content: it stores only what is needed to rank and locate, and the row itself stays in its own
// table. Rebuilding it is therefore always safe.
export const FTS_TABLE = 'corpus_fts';

const SOURCES = [
  { kind: 'article',   sql: "SELECT slug AS ref, COALESCE(title,'') AS title, COALESCE(body,'') AS body FROM articles" },
  { kind: 'directory', sql: "SELECT key AS ref, key AS title, COALESCE(content,'') AS body FROM directory" },
];

export async function ensureIndex(env) {
  await env.DB.prepare(
    `CREATE VIRTUAL TABLE IF NOT EXISTS ${FTS_TABLE} USING fts5(kind, ref, title, body, tokenize='porter unicode61')`,
  ).run();
  return true;
}

// Rebuild one kind at a time so a single call never runs long. Returns how many rows it indexed.
export async function reindex(env, kind, limit = 400, offset = 0) {
  await ensureIndex(env);
  const src = SOURCES.find((s) => s.kind === kind);
  if (!src) return { error: 'unknown_kind', kinds: SOURCES.map((s) => s.kind) };
  if (offset === 0) {
    await env.DB.prepare(`DELETE FROM ${FTS_TABLE} WHERE kind = ?`).bind(kind).run();
  }
  const q = await env.DB.prepare(`${src.sql} LIMIT ? OFFSET ?`).bind(limit, offset).all();
  const rows = q.results || [];
  for (const row of rows) {
    await env.DB.prepare(
      `INSERT INTO ${FTS_TABLE} (kind, ref, title, body) VALUES (?,?,?,?)`,
    ).bind(kind, String(row.ref || ''), String(row.title || ''),
           String(row.body || '').slice(0, 40000)).run();
  }
  return { kind, indexed: rows.length, offset, done: rows.length < limit };
}

// FTS5 treats several characters as operators. A person typing a phrase means the phrase.
function safeQuery(q) {
  const cleaned = String(q || '').replace(/["*:^-]/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/).map((t) => '"' + t + '"').join(' ');
}

export async function searchCorpus(env, q, limit = 10) {
  const match = safeQuery(q);
  if (!match) return [];
  try {
    const rows = await env.DB.prepare(
      `SELECT kind, ref, title, snippet(${FTS_TABLE}, 3, '[', ']', '…', 12) AS snippet, rank ` +
      `FROM ${FTS_TABLE} WHERE ${FTS_TABLE} MATCH ? ORDER BY rank LIMIT ?`,
    ).bind(match, Math.max(1, Math.min(100, limit))).all();
    return rows.results || [];
  } catch (e) {
    // an absent index is a real answer, not a crash: it says to build it
    return [{ kind: 'error', ref: 'index', title: String(e && e.message || e).slice(0, 160), snippet: '' }];
  }
}
