// Recursive Content public graph and guarded mutation door.

import {
  capabilityChainStatus,
  getCapabilityByNonce,
  isBuildAuthed,
  tokenAllowsKey,
  verifyShareToken,
  verifyShareTokenValue,
} from '../../_lib/admin_session.js';
import {
  articleBlockGraph,
  backfillArticleBatch,
  blockComments,
  blockHistory,
  blockProposal,
  blockProposals,
  blockVerdicts,
  commentOnBlock,
  contentHash,
  decideBlockProposal,
  detachArticleBlock,
  editBlock,
  ensureArticleWrapped,
  insertBlockReference,
  isolateBlockSelection,
  mergeArticleBlocks,
  moveArticleBlock,
  moveArticleBlockGroup,
  proposeBlockAction,
  recursiveContentProcedure,
  retireArticleBlock,
  searchBlocks,
  splitArticleBlock,
  verdictOnBlock,
} from '../../_lib/recursive_content.js';

// The article fast-lane cache key version and the purge helper live in one shared module,
// so this route and _middleware.js cannot drift apart (they used to hold twin literals).
import { purgeArticlePageCache } from '../../_lib/edge_cache.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization,content-type,x-terminal-key,x-block-token',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
  });
}

function pathParts(params) {
  const raw = params?.path;
  return (Array.isArray(raw) ? raw : String(raw || '').split('/')).map(String).filter(Boolean);
}

function bearer(request) {
  const value = request.headers.get('authorization') || '';
  return /^Bearer\s+/i.test(value) ? value.replace(/^Bearer\s+/i, '').trim() : '';
}

async function publicCollaborator(request, body = {}) {
  const claimed = String(body.actor || body.model || request.headers.get('x-model-name') || 'web-model')
    .replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 80) || 'web-model';
  const seed = `${request.headers.get('cf-connecting-ip') || ''}\n${request.headers.get('user-agent') || ''}`;
  return { actor: `web:${claimed}`, fingerprint: `anon_${(await contentHash(seed)).slice(0, 20)}` };
}

async function authority(request, env, body = {}) {
  if (await isBuildAuthed(request, env)) return { ok: true, owner: true, actor: 'owner', fingerprint: 'owner' };
  let token = await verifyShareToken(request, env);
  if (!token) {
    const raw = body.key || body.capability_token || request.headers.get('x-block-token') || bearer(request);
    if (raw) token = await verifyShareTokenValue(env, raw);
  }
  if (!token) return { ok: false };
  const capability = await getCapabilityByNonce(env, token.nonce);
  if (!capability) return { ok: false, reason: 'capability_unrecorded' };
  const chain = await capabilityChainStatus(env, capability);
  if (!chain.ok) return { ok: false, reason: chain.reason };
  const scope = token.scope || 'read';
  return {
    ok: scope !== 'read',
    owner: false,
    token,
    capability,
    fingerprint: token.fingerprint || token.nonce || null,
    actor: `share:${scope}:${String(token.fingerprint || token.nonce || '').slice(0, 12)}`,
  };
}

const OPERATION_CAPABILITY = Object.freeze({
  comment: 'BLOCK_COMMENT',
  verdict: 'BLOCK_VERDICT',
  suggest: 'BLOCK_SUGGEST',
  edit: 'BLOCK_EDIT',
  move: 'BLOCK_MOVE',
  'move-group': 'BLOCK_MOVE_GROUP',
  split: 'BLOCK_SPLIT',
  merge: 'BLOCK_MERGE',
  'isolate-selection': 'BLOCK_DIVIDE',
  'insert-reference': 'BLOCK_REUSE',
  detach: 'BLOCK_COPY',
  retire: 'BLOCK_DELETE',
});

function operationCapabilityKey(operation) {
  return OPERATION_CAPABILITY[String(operation || '')]
    || `BLOCK_${String(operation || '').toUpperCase().replace(/-/g, '_')}`;
}

function scopeAllows(auth, operation) {
  if (auth?.owner) return true;
  const token = auth?.token;
  if (!token) return false;
  return tokenAllowsKey(token, operationCapabilityKey(operation));
}

