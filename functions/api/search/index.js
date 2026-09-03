// /api/search — one query across everything the build holds.
//
//   GET  /api/search?q=durable+objects&limit=10   -> ranked hits with a snippet
//   POST /api/search {"reindex":"article","offset":0}  -> rebuild one kind of the index
//
// Public on the read: a corpus nobody outside can search is a corpus nobody can check.
import { searchCorpus, reindex, ensureIndex, FTS_TABLE } from '../../_lib/sheet_search.js';
import { isBuildAuthed } from '../../_lib/admin_session.js';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
               'access-control-allow-origin': '*' },
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || url.searchParams.get('query') || '';
  if (!q.trim()) {
    return json({
      _self: {
        schema: 'miscsubjects/search/1',
        what: 'Full-text search over the articles and the tool directory in one index.',
        usage: 'GET /api/search?q=<words>&limit=10',
        index: FTS_TABLE,
        note: 'A phrase is matched as its words, not as an operator expression — the characters '
            + 'FTS5 treats as operators are stripped before the query is built.',
      },
      hits: [],
    });
  }
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);
  const hits = await searchCorpus(env, q, limit);
  return json({ q, count: hits.length, hits });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isBuildAuthed(request, env))) return json({ error: 'unauthorized' }, 401);
  let b = {};
  try { b = await request.json(); } catch {}
  await ensureIndex(env);
  if (!b.reindex) return json({ error: 'reindex_required', kinds: ['article', 'directory'] }, 422);
  const out = await reindex(env, String(b.reindex), parseInt(b.limit, 10) || 400, parseInt(b.offset, 10) || 0);
  return json(out);
}
