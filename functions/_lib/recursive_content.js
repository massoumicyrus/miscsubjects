// Recursive Content — one canonical block, any number of article references.
//
// `articles.body` remains the compatibility/render projection. Block-native writes start here,
// append a version, update the reference graph, and materialize every affected article in the same
// D1 batch. Whole-body writes are detected by body_hash and losslessly re-wrapped on the next graph
// read or corpus backfill. Similar text is never merged automatically: reuse is always an explicit
// insert-reference act.

import { isOipArticleSlug, rawOipArticleBody } from './oip_articles.js';

const te = new TextEncoder();

// SHARED ARTICLE RESOLVER — a wrappable article is one in the `articles` table OR a virtual
// OIP article (oip-tap-go and every other slug served from the oip_articles/primer layer).
// The block store keys content_blocks and article_block_refs by slug string, not by a foreign
// key into `articles`, so a virtual OIP article can be wrapped and edited without an `articles`
// row — and it must NOT get one, because /a/<oip-slug> renders through its own OIP path and an
// `articles` row would shadow that render. WF-0004: /api/blocks/article/oip-tap-go returned
// article_not_found because both readers below hit `articles` only.
async function loadWrappableArticle(env, slug) {
  const row = await first(env, 'SELECT slug,title,body,meta,published,updated_at FROM articles WHERE slug=?', slug);
  if (row) return row;
  if (isOipArticleSlug(slug)) {
    const oip = await rawOipArticleBody(env, slug);
    if (oip && typeof oip.body === 'string' && oip.body.length) {
      return { slug, title: oip.title || slug, body: oip.body, meta: null, published: 1, updated_at: nowIso() };
    }
  }
  return null;
}

const COLLABORATION_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|messages?|rules?)/i,
  /(?:system|developer|assistant)\s+(?:prompt|message|instructions?)/i,
  /(?:reveal|show|print|return|repeat|expose)\s+(?:the\s+)?(?:system|developer|hidden|internal)\s+(?:prompt|message|instructions?)/i,
  /(?:override|bypass|disable|discard)\s+(?:the\s+)?(?:system|developer|safety|policy|instructions?|rules?)/i,
  /you\s+are\s+now\s+(?:in\s+)?(?:developer|admin|system|unrestricted)\s+mode/i,
  /(?:jailbreak|prompt\s*injection|developer\s*mode|system\s*override)/i,
  /(?:exfiltrate|steal|leak|send|upload)\b.{0,80}\b(?:api\s*key|terminal\s*key|secret|password|token|cookie|authorization\s*header)/i,
  /(?:api\s*key|terminal\s*key|secret\s*key|password|bearer\s*token|authorization\s*header|session\s*cookie)\b.{0,80}\b(?:reveal|show|print|return|send|upload|exfiltrate|steal|leak)/i,
  /<\/?(?:script|iframe|object|embed|style|meta|link)\b/i,
  /(?:javascript|data)\s*:/i,
  /(?:[A-Za-z0-9+/]{80,}={0,2}|\b[0-9a-f]{120,}\b)/i,
];

export function unsafeCollaborationText(value) {
  const source = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const text = String(source || '').normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, '');
  const pattern = COLLABORATION_INJECTION_PATTERNS.find((candidate) => candidate.test(text));
  return pattern ? { unsafe: true, error: 'unsafe_collaboration_text', rule: String(pattern) } : { unsafe: false };
}