function refused(operation) {
  return json({
    ok: false,
    error: 'block_capability_required',
    operation,
    how_to_fix: `Use the signed owner session, an act token, or a token scoped to ${operationCapabilityKey(operation)} (pfx:BLOCK_ grants the complete public-content verb set).`,
  }, 401);
}

async function purgeArticleSurfaces(context, value) {
  if (!value?.ok) return;
  const slugs = new Set();
  if (value.slug) slugs.add(String(value.slug));
  for (const slug of value.affected_articles || []) slugs.add(String(slug));
  for (const row of value.results || []) if (row?.slug) slugs.add(String(row.slug));
  if (value.block_id && context.env?.DB) {
    try {
      const refs = await context.env.DB.prepare('SELECT DISTINCT article_slug FROM article_block_refs WHERE block_id=?')
        .bind(value.block_id).all();
      for (const row of refs.results || []) slugs.add(String(row.article_slug));
    } catch {}
  }
  const origin = new URL(context.request.url).origin;
  for (const slug of slugs) {
    await purgeArticlePageCache(context.env, slug, { origin });
  }
}

async function result(value, context) {
  await purgeArticleSurfaces(context, value);
  if (value?.ok === false) return json(value, Number(value.status || 400));
  const path = new URL(context.request.url).pathname.replace(/^.*\/api\/blocks\/?/, '') || 'read';
  const blockId = value?.block_id || value?.selected_block_id || value?.left_block_id || null;
  const slug = value?.slug || value?.article_slug || null;
  const receiptId = value?.comment_id != null ? `comment:${value.comment_id}`
    : value?.verdict_id != null ? `verdict:${value.verdict_id}`
      : value?.proposal_id != null ? `proposal:${value.proposal_id}`
        : blockId ? `${blockId}:${value?.version || value?.block_version || 'current'}:${value?.content_hash || 'materialized'}` : null;
  const proof = {
    schema: 'miscsubjects/block-action-proof/1',
    action: path,
    receipt_id: receiptId,
    article_slug: slug,
    block_id: blockId,
    block_version: value?.version || value?.block_version || null,
    content_hash: value?.content_hash || null,
    state: value?.proposal_id != null && !value?.decision ? 'queued_for_owner_review' : 'recorded',
    verify: blockId ? `/api/blocks/block/${encodeURIComponent(blockId)}/history` : slug ? `/api/blocks/article/${encodeURIComponent(slug)}` : '/api/blocks',
  };
  return json({ ...value, proof }, 200);
}

async function applyProposal(env, proposal, actor) {
  const p = proposal.payload || {};
  if (proposal.kind === 'isolate') return isolateBlockSelection(env, {
    slug: proposal.article_slug, blockId: proposal.block_id, expectedHash: proposal.content_hash,
    selectedText: p.selected_text, expectedPosition: p.expected_position, occurrence: p.occurrence, actor,
  });
  if (proposal.kind === 'move' && Array.isArray(p.selections) && p.selections.length > 1) return moveArticleBlockGroup(env, {
    slug: proposal.article_slug, selections: p.selections, direction: p.direction, toPosition: p.to_position, actor,
  });
  if (proposal.kind === 'move') return moveArticleBlock(env, {
    slug: proposal.article_slug, blockId: proposal.block_id, expectedPosition: p.expected_position,
    direction: p.direction, toPosition: p.to_position, actor,
  });
  if (proposal.kind === 'merge') return mergeArticleBlocks(env, {
    slug: proposal.article_slug, selections: p.selections, actor,
  });
  if (proposal.kind === 'edit') return editBlock(env, {
    blockId: proposal.block_id, content: p.content, expectedHash: proposal.content_hash, actor,
  });
  if (proposal.kind === 'delete') {
    let position = p.expected_position;
    if (position == null) {
      const ref = await env.DB.prepare('SELECT position FROM article_block_refs WHERE article_slug=? AND block_id=? ORDER BY position LIMIT 1')
        .bind(proposal.article_slug, proposal.block_id).first();
      position = ref?.position;
    }
    return retireArticleBlock(env, { slug: proposal.article_slug, blockId: proposal.block_id, expectedPosition: position, actor });
  }
  if (proposal.kind === 'reuse') return insertBlockReference(env, {
    slug: p.target_slug, blockId: proposal.block_id, position: p.position,
    separatorAfter: p.separator_after, actor,
  });
  if (proposal.kind === 'split') return splitArticleBlock(env, {
    slug: proposal.article_slug, blockId: proposal.block_id, expectedHash: proposal.content_hash,
    splitAt: p.split_at, actor,
  });
  return { ok: false, status: 422, error: 'proposal_kind_invalid' };
}

export async function onRequestOptions() { return json({ ok: true }); }

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === 'OPTIONS') return onRequestOptions();
  const parts = pathParts(params);
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const body = method === 'POST' ? await request.json().catch(() => ({})) : {};

  try {
    if (method === 'GET' && !parts.length) {
      return json({
        schema: 'miscsubjects/recursive-content-door/1',
        what: 'Stable corpus-wide content blocks, reused by reference and criticized at an exact version.',
        explanation: 'https://miscsubjects.com/a/recursive-content',
        procedure: recursiveContentProcedure('<slug>'),
      });
    }

    if ((method === 'GET' || method === 'POST') && parts[0] === 'session') {
      const auth = await authority(request, env, body);
      const operations = Object.keys(OPERATION_CAPABILITY);
      const allowedActions = auth.owner ? ['*'] : auth.ok ? operations.filter((operation) => scopeAllows(auth, operation)) : [];
      return json({
        authenticated: auth.ok,
        owner: !!auth.owner,
        authority: auth.owner ? 'owner' : auth.ok ? String(auth.token?.scope || 'scoped') : 'public',
        direct_actions: allowedActions.length > 0,
        allowed_actions: allowedActions,
        capability_fingerprint: auth.capability?.fingerprint || null,
        denial_reason: auth.ok ? null : auth.reason || null,
        private_proposal_review: !!auth.owner,
      });
    }

    if (method === 'GET' && parts[0] === 'article' && parts[1]) {
      const graph = await articleBlockGraph(env, decodeURIComponent(parts[1]), { ensure: true });
      return graph ? json(graph) : json({ error: 'article_not_found' }, 404);
    }

    if (method === 'GET' && parts[0] === 'search') {
      const q = url.searchParams.get('q') || '';
      return json({ query: q, blocks: await searchBlocks(env, q, url.searchParams.get('limit')) });
    }

    if (method === 'GET' && parts[0] === 'block' && parts[1]) {
      const id = decodeURIComponent(parts[1]);
      if (parts[2] === 'history') {
        const history = await blockHistory(env, id);
        if (!history) return json({ error: 'block_not_found' }, 404);
        const auth = await authority(request, env, body);
        if (!auth.owner) delete history.proposals;
        return json(history);
      }
      if (parts[2] === 'comments') return json({ block_id: id, comments: await blockComments(env, id) });
      if (parts[2] === 'verdicts') return json({ block_id: id, verdicts: await blockVerdicts(env, id) });
      if (parts[2] === 'proposals') {
        const auth = await authority(request, env, body);
        if (!auth.owner) return json({ error: 'not_found' }, 404);
        return json({ block_id: id, proposals: await blockProposals(env, id) });
      }
      const history = await blockHistory(env, id);
      return history ? json({ block: history.block, references: history.references }) : json({ error: 'block_not_found' }, 404);
    }

    if (method === 'GET' && parts[0] === 'procedure') return json(recursiveContentProcedure(decodeURIComponent(parts[1] || '<slug>')));

    if (method !== 'POST') return json({ error: 'not_found' }, 404);

    const operation = parts[0] || '';
    if (operation === 'proposal' && parts[1]) {
      const auth = await authority(request, env, body);
      if (!auth.ok || !scopeAllows(auth, 'proposal-decision')) return refused('proposal-decision');
      const proposal = await blockProposal(env, parts[1]);
      if (!proposal) return json({ ok: false, error: 'proposal_not_found' }, 404);
      const requested = String(parts[2] || body.decision || '').toLowerCase();
      if (requested === 'reject' || requested === 'rejected') {
        return result(await decideBlockProposal(env, { proposalId: proposal.id, decision: 'rejected', actor: auth.actor }), context);
      }
      if (requested !== 'accept' && requested !== 'accepted') return json({ ok: false, error: 'proposal_decision_invalid' }, 422);
      const applied = await applyProposal(env, proposal, auth.actor);
      if (!applied.ok) return result(applied, context);
      const decision = await decideBlockProposal(env, { proposalId: proposal.id, decision: 'accepted', actor: auth.actor, result: applied });
      return result({ ...decision, applied, affected_articles: applied.affected_articles, slug: applied.slug || decision.slug }, context);
    }
    if (['comment', 'verdict', 'suggest'].includes(operation)) {
      const authorized = await authority(request, env, body);
      const collaborator = authorized.ok ? authorized : await publicCollaborator(request, body);
      if (operation === 'comment') return result(await commentOnBlock(env, {
        blockId: body.block_id, body: body.body, stance: body.stance,
        actor: collaborator.actor, fingerprint: collaborator.fingerprint,
      }), context);
      if (operation === 'verdict') return result(await verdictOnBlock(env, {
        blockId: body.block_id, verdict: body.verdict, note: body.note,
        actor: collaborator.actor, fingerprint: collaborator.fingerprint,
      }), context);
      return result(await proposeBlockAction(env, {
        articleSlug: body.article_slug, blockId: body.block_id, expectedHash: body.expected_hash,
        kind: body.kind, payload: body.payload, note: body.note,
        actor: collaborator.actor, fingerprint: collaborator.fingerprint,
      }), context);
    }
    const auth = await authority(request, env, body);
    if (!auth.ok || !scopeAllows(auth, operation)) return refused(operation);
    const actor = auth.actor;

    if (operation === 'wrap') return result(await ensureArticleWrapped(env, String(body.slug || ''), actor), context);
    if (operation === 'edit') return result(await editBlock(env, {
      blockId: body.block_id, content: body.content, expectedHash: body.expected_hash, actor,
    }), context);
    if (operation === 'isolate-selection') return result(await isolateBlockSelection(env, {
      slug: body.slug, blockId: body.block_id, expectedHash: body.expected_hash,
      selectedText: body.selected_text, expectedPosition: body.expected_position,
      occurrence: body.occurrence, actor,
    }), context);
    if (operation === 'move') return result(await moveArticleBlock(env, {
      slug: body.slug, blockId: body.block_id, expectedPosition: body.expected_position,
      direction: body.direction, toPosition: body.to_position, actor,
    }), context);
    if (operation === 'move-group') return result(await moveArticleBlockGroup(env, {
      slug: body.slug, selections: body.selections, direction: body.direction,
      toPosition: body.to_position, actor,
    }), context);
    if (operation === 'merge') return result(await mergeArticleBlocks(env, {
      slug: body.slug, selections: body.selections, actor,
    }), context);
    if (operation === 'split') return result(await splitArticleBlock(env, {
      slug: body.slug, blockId: body.block_id, expectedHash: body.expected_hash,
      splitAt: body.split_at, actor,
    }), context);
    if (operation === 'detach') return result(await detachArticleBlock(env, {
      slug: body.slug, blockId: body.block_id, expectedPosition: body.expected_position, actor,
    }), context);
    if (operation === 'insert-reference') return result(await insertBlockReference(env, {
      slug: body.slug, blockId: body.block_id, position: body.position,
      separatorAfter: body.separator_after, actor,
    }), context);
    if (operation === 'retire') return result(await retireArticleBlock(env, {
      slug: body.slug, blockId: body.block_id, expectedPosition: body.expected_position, actor,
    }), context);
    if (operation === 'backfill') return result(await backfillArticleBatch(env, {
      cursor: body.cursor, limit: body.limit, actor,
    }), context);

    return json({ error: 'unknown_operation', operation }, 404);
  } catch (error) {
    return json({ ok: false, error: 'recursive_content_failure', detail: String(error?.message || error) }, 500);
  }
}