export async function contentHash(content) {
  const bytes = await crypto.subtle.digest('SHA-256', te.encode(String(content ?? '')));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function importedBlockId(slug, sourceId, originalContent) {
  return 'rb_' + (await contentHash(`recursive-content/import/1\n${slug}\n${sourceId}\n${originalContent}`)).slice(0, 24);
}

async function derivedBlockId(seed) {
  return 'rb_' + (await contentHash(`recursive-content/derived/1\n${seed}\n${Date.now()}\n${crypto.randomUUID()}`)).slice(0, 24);
}

// Every separator belongs to the reference before it. This makes arbitrary blank-line runs and a
// terminal newline round-trip exactly without putting article-specific whitespace into a shared block.
export function atomizeLosslessly(body) {
  const source = String(body ?? '');
  if (!source) return [];
  const out = [];
  const re = /\n{2,}/g;
  let start = 0;
  let match;
  while ((match = re.exec(source))) {
    out.push({ content: source.slice(start, match.index), separator_after: match[0] });
    start = match.index + match[0].length;
  }
  out.push({ content: source.slice(start), separator_after: '' });
  return out;
}

export function normalizePositions(refs) {
  return (refs || []).map((ref, position) => ({ ...ref, position }));
}

export function composeBlockRefs(refs) {
  return (refs || [])
    .slice()
    .sort((a, b) => Number(a.position || 0) - Number(b.position || 0))
    .map((ref) => String(ref.content ?? '') + String(ref.separator_after ?? ''))
    .join('');
}

export function splitBlockContent(content, splitAt, separatorAfter = '') {
  const text = String(content ?? '');
  const at = Number(splitAt);
  if (!Number.isInteger(at) || at <= 0 || at >= text.length) {
    throw new Error('split point must be inside the block');
  }
  return {
    left: { content: text.slice(0, at), separator_after: '' },
    right: { content: text.slice(at), separator_after: String(separatorAfter ?? '') },
  };
}

function parseMeta(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function nowIso() { return new Date().toISOString(); }

function statement(env, sql, ...bindings) {
  return env.DB.prepare(sql).bind(...bindings);
}

async function all(env, sql, ...bindings) {
  return ((await statement(env, sql, ...bindings).all()).results || []);
}

async function first(env, sql, ...bindings) {
  return statement(env, sql, ...bindings).first();
}

function activeLegacyAtoms(article) {
  const meta = parseMeta(article.meta);
  const divs = (Array.isArray(meta.divs) ? meta.divs : [])
    .filter((d) => String(d.status || 'active') === 'active')
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  if (!divs.length) return null;
  const atoms = divs.map((d, i) => ({
    source_id: String(d.id || `d${i + 1}`),
    content: String(d.text ?? ''),
    separator_after: i === divs.length - 1 ? '' : '\n\n',
  }));
  return composeBlockRefs(normalizePositions(atoms)) === String(article.body || '') ? atoms : null;
}

async function bodyAtoms(article) {
  const legacy = activeLegacyAtoms(article);
  if (legacy) return legacy;
  return atomizeLosslessly(article.body).map((atom, i) => ({ ...atom, source_id: `body:${i + 1}` }));
}

async function eventStmt(env, { op, actor, articleSlug = null, blockId = null, detail = {} }) {
  return statement(env,
    `INSERT INTO content_block_events(op,actor,article_slug,block_id,detail_json,created_at)
     VALUES(?,?,?,?,?,?)`,
    op, String(actor || 'unknown'), articleSlug, blockId, JSON.stringify(detail), nowIso());
}

export async function articleBlockGraph(env, slug, { ensure = true, actor = 'system:read-wrap' } = {}) {
  if (ensure) await ensureArticleWrapped(env, slug, actor);
  const article = await loadWrappableArticle(env, slug);
  if (!article) return null;
  const refs = await all(env,
    `SELECT r.article_slug,r.position,r.block_id,r.separator_after,r.created_at AS referenced_at,
            b.content,b.content_hash,b.current_version,b.created_at,b.updated_at,b.retired_at,
            (SELECT COUNT(*) FROM article_block_refs rr WHERE rr.block_id=b.id) AS reference_count,
            (SELECT COUNT(*) FROM content_block_comments c WHERE c.block_id=b.id) AS comment_count,
            (SELECT COUNT(*) FROM content_block_verdicts v WHERE v.block_id=b.id) AS verdict_count
      FROM article_block_refs r JOIN content_blocks b ON b.id=r.block_id
      WHERE r.article_slug=? ORDER BY r.position`, slug);
  const commentTotal = await first(env,
    `SELECT COUNT(*) AS n FROM content_block_comments c
      WHERE EXISTS (SELECT 1 FROM article_block_refs r WHERE r.article_slug=? AND r.block_id=c.block_id)`, slug);
  return {
    schema: 'miscsubjects/recursive-content/1',
    slug: article.slug,
    title: article.title,
    body_hash: await contentHash(article.body || ''),
    blocks: refs,
    comment_count: Number(commentTotal?.n || 0),
    composed_body_matches: composeBlockRefs(refs) === String(article.body || ''),
    human_url: `https://miscsubjects.com/a/${encodeURIComponent(slug)}`,
    machine_url: `https://miscsubjects.com/api/blocks/article/${encodeURIComponent(slug)}`,
    procedure: recursiveContentProcedure(slug),
  };
}

export async function ensureArticleWrapped(env, slug, actor = 'system:wrap') {
  const article = await loadWrappableArticle(env, slug);
  if (!article) return { ok: false, status: 404, error: 'article_not_found', slug };
  const bodyHash = await contentHash(article.body || '');
  const doc = await first(env, 'SELECT body_hash FROM article_block_documents WHERE article_slug=?', slug);
  const refCount = await first(env, 'SELECT COUNT(*) AS n FROM article_block_refs WHERE article_slug=?', slug);
  if (doc?.body_hash === bodyHash && Number(refCount?.n || 0) > 0) {
    return { ok: true, idempotent: true, slug, body_hash: bodyHash, blocks: Number(refCount.n) };
  }

  const atoms = await bodyAtoms(article);
  const ts = nowIso();
  const stmts = [statement(env, 'DELETE FROM article_block_refs WHERE article_slug=?', slug)];
  let position = 0;
  for (const atom of atoms) {
    const id = await importedBlockId(slug, atom.source_id, atom.content);
    const hash = await contentHash(atom.content);
    stmts.push(statement(env,
      `INSERT OR IGNORE INTO content_blocks(id,content,content_hash,current_version,created_at,updated_at)
       VALUES(?,?,?,1,?,?)`, id, atom.content, hash, ts, ts));
    stmts.push(statement(env,
      `INSERT OR IGNORE INTO content_block_versions(block_id,version,content,content_hash,actor,operation,created_at)
       VALUES(?,1,?,?,?,'import',?)`, id, atom.content, hash, actor, ts));
    stmts.push(statement(env,
      `INSERT INTO article_block_refs(article_slug,position,block_id,separator_after,created_at)
       VALUES(?,?,?,?,?)`, slug, position++, id, atom.separator_after, ts));
  }
  stmts.push(statement(env,
    `INSERT INTO article_block_documents(article_slug,body_hash,wrapped_at,updated_at)
     VALUES(?,?,?,?) ON CONFLICT(article_slug) DO UPDATE SET body_hash=excluded.body_hash,updated_at=excluded.updated_at`,
    slug, bodyHash, ts, ts));
  stmts.push(await eventStmt(env, { op: doc ? 'rewrap' : 'wrap', actor, articleSlug: slug, detail: { blocks: atoms.length, body_hash: bodyHash } }));
  await env.DB.batch(stmts);
  return { ok: true, idempotent: false, slug, body_hash: bodyHash, blocks: atoms.length };
}

async function refsForArticles(env, slugs) {
  const out = new Map();
  for (const slug of slugs) {
    const refs = await all(env,
      `SELECT r.position,r.block_id,r.separator_after,b.content,b.content_hash,b.current_version
         FROM article_block_refs r JOIN content_blocks b ON b.id=r.block_id
        WHERE r.article_slug=? ORDER BY r.position`, slug);
    out.set(slug, refs);
  }
  return out;
}

async function materializationStatements(env, refsBySlug, ts = nowIso()) {
  const stmts = [];
  for (const [slug, refs] of refsBySlug) {
    const body = composeBlockRefs(refs);
    const hash = await contentHash(body);
    stmts.push(statement(env, 'UPDATE articles SET body=?,updated_at=? WHERE slug=?', body, ts, slug));
    stmts.push(statement(env,
      `INSERT INTO article_block_documents(article_slug,body_hash,wrapped_at,updated_at)
       VALUES(?,?,?,?) ON CONFLICT(article_slug) DO UPDATE SET body_hash=excluded.body_hash,updated_at=excluded.updated_at`,
      slug, hash, ts, ts));
  }
  return stmts;
}

export async function editBlock(env, { blockId, content, expectedHash, actor }) {
  const block = await first(env, 'SELECT * FROM content_blocks WHERE id=?', blockId);
  if (!block) return { ok: false, status: 404, error: 'block_not_found' };
  if (block.retired_at) return { ok: false, status: 409, error: 'block_retired', block };
  if (!expectedHash || expectedHash !== block.content_hash) {
    return { ok: false, status: 409, error: 'hash_stale', current: block };
  }
  const nextContent = String(content ?? '');
  if (nextContent === block.content) return { ok: false, status: 422, error: 'no_change' };
  const nextHash = await contentHash(nextContent);
  const nextVersion = Number(block.current_version) + 1;
  const affected = (await all(env, 'SELECT DISTINCT article_slug FROM article_block_refs WHERE block_id=?', blockId)).map((r) => r.article_slug);
  const refsBySlug = await refsForArticles(env, affected);
  for (const refs of refsBySlug.values()) for (const ref of refs) {
    if (ref.block_id === blockId) Object.assign(ref, { content: nextContent, content_hash: nextHash, current_version: nextVersion });
  }
  const ts = nowIso();
  const stmts = [
    statement(env, 'UPDATE content_blocks SET content=?,content_hash=?,current_version=?,updated_at=? WHERE id=? AND content_hash=?', nextContent, nextHash, nextVersion, ts, blockId, expectedHash),
    statement(env, `INSERT INTO content_block_versions(block_id,version,content,content_hash,actor,operation,created_at) VALUES(?,?,?,?,?,'edit',?)`, blockId, nextVersion, nextContent, nextHash, actor, ts),
    ...(await materializationStatements(env, refsBySlug, ts)),
    await eventStmt(env, { op: 'edit', actor, blockId, detail: { from_hash: expectedHash, to_hash: nextHash, version: nextVersion, affected_articles: affected } }),
  ];
  await env.DB.batch(stmts);
  return { ok: true, block_id: blockId, version: nextVersion, content_hash: nextHash, affected_articles: affected, human_urls: affected.map((slug) => `https://miscsubjects.com/a/${encodeURIComponent(slug)}#block-${blockId}`) };
}

async function rewriteArticleOrder(env, slug, refs, actor, op, detail = {}) {
  const normalized = normalizePositions(refs);
  const ts = nowIso();
  const stmts = [statement(env, 'DELETE FROM article_block_refs WHERE article_slug=?', slug)];
  for (const ref of normalized) stmts.push(statement(env,
    `INSERT INTO article_block_refs(article_slug,position,block_id,separator_after,created_at) VALUES(?,?,?,?,?)`,
    slug, ref.position, ref.block_id, ref.separator_after || '', ref.referenced_at || ts));
  const full = await refsForArticles(env, []);
  // The refs passed here already carry content. Materialize from them before the batch replaces rows.
  full.set(slug, normalized);
  stmts.push(...(await materializationStatements(env, full, ts)));
  stmts.push(await eventStmt(env, { op, actor, articleSlug: slug, blockId: detail.block_id || null, detail }));
  await env.DB.batch(stmts);
  return normalized;
}

export async function moveArticleBlock(env, { slug, blockId, expectedPosition, direction, toPosition, actor }) {
  await ensureArticleWrapped(env, slug, actor);
  const graph = await articleBlockGraph(env, slug, { ensure: false });
  const refs = graph.blocks.map((r) => ({ ...r }));
  const from = refs.findIndex((r) => r.block_id === blockId && Number(r.position) === Number(expectedPosition));
  if (from < 0) return { ok: false, status: 409, error: 'order_stale', current: graph.blocks.map((r) => ({ block_id: r.block_id, position: r.position })) };
  let target = Number.isInteger(Number(toPosition)) ? Number(toPosition) : from + (direction === 'up' ? -1 : 1);
  target = Math.max(0, Math.min(refs.length - 1, target));
  if (target === from) return { ok: false, status: 422, error: 'no_change' };
  const [moved] = refs.splice(from, 1); refs.splice(target, 0, moved);
  await rewriteArticleOrder(env, slug, refs, actor, 'move', { block_id: blockId, from, to: target });
  return { ok: true, slug, block_id: blockId, from, to: target, human_url: `https://miscsubjects.com/a/${encodeURIComponent(slug)}#block-${blockId}` };
}

function selectedContiguousRange(graph, selections) {
  const requested = Array.isArray(selections) ? selections : [];
  if (requested.length < 2) return { ok: false, status: 422, error: 'multiple_selection_required' };
  const positions = requested.map((item) => Number(item.expected_position)).sort((a, b) => a - b);
  if (positions.some((position, index) => !Number.isInteger(position) || (index && position !== positions[index - 1] + 1))) {
    return { ok: false, status: 422, error: 'selection_must_be_contiguous' };
  }
  const refs = positions.map((position) => graph.blocks[position]);
  for (let i = 0; i < refs.length; i++) {
    const selected = requested.find((item) => Number(item.expected_position) === positions[i]);
    const ref = refs[i];
    if (!ref || ref.block_id !== selected?.block_id || (selected.expected_hash && ref.content_hash !== selected.expected_hash)) {
      return { ok: false, status: 409, error: 'selection_stale', current: graph.blocks };
    }
  }
  return { ok: true, start: positions[0], refs };
}

export async function moveArticleBlockGroup(env, { slug, selections, direction, toPosition, actor }) {
  await ensureArticleWrapped(env, slug, actor);
  const graph = await articleBlockGraph(env, slug, { ensure: false });
  const selected = selectedContiguousRange(graph, selections);
  if (!selected.ok) return selected;
  const refs = graph.blocks.map((ref) => ({ ...ref }));
  const group = refs.splice(selected.start, selected.refs.length);
  let target = Number.isInteger(Number(toPosition))
    ? Number(toPosition)
    : selected.start + (direction === 'up' ? -1 : 1);
  target = Math.max(0, Math.min(refs.length, target));
  if (target === selected.start) return { ok: false, status: 422, error: 'no_change' };
  refs.splice(target, 0, ...group);
  await rewriteArticleOrder(env, slug, refs, actor, 'move-group', {
    block_ids: group.map((ref) => ref.block_id), from: selected.start, to: target,
  });
  return { ok: true, slug, block_ids: group.map((ref) => ref.block_id), from: selected.start, to: target, human_url: `https://miscsubjects.com/a/${encodeURIComponent(slug)}#block-${group[0].block_id}` };
}

export async function mergeArticleBlocks(env, { slug, selections, actor }) {
  await ensureArticleWrapped(env, slug, actor);
  const graph = await articleBlockGraph(env, slug, { ensure: false });
  const selected = selectedContiguousRange(graph, selections);
  if (!selected.ok) return selected;
  const last = selected.refs[selected.refs.length - 1];
  const content = selected.refs.map((ref, index) => ref.content + (index === selected.refs.length - 1 ? '' : ref.separator_after)).join('');
  const blockId = await derivedBlockId(`${slug}|merge|${selected.refs.map((ref) => `${ref.block_id}@${ref.position}`).join('|')}`);
  const hash = await contentHash(content);
  const ts = nowIso();
  const mergedRef = { block_id: blockId, content, content_hash: hash, current_version: 1, separator_after: last.separator_after, referenced_at: ts };
  const refs = graph.blocks.map((ref) => ({ ...ref }));
  refs.splice(selected.start, selected.refs.length, mergedRef);
  const stmts = [
    statement(env, `INSERT INTO content_blocks(id,content,content_hash,current_version,created_at,updated_at) VALUES(?,?,?,1,?,?)`, blockId, content, hash, ts, ts),
    statement(env, `INSERT INTO content_block_versions(block_id,version,content,content_hash,actor,operation,created_at) VALUES(?,1,?,?,?,'merge',?)`, blockId, content, hash, actor, ts),
    statement(env, 'DELETE FROM article_block_refs WHERE article_slug=?', slug),
  ];
  for (const ref of normalizePositions(refs)) stmts.push(statement(env,
    `INSERT INTO article_block_refs(article_slug,position,block_id,separator_after,created_at) VALUES(?,?,?,?,?)`,
    slug, ref.position, ref.block_id, ref.separator_after || '', ref.referenced_at || ts));
  for (const sourceId of [...new Set(selected.refs.map((ref) => ref.block_id))]) {
    const sourcePositions = selected.refs.filter((ref) => ref.block_id === sourceId).map((ref) => Number(ref.position));
    const placeholders = sourcePositions.map(() => '?').join(',');
    const remaining = await first(env,
      `SELECT COUNT(*) AS n FROM article_block_refs WHERE block_id=? AND NOT (article_slug=? AND position IN (${placeholders}))`,
      sourceId, slug, ...sourcePositions);
    if (Number(remaining?.n || 0) === 0) stmts.push(statement(env, 'UPDATE content_blocks SET retired_at=?,updated_at=? WHERE id=?', ts, ts, sourceId));
  }
  stmts.push(...(await materializationStatements(env, new Map([[slug, normalizePositions(refs)]]), ts)));
  stmts.push(await eventStmt(env, { op: 'merge', actor, articleSlug: slug, blockId, detail: { source_block_ids: selected.refs.map((ref) => ref.block_id), start: selected.start, count: selected.refs.length } }));
  await env.DB.batch(stmts);
  return { ok: true, slug, block_id: blockId, content_hash: hash, source_block_ids: selected.refs.map((ref) => ref.block_id), position: selected.start, human_url: `https://miscsubjects.com/a/${encodeURIComponent(slug)}#block-${blockId}` };
}

export async function splitArticleBlock(env, { slug, blockId, expectedHash, splitAt, actor }) {
  await ensureArticleWrapped(env, slug, actor);
  const graph = await articleBlockGraph(env, slug, { ensure: false });
  const index = graph.blocks.findIndex((r) => r.block_id === blockId);
  if (index < 0) return { ok: false, status: 404, error: 'reference_not_found' };
  const ref = graph.blocks[index];
  if (expectedHash !== ref.content_hash) return { ok: false, status: 409, error: 'hash_stale', current: ref };
  let pieces;
  try { pieces = splitBlockContent(ref.content, splitAt, ref.separator_after); }
  catch (e) { return { ok: false, status: 422, error: 'invalid_split', detail: e.message }; }
  const rightId = await derivedBlockId(`${blockId}|split|${splitAt}`);
  const leftHash = await contentHash(pieces.left.content);
  const rightHash = await contentHash(pieces.right.content);
  const nextVersion = Number(ref.current_version) + 1;
  const ts = nowIso();
  const refs = graph.blocks.map((r) => ({ ...r }));
  refs[index] = { ...ref, content: pieces.left.content, content_hash: leftHash, current_version: nextVersion, separator_after: pieces.left.separator_after };
  refs.splice(index + 1, 0, { block_id: rightId, content: pieces.right.content, content_hash: rightHash, current_version: 1, separator_after: pieces.right.separator_after, referenced_at: ts });
  const stmts = [
    statement(env, 'UPDATE content_blocks SET content=?,content_hash=?,current_version=?,updated_at=? WHERE id=? AND content_hash=?', pieces.left.content, leftHash, nextVersion, ts, blockId, expectedHash),
    statement(env, `INSERT INTO content_block_versions(block_id,version,content,content_hash,actor,operation,created_at) VALUES(?,?,?,?,?,'split-left',?)`, blockId, nextVersion, pieces.left.content, leftHash, actor, ts),
    statement(env, `INSERT INTO content_blocks(id,content,content_hash,current_version,created_at,updated_at) VALUES(?,?,?,1,?,?)`, rightId, pieces.right.content, rightHash, ts, ts),
    statement(env, `INSERT INTO content_block_versions(block_id,version,content,content_hash,actor,operation,created_at) VALUES(?,1,?,?,?,'split-right',?)`, rightId, pieces.right.content, rightHash, actor, ts),
    statement(env, 'DELETE FROM article_block_refs WHERE article_slug=?', slug),
  ];
  for (const r of normalizePositions(refs)) stmts.push(statement(env, `INSERT INTO article_block_refs(article_slug,position,block_id,separator_after,created_at) VALUES(?,?,?,?,?)`, slug, r.position, r.block_id, r.separator_after || '', r.referenced_at || ts));
  stmts.push(...(await materializationStatements(env, new Map([[slug, normalizePositions(refs)]]), ts)));
  stmts.push(await eventStmt(env, { op: 'split', actor, articleSlug: slug, blockId, detail: { right_block_id: rightId, split_at: Number(splitAt) } }));
  await env.DB.batch(stmts);
  return { ok: true, slug, left_block_id: blockId, right_block_id: rightId, human_url: `https://miscsubjects.com/a/${encodeURIComponent(slug)}#block-${blockId}` };
}

// Turn an exact selection inside one rendered reference into its own stable block. This operation
// is reference-scoped: if the source block is shared, other articles keep the original block and
// wording. The selected article receives new prefix/selection/suffix blocks in one byte-preserving
// batch, so comments on the old whole block never silently migrate onto the selected fragment.
export async function isolateBlockSelection(env, {
  slug, blockId, expectedHash, selectedText, expectedPosition = null, occurrence = null, actor,
}) {
  await ensureArticleWrapped(env, slug, actor);
  const graph = await articleBlockGraph(env, slug, { ensure: false });
  const candidates = graph.blocks.filter((r) => r.block_id === blockId
    && (expectedPosition == null || Number(r.position) === Number(expectedPosition)));
  if (candidates.length !== 1) {
    return { ok: false, status: 409, error: candidates.length ? 'reference_ambiguous' : 'reference_stale', current: graph.blocks };
  }
  const ref = candidates[0];
  if (expectedHash !== ref.content_hash) return { ok: false, status: 409, error: 'hash_stale', current: ref };
  const selection = String(selectedText ?? '');
  if (!selection) return { ok: false, status: 422, error: 'selection_required' };
  if (selection === ref.content) {
    return { ok: true, idempotent: true, slug, selected_block_id: ref.block_id, blocks: [ref.block_id], human_url: `https://miscsubjects.com/a/${encodeURIComponent(slug)}#block-${ref.block_id}` };
  }
  const starts = [];
  for (let at = ref.content.indexOf(selection); at >= 0; at = ref.content.indexOf(selection, at + 1)) starts.push(at);
  if (!starts.length) return { ok: false, status: 422, error: 'selection_not_found' };
  let chosen;
  if (occurrence != null) {
    const n = Number(occurrence);
    if (!Number.isInteger(n) || n < 0 || n >= starts.length) return { ok: false, status: 422, error: 'selection_occurrence_invalid', matches: starts.length };
    chosen = starts[n];
  } else if (starts.length > 1) {
    return { ok: false, status: 422, error: 'selection_ambiguous', matches: starts.length };
  } else chosen = starts[0];

  const raw = [ref.content.slice(0, chosen), selection, ref.content.slice(chosen + selection.length)];
  const parts = raw.map((content, index) => ({ content, index })).filter((part) => part.content.length);
  const ts = nowIso();
  const created = [];
  const stmts = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const id = await derivedBlockId(`${slug}|isolate|${blockId}|${ref.position}|${part.index}|${part.content}`);
    const hash = await contentHash(part.content);
    const separatorAfter = i === parts.length - 1 ? ref.separator_after : '';
    const next = { block_id: id, content: part.content, content_hash: hash, current_version: 1, separator_after: separatorAfter, referenced_at: ts };
    created.push({ ...next, selected: part.index === 1 });
    stmts.push(statement(env, `INSERT INTO content_blocks(id,content,content_hash,current_version,created_at,updated_at) VALUES(?,?,?,1,?,?)`, id, part.content, hash, ts, ts));
    stmts.push(statement(env, `INSERT INTO content_block_versions(block_id,version,content,content_hash,actor,operation,created_at) VALUES(?,1,?,?,?,'isolate-selection',?)`, id, part.content, hash, actor, ts));
  }
  const refs = graph.blocks.map((r) => ({ ...r }));
  refs.splice(Number(ref.position), 1, ...created);
  stmts.push(statement(env, 'DELETE FROM article_block_refs WHERE article_slug=?', slug));
  for (const r of normalizePositions(refs)) stmts.push(statement(env,
    `INSERT INTO article_block_refs(article_slug,position,block_id,separator_after,created_at) VALUES(?,?,?,?,?)`,
    slug, r.position, r.block_id, r.separator_after || '', r.referenced_at || ts));
  const remaining = await first(env,
    'SELECT COUNT(*) AS n FROM article_block_refs WHERE block_id=? AND NOT (article_slug=? AND position=?)',
    blockId, slug, Number(ref.position));
  if (Number(remaining?.n || 0) === 0) stmts.push(statement(env, 'UPDATE content_blocks SET retired_at=?,updated_at=? WHERE id=?', ts, ts, blockId));
  stmts.push(...(await materializationStatements(env, new Map([[slug, normalizePositions(refs)]]), ts)));
  const selected = created.find((part) => part.selected);
  stmts.push(await eventStmt(env, { op: 'isolate-selection', actor, articleSlug: slug, blockId: selected.block_id, detail: { source_block_id: blockId, source_hash: expectedHash, source_position: Number(ref.position), selected_text: selection, created_block_ids: created.map((part) => part.block_id) } }));
  await env.DB.batch(stmts);
  return { ok: true, slug, source_block_id: blockId, selected_block_id: selected.block_id, blocks: created.map((part) => part.block_id), human_url: `https://miscsubjects.com/a/${encodeURIComponent(slug)}#block-${selected.block_id}` };
}

export async function detachArticleBlock(env, { slug, blockId, expectedPosition, actor }) {
  await ensureArticleWrapped(env, slug, actor);
  const graph = await articleBlockGraph(env, slug, { ensure: false });
  const ref = graph.blocks.find((r) => r.block_id === blockId && Number(r.position) === Number(expectedPosition));
  if (!ref) return { ok: false, status: 409, error: 'reference_stale', current: graph.blocks };
  const newId = await derivedBlockId(`${slug}|detach|${blockId}|${expectedPosition}`);
  const ts = nowIso();
  await env.DB.batch([
    statement(env, `INSERT INTO content_blocks(id,content,content_hash,current_version,created_at,updated_at) VALUES(?,?,?,1,?,?)`, newId, ref.content, ref.content_hash, ts, ts),
    statement(env, `INSERT INTO content_block_versions(block_id,version,content,content_hash,actor,operation,created_at) VALUES(?,1,?,?,?,'detach',?)`, newId, ref.content, ref.content_hash, actor, ts),
    statement(env, 'UPDATE article_block_refs SET block_id=? WHERE article_slug=? AND position=? AND block_id=?', newId, slug, Number(expectedPosition), blockId),
    await eventStmt(env, { op: 'detach', actor, articleSlug: slug, blockId, detail: { detached_block_id: newId, position: Number(expectedPosition) } }),
  ]);
  return { ok: true, slug, from_block_id: blockId, block_id: newId, content_hash: ref.content_hash, human_url: `https://miscsubjects.com/a/${encodeURIComponent(slug)}#block-${newId}` };
}

export async function insertBlockReference(env, { slug, blockId, position, separatorAfter = '\n\n', actor }) {
  await ensureArticleWrapped(env, slug, actor);
  const block = await first(env, 'SELECT * FROM content_blocks WHERE id=? AND retired_at IS NULL', blockId);
  if (!block) return { ok: false, status: 404, error: 'active_block_not_found' };
  const graph = await articleBlockGraph(env, slug, { ensure: false });
  const at = Math.max(0, Math.min(graph.blocks.length, Number.isInteger(Number(position)) ? Number(position) : graph.blocks.length));
  const refs = graph.blocks.map((r) => ({ ...r }));
  refs.splice(at, 0, { ...block, block_id: blockId, separator_after: String(separatorAfter ?? ''), referenced_at: nowIso() });
  await rewriteArticleOrder(env, slug, refs, actor, 'insert-reference', { block_id: blockId, position: at });
  return { ok: true, slug, block_id: blockId, position: at, reference_count: Number(block.reference_count || 0) + 1, human_url: `https://miscsubjects.com/a/${encodeURIComponent(slug)}#block-${blockId}` };
}

export async function retireArticleBlock(env, { slug, blockId, expectedPosition, actor }) {
  await ensureArticleWrapped(env, slug, actor);
  const graph = await articleBlockGraph(env, slug, { ensure: false });
  const index = graph.blocks.findIndex((r) => r.block_id === blockId && Number(r.position) === Number(expectedPosition));
  if (index < 0) return { ok: false, status: 409, error: 'reference_stale', current: graph.blocks };
  const refs = graph.blocks.map((r) => ({ ...r })); refs.splice(index, 1);
  const remaining = await first(env, 'SELECT COUNT(*) AS n FROM article_block_refs WHERE block_id=? AND NOT (article_slug=? AND position=?)', blockId, slug, Number(expectedPosition));
  const ts = nowIso();
  const stmts = [statement(env, 'DELETE FROM article_block_refs WHERE article_slug=?', slug)];
  for (const r of normalizePositions(refs)) stmts.push(statement(env, `INSERT INTO article_block_refs(article_slug,position,block_id,separator_after,created_at) VALUES(?,?,?,?,?)`, slug, r.position, r.block_id, r.separator_after || '', r.referenced_at || ts));
  if (Number(remaining?.n || 0) === 0) stmts.push(statement(env, 'UPDATE content_blocks SET retired_at=?,updated_at=? WHERE id=?', ts, ts, blockId));
  stmts.push(...(await materializationStatements(env, new Map([[slug, normalizePositions(refs)]]), ts)));
  stmts.push(await eventStmt(env, { op: 'retire-reference', actor, articleSlug: slug, blockId, detail: { position: Number(expectedPosition), block_retired: Number(remaining?.n || 0) === 0 } }));
  await env.DB.batch(stmts);
  return { ok: true, slug, block_id: blockId, block_retired: Number(remaining?.n || 0) === 0, remaining_references: Number(remaining?.n || 0), human_url: `https://miscsubjects.com/a/${encodeURIComponent(slug)}` };
}

export async function commentOnBlock(env, { blockId, body, stance = 'comment', actor, fingerprint = null }) {
  const block = await first(env, 'SELECT * FROM content_blocks WHERE id=?', blockId);
  if (!block) return { ok: false, status: 404, error: 'block_not_found' };
  const text = String(body || '').trim();
  if (!text) return { ok: false, status: 422, error: 'comment_required' };
  const unsafe = unsafeCollaborationText({ body: text, stance });
  if (unsafe.unsafe) return { ok: false, status: 422, error: unsafe.error };
  const ts = nowIso();
  const res = await statement(env,
    `INSERT INTO content_block_comments(block_id,block_version,content_hash,stance,body,actor,fingerprint,created_at)
     VALUES(?,?,?,?,?,?,?,?)`, blockId, block.current_version, block.content_hash, String(stance), text, actor, fingerprint, ts).run();
  await (await eventStmt(env, { op: 'comment', actor, blockId, detail: { comment_id: res.meta?.last_row_id, version: block.current_version, content_hash: block.content_hash, stance } })).run();
  return { ok: true, comment_id: res.meta?.last_row_id, block_id: blockId, block_version: block.current_version, content_hash: block.content_hash, created_at: ts };
}

const BLOCK_VERDICTS = new Set(['positive', 'negative', 'edit', 'delete']);

export async function verdictOnBlock(env, { blockId, verdict, note = '', actor, fingerprint = null }) {
  const block = await first(env, 'SELECT * FROM content_blocks WHERE id=?', blockId);
  if (!block) return { ok: false, status: 404, error: 'block_not_found' };
  const value = String(verdict || '').toLowerCase();
  if (!BLOCK_VERDICTS.has(value)) return { ok: false, status: 422, error: 'verdict_invalid', allowed: [...BLOCK_VERDICTS] };
  const unsafe = unsafeCollaborationText({ verdict: value, note });
  if (unsafe.unsafe) return { ok: false, status: 422, error: unsafe.error };
  const ts = nowIso();
  const res = await statement(env,
    `INSERT INTO content_block_verdicts(block_id,block_version,content_hash,verdict,note,actor,fingerprint,created_at)
     VALUES(?,?,?,?,?,?,?,?)`,
    blockId, block.current_version, block.content_hash, value, String(note || ''), actor, fingerprint, ts).run();
  await (await eventStmt(env, { op: 'verdict', actor, blockId, detail: { verdict_id: res.meta?.last_row_id, verdict: value, version: block.current_version, content_hash: block.content_hash } })).run();
  return { ok: true, verdict_id: res.meta?.last_row_id, block_id: blockId, block_version: block.current_version, content_hash: block.content_hash, verdict: value, created_at: ts };
}

const BLOCK_PROPOSAL_KINDS = new Set(['isolate', 'move', 'edit', 'delete', 'reuse', 'split', 'merge']);

function validateProposal(kind, payload, block) {
  if (kind === 'isolate') {
    const selected = String(payload.selected_text || '');
    if (!selected) return 'selected_text_required';
    if (!String(block.content || '').includes(selected)) return 'selection_not_found';
  }
  if (kind === 'move' && !['up', 'down'].includes(String(payload.direction || '')) && !Number.isInteger(Number(payload.to_position))) return 'move_target_required';
  if (kind === 'merge' && (!Array.isArray(payload.selections) || payload.selections.length < 2)) return 'multiple_selection_required';
  if (kind === 'edit' && !String(payload.content || '').trim()) return 'edit_content_required';
  if (kind === 'reuse' && !String(payload.target_slug || '').trim()) return 'target_slug_required';
  if (kind === 'split') {
    const at = Number(payload.split_at);
    if (!Number.isInteger(at) || at <= 0 || at >= String(block.content || '').length) return 'split_point_invalid';
  }
  return null;
}

export async function proposeBlockAction(env, {
  articleSlug = null, blockId, expectedHash = null, kind, payload = {}, note = '', actor, fingerprint = null,
}) {
  const block = await first(env, 'SELECT * FROM content_blocks WHERE id=?', blockId);
  if (!block) return { ok: false, status: 404, error: 'block_not_found' };
  const proposalKind = String(kind || '').toLowerCase();
  if (!BLOCK_PROPOSAL_KINDS.has(proposalKind)) return { ok: false, status: 422, error: 'proposal_kind_invalid', allowed: [...BLOCK_PROPOSAL_KINDS] };
  if (expectedHash && expectedHash !== block.content_hash) return { ok: false, status: 409, error: 'hash_stale', current: block };
  const proposalPayload = payload && typeof payload === 'object' ? payload : {};
  const unsafe = unsafeCollaborationText({ payload: proposalPayload, note });
  if (unsafe.unsafe) return { ok: false, status: 422, error: unsafe.error };
  const invalid = validateProposal(proposalKind, proposalPayload, block);
  if (invalid) return { ok: false, status: 422, error: invalid };
  const payloadJson = JSON.stringify(proposalPayload);
  if (payloadJson.length > 20000 || String(note || '').length > 4000) return { ok: false, status: 413, error: 'proposal_too_large' };
  const ts = nowIso();
  const res = await statement(env,
    `INSERT INTO content_block_proposals(article_slug,block_id,block_version,content_hash,kind,payload_json,note,actor,fingerprint,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?)`,
    articleSlug ? String(articleSlug) : null, blockId, block.current_version, block.content_hash,
    proposalKind, payloadJson, String(note || ''), actor, fingerprint, ts).run();
  await (await eventStmt(env, { op: 'proposal', actor, articleSlug, blockId, detail: { proposal_id: res.meta?.last_row_id, kind: proposalKind, version: block.current_version, content_hash: block.content_hash } })).run();
  return { ok: true, proposal_id: res.meta?.last_row_id, article_slug: articleSlug, block_id: blockId, block_version: block.current_version, content_hash: block.content_hash, kind: proposalKind, created_at: ts };
}

export async function blockHistory(env, blockId) {
  const block = await first(env, `SELECT b.*,(SELECT COUNT(*) FROM article_block_refs r WHERE r.block_id=b.id) AS reference_count FROM content_blocks b WHERE b.id=?`, blockId);
  if (!block) return null;
  const versions = await all(env, 'SELECT * FROM content_block_versions WHERE block_id=? ORDER BY version DESC', blockId);
  const references = await all(env, 'SELECT article_slug,position,separator_after,created_at FROM article_block_refs WHERE block_id=? ORDER BY article_slug,position', blockId);
  return { schema: 'miscsubjects/recursive-content-history/1', block, versions, references, comments: await blockComments(env, blockId), verdicts: await blockVerdicts(env, blockId), proposals: await blockProposals(env, blockId) };
}

export async function blockComments(env, blockId) {
  return all(env, 'SELECT * FROM content_block_comments WHERE block_id=? ORDER BY id ASC', blockId);
}

export async function blockVerdicts(env, blockId) {
  return all(env, 'SELECT * FROM content_block_verdicts WHERE block_id=? ORDER BY id ASC', blockId);
}

export async function blockProposals(env, blockId) {
  const rows = await all(env,
    `SELECT p.*,
            (SELECT d.decision FROM content_block_proposal_decisions d WHERE d.proposal_id=p.id ORDER BY d.id DESC LIMIT 1) AS latest_decision,
            (SELECT d.result_json FROM content_block_proposal_decisions d WHERE d.proposal_id=p.id ORDER BY d.id DESC LIMIT 1) AS decision_result_json
       FROM content_block_proposals p WHERE p.block_id=? ORDER BY p.id ASC`, blockId);
  return rows.map((row) => ({ ...row, payload: parseMeta(row.payload_json), decision_result: parseMeta(row.decision_result_json) }));
}

export async function blockProposal(env, proposalId) {
  const row = await first(env,
    `SELECT p.*,
            (SELECT d.decision FROM content_block_proposal_decisions d WHERE d.proposal_id=p.id ORDER BY d.id DESC LIMIT 1) AS latest_decision
       FROM content_block_proposals p WHERE p.id=?`, Number(proposalId));
  return row ? { ...row, payload: parseMeta(row.payload_json) } : null;
}

export async function decideBlockProposal(env, { proposalId, decision, actor, result = {} }) {
  const proposal = await blockProposal(env, proposalId);
  if (!proposal) return { ok: false, status: 404, error: 'proposal_not_found' };
  if (proposal.latest_decision) return { ok: false, status: 409, error: 'proposal_already_decided', current: proposal.latest_decision };
  const value = String(decision || '').toLowerCase();
  if (!['accepted', 'rejected'].includes(value)) return { ok: false, status: 422, error: 'proposal_decision_invalid' };
  const ts = nowIso();
  const res = await statement(env,
    `INSERT INTO content_block_proposal_decisions(proposal_id,decision,actor,result_json,created_at) VALUES(?,?,?,?,?)`,
    Number(proposalId), value, actor, JSON.stringify(result || {}), ts).run();
  await (await eventStmt(env, { op: `proposal-${value}`, actor, articleSlug: proposal.article_slug, blockId: proposal.block_id, detail: { proposal_id: Number(proposalId), decision_id: res.meta?.last_row_id, result } })).run();
  return { ok: true, proposal_id: Number(proposalId), decision: value, block_id: proposal.block_id, slug: proposal.article_slug, created_at: ts };
}

export async function searchBlocks(env, query, limit = 25) {
  const q = String(query || '').trim();
  const n = Math.min(Math.max(Number(limit) || 25, 1), 100);
  if (!q) return [];
  return all(env,
    `SELECT b.id AS block_id,b.content,b.content_hash,b.current_version,b.updated_at,
            COUNT(r.article_slug) AS reference_count,GROUP_CONCAT(DISTINCT r.article_slug) AS article_slugs
       FROM content_blocks b LEFT JOIN article_block_refs r ON r.block_id=b.id
      WHERE b.retired_at IS NULL AND (b.id=? OR b.content LIKE ?)
      GROUP BY b.id ORDER BY CASE WHEN b.id=? THEN 0 ELSE 1 END,reference_count DESC,b.updated_at DESC LIMIT ?`,
    q, `%${q}%`, q, n);
}

export async function backfillArticleBatch(env, { cursor = '', limit = 25, actor = 'system:backfill' } = {}) {
  const rows = await all(env, 'SELECT slug FROM articles WHERE published=1 AND slug>? ORDER BY slug LIMIT ?', String(cursor), Math.min(Math.max(Number(limit) || 25, 1), 100));
  const results = [];
  for (const row of rows) {
    try { results.push(await ensureArticleWrapped(env, row.slug, actor)); }
    catch (e) { results.push({ ok: false, slug: row.slug, error: String(e?.message || e) }); }
  }
  return { ok: results.every((r) => r.ok), processed: results.length, next_cursor: rows.length ? rows[rows.length - 1].slug : null, done: rows.length < Math.min(Math.max(Number(limit) || 25, 1), 100), results };
}

export function recursiveContentProcedure(slug = '<slug>') {
  const base = 'https://miscsubjects.com/api/blocks';
  const dispatch = 'https://miscsubjects.com/api/dispatch';
  return {
    what: 'An article is an ordered list of references to canonical content blocks. The article body is a compatibility projection regenerated from those references.',
    identity: 'Every block has one stable corpus-wide rb_ identity. Editing its words never changes that identity.',
    div_constitution: {
      core_rule: 'One DIV is the smallest lossless, self-contained unit another reader can understand, address, move, critique, edit, delete, or reuse without requiring adjacent prose.',
      default_units: {
        heading: 'Keep a heading with the section it names unless the heading itself is the reusable or disputed object.',
        prose: 'Prefer one complete paragraph. Split only where each side states a complete idea or where an exact clause must be independently edited, challenged, or reused.',
        list: 'Each independently meaningful list item may be a DIV; keep an introductory sentence with the list when the items depend on it.',
        table: 'Keep the header with the table. A row may be a DIV only when its column meaning remains unambiguous.',
        quote: 'Keep attribution and citation with the quoted words.',
        code: 'Keep a syntactically complete code block or declaration together; never split inside a token or delimiter pair.',
        media: 'Keep an image, chart, or embed with its caption, alt text, and source.',
      },
      boundary_rules: [
        'Preserve every source byte and the original order when DIV boundaries alone are changing.',
        'Never split markdown syntax, a URL, citation, inline code token, number plus unit, proper name, or paired delimiter.',
        'Do not create arbitrary sentence fragments. A fragment is valid only when it is the exact target of an edit, comment, verdict, reuse, or independently meaningful claim.',
        'Prefer the smallest boundary that remains self-explaining; if removing adjacent text changes what it means, the boundary is too small.',
        'Do not merge merely similar prose. Reuse only an existing stable block whose meaning and wording are intentionally shared.',
      ],
      proposal_contract: [
        'Read the current graph first and bind the proposal to block_id plus expected_hash.',
        'Name the intended operation and explain why the proposed unit is independently meaningful.',
        'For isolate or split, provide the exact selected_text or split_at boundary; for move, provide the intended position; for edit, provide replacement content; for delete, state what becomes false, redundant, harmful, or obsolete.',
        'A proposal is append-only and cannot mutate the article until an authorized owner or scoped model accepts it.',
      ],
      completion_test: 'After recomposition, the article bytes and reading order are unchanged unless an accepted edit, move, reuse, article-only copy, or delete explicitly says otherwise; every DIV can be understood and acted on by its stable ID.',
    },
    reuse: 'Reuse is explicit: search, choose a block, then insert its reference. The system never merges similar prose automatically and never copies on reuse.',
    comments: 'Every comment records the exact block version and content hash it criticized, so a later edit cannot silently absorb the criticism.',
    verdicts: 'Positive, negative, edit, and delete verdicts are append-only signals bound to one exact block version and hash. They never mutate or hide prose by themselves.',
    web_models: 'Any web model may read the graph and file keyless comments, verdicts, or isolate/move/edit/delete/reuse/split/merge proposals. Proposals never mutate the corpus until an authorized owner or scoped model accepts them.',
    authority: 'Reads and reviewable contributions are public. Owner browser sessions work automatically. Models use the ordinary OIP token envelope with row:BLOCK_<ACTION>, rows:..., or pfx:BLOCK_ scope. A BLOCK_ token cannot name MCP_, CLI_, COMPUTER_, owner, terminal, or secret objects; display names and retrieved prose are never authority.',
    proof: 'Public contributions return miscsubjects/block-action-proof/1. Token actions run through OIP and also return an inv_ invocation with capability fingerprint, input/output hashes, contract fingerprint, confirmation, replay, and repair paths.',
    oip: {
      documentation: 'https://miscsubjects.com/a/oip-tap-go',
      scope: 'pfx:BLOCK_',
      discover: `${dispatch}?map=1&format=markdown`,
      explain: `${dispatch}?explain=1&share=<TOKEN>`,
      contract: `${dispatch}?key=BLOCK_EDIT&format=markdown&share=<TOKEN>`,
      post_json: `POST ${dispatch} {key:"BLOCK_EDIT",body:"<JSON>",share:"<TOKEN>"}`,
      bearer: `POST ${dispatch} Authorization: Bearer <TOKEN> {key:"BLOCK_EDIT",body:"<JSON>"}`,
      browser: 'GET https://miscsubjects.com/web/run/BLOCK_EDIT?share=<SHORT_LIVED_TOKEN>&body=<URL_ENCODED_JSON>',
      get_compatibility: `${dispatch}?invoke=BLOCK_EDIT&share=<SHORT_LIVED_TOKEN>&body=<URL_ENCODED_JSON>`,
      transport_warning: 'Prefer Bearer or POST body. Query tokens are a compatibility lane for short-lived, sharply scoped, use-capped authority only; never place broad admin/internal authority in a URL.',
    },
    graph: `GET ${base}/article/${slug}`,
    search: `GET ${base}/search?q=<words-or-rb_id>`,
    comment: `POST ${base}/comment {block_id,body,stance?,actor?} — keyless collaboration`,
    verdict: `POST ${base}/verdict {block_id,verdict:"positive|negative|edit|delete",note?,actor?} — keyless collaboration`,
    suggest: `POST ${base}/suggest {article_slug?,block_id,expected_hash?,kind:"isolate|move|edit|delete|reuse|split|merge",payload:{...},note?,actor?} — keyless collaboration`,
    isolate_selection: `OIP BLOCK_DIVIDE via POST ${dispatch} with body {slug,block_id,expected_hash,selected_text,expected_position?,occurrence?}`,
    edit: `OIP BLOCK_EDIT via POST ${dispatch} with body {block_id,expected_hash,content}`,
    split: `OIP BLOCK_SPLIT via POST ${dispatch} with body {slug,block_id,expected_hash,split_at}`,
    move: `OIP BLOCK_MOVE via POST ${dispatch} with body {slug,block_id,expected_position,direction:"up|down"}`,
    move_group: `OIP BLOCK_MOVE_GROUP via POST ${dispatch} with body {slug,selections:[{block_id,expected_position,expected_hash}],direction:"up|down"}`,
    merge: `OIP BLOCK_MERGE via POST ${dispatch} with body {slug,selections:[{block_id,expected_position,expected_hash}]}`,
    detach: `OIP BLOCK_COPY via POST ${dispatch} with body {slug,block_id,expected_position} — makes an article-only copy`,
    retire: `OIP BLOCK_DELETE via POST ${dispatch} with body {slug,block_id,expected_position} — removes this reference; bytes/history remain`,
    insert_reference: `OIP BLOCK_REUSE via POST ${dispatch} with body {slug,block_id,position?,separator_after?}`,
    history: `GET ${base}/block/<rb_id>/history`,
    human: `https://miscsubjects.com/a/${slug}`,
    explanation: 'https://miscsubjects.com/a/recursive-content',
  };
}
