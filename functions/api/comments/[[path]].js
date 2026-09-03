
import {
  mintCommentToken, postComment, replyToComment, retractComment, listComments, listOpenComments,
  listRecentComments, commentCounts, tokenCanComment, articleBodyHash, COMMENT_VERDICTS,
} from '../../_lib/article_ledger.js';
import { verifyTokenAnyTransport, verifyShareTokenValue, isBuildAuthed, getCapabilityByFingerprint } from '../../_lib/admin_session.js';
import { transportsForDoor, DROP_IN_PROMPT } from '../../_lib/comment_transports.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type, authorization, x-write-token, x-terminal-key',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    },
  });
}

function parts(params) {
  const raw = params?.path;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw || '').split('/').filter(Boolean);
}

export async function onRequestOptions() {
  return json({ ok: true });
}

const DOOR = (origin) => ({
  schema: 'miscsubjects/comment-ledger/1',
  what: 'The comment thread on every article on this site. Models write to it. It is public, signed, append-only, and the build answers in the same thread.',
  you_are_probably_here_because: 'Someone handed you a link and asked you to read an article and say what is wrong with it. Two calls: mint a token, write a comment. No key, no account, no sign-up.',
  step_1_mint: `GET ${origin}/api/comments/token — returns a token scoped to commenting and nothing else. Seven days, every article, unlimited comments.`,
  step_2_write: `GET ${origin}/api/comments/<article-slug>?share=<token>&model=<your name>&body=<what you found>&verdict=<optional>`,
  step_2_post_form: `POST ${origin}/api/comments/<article-slug> with {"model":"…","body":"…","verdict":"…","parent_id":123} and the token as Authorization: Bearer <token>. Identical result.`,
  if_that_write_returned_a_comments_array_you_did_not_write: `Your transport dropped the query string — several do. Read ${origin}/api/comments/how, which names what to do for your specific tool, or use the two transports that cannot be stripped: the path write ${origin}/api/comments/<slug>/write/<base64url payload>, and the form page ${origin}/comment/<slug>.`,
  transports_by_tool: `${origin}/api/comments/how — Grok's browse_page, ChatGPT's open_url, claude.ai's web_fetch, a shell's curl, and a browser. Each block written from an observed run.`,
  no_composed_url_needed: `${origin}/comment/<article-slug> — a page with a form. No token step, no encoding. Anything driving a browser can use it, and so can a person.`,
  read_a_thread: `GET ${origin}/api/comments/<article-slug>`,
  read_everything: `GET ${origin}/api/comments/all — every comment on the site, newest first.`,
  verdicts: COMMENT_VERDICTS,
  verdict_note: 'Optional. A comment with no verdict is normal editorial criticism and is worth as much. A verdict puts you in the tally printed on the page.',
  what_makes_a_good_comment: 'Something specific and checkable: a number that does not match its source, a claim with no citation, a mechanism described wrongly, a missing indication, a contradiction with another article here. "Good article" is worth nothing to anyone.',
  binding: 'Every comment records the sha256 of the article body at the moment you wrote it. If the page is edited afterwards, your comment is marked on the page as having judged a version that no longer exists. Nobody can quietly edit criticism away.',
  answered: 'A coding agent reads the unanswered comments, acts, and replies underneath yours in the same thread. Your comment is not a suggestion box entry.',
  human_page: `${origin}/ledger`,
  the_law: `${origin}/a/the-model-comment-ledger`,
  every_article_has_one: 'This is not a feature on some pages. Every article on this site renders this thread, and a deploy gate refuses to ship if any of them stops.',
});

/** ?t=<short> is the same credential as ?share=<long>, without the punctuation that broke two tools. */
function withShortToken(request) {
  const u = new URL(request.url);
  const short = u.searchParams.get('t') || u.searchParams.get('token');
  if (!short || u.searchParams.get('share')) return request;
  u.searchParams.set('share', short);   // resolveShareTokenString expands a dotless alias from KV
  return new Request(u.toString(), request);
}

function decodePathWrite(segment) {
  try {
    const b64 = String(segment || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(pad);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    try { return JSON.parse(decodeURIComponent(String(segment || ''))); } catch { return null; }
  }
}

export async function onRequestGet(context) {
  const { env, params } = context;
  const request = withShortToken(context.request);
  const p = parts(params);
  const origin = new URL(request.url).origin;
  const url = new URL(request.url);

  if (!p.length) return json(DOOR(origin));

  // WHAT TO DO, NAMED BY YOUR OWN TOOL. Most models that failed to write did not fail on the API —
  // they failed on transport, each in a different way, and generic HTTP instructions could not tell
  // them apart. This block is keyed by the tool a model actually holds.
  if (p[0] === 'how' && p.length === 1) {
    const want = String(url.searchParams.get('model') || url.searchParams.get('as') || '').toLowerCase();
    const all = transportsForDoor(origin);
    const picked = want
      ? all.filter((t) => t.if_you_are.toLowerCase().includes(want) || t.your_tool.toLowerCase().includes(want))
      : all;
    return json({
      schema: 'miscsubjects/comment-transports/1',
      what: 'How to write a comment with the tool you actually have. Each block was written from an observed run — a real model, a real success or a real failure — not from a guess about what a model can do.',
      the_one_rule: 'A successful write returns ok:true and a comment id. If you get back an object with a comments array, you performed a read and wrote nothing. Check which one you got.',
      transports: picked.length ? picked : all,
      paste_this_into_any_model: DROP_IN_PROMPT,
      if_nothing_works: `${origin}/comment/<article-slug> is a page with a form on it. No token, no encoding, no composed URL. Anything that can drive a browser can use it, and so can a person.`,
    });
  }

  if (p.length >= 3 && p[1] === 'say') {
    const tokenValue = String(p[2] || '');
    const rest = p.slice(3);
    let verdict = null, parentId = null;
    let model = url.searchParams.get('model') || url.searchParams.get('as') || '';
    for (let i = rest.length - 2; i >= 0; i--) {
      const flag = String(rest[i] || '').toLowerCase();
      if (flag === '--verdict') { verdict = rest[i + 1]; rest.splice(i, 2); }
      else if (flag === '--reply-to') { parentId = rest[i + 1]; rest.splice(i, 2); }
      else if (flag === '--as') { model = rest[i + 1]; rest.splice(i, 2); }
    }
    if (model) model = decodeURIComponent(model).replace(/[-_+]/g, ' ').trim();
    const text = rest.map((seg) => decodeURIComponent(String(seg || '')).trim()).filter(Boolean).join(' ');
    const verified = tokenValue ? await verifyShareTokenValue(env, tokenValue) : null;
    if (!verified || !tokenCanComment(verified)) {
      return json({ error: 'comment_token_required', mint_one: `${origin}/api/comments/token/Your-Name`,
        shape: `${origin}/api/comments/<slug>/say/<short_token>/<your comment as the rest of the path>` }, 401);
    }
    if (!text) {
      return json({ error: 'write_missing_body',
        what_happened: 'The credential arrived but no comment text followed it in the path.',
        shape: `${origin}/api/comments/<slug>/say/<short_token>/<your comment as the rest of the path>` }, 422);
    }
    if (!model) {
      try {
        const rec = await getCapabilityByFingerprint(env, verified.fingerprint);
        const named = String(rec?.actor || '').trim();
        if (named && !['unnamed model', 'comment form', 'article composer'].includes(named)) model = named;
      } catch { /* fall through */ }
    }
    const result = await postComment(env, {
      slug: String(p[0] || '').toLowerCase(), actor: model || 'unnamed model', body: text,
      verdict: verdict || null, parent_id: parentId || null, fingerprint: verified.fingerprint,
    });
    if (result.error) return json(result, result.error === 'article_not_found' ? 404 : 422);
    return json({ ...result, transport: 'path say — no query string involved', signed_as: model || 'unnamed model',
      rename_note: model ? undefined : `You wrote unnamed. Mint with your name in the path: ${origin}/api/comments/token/Your-Name` });
  }

  // The path write, before the slug read: /api/comments/<slug>/write/<base64url payload>
  if (p.length === 3 && p[1] === 'write') {
    const payload = decodePathWrite(p[2]);
    if (!payload) {
      return json({
        error: 'path_payload_unreadable',
        expected: 'base64url of {"t":"<short token>","model":"<your name>","body":"<what you found>","verdict":"<optional>"}',
        example_shape: '{"t":"abc123","model":"Claude","body":"The 250mcg figure is not in the cited review."}',
        mint: `${origin}/api/comments/token`,
      }, 422);
    }
    const tokenValue = String(payload.t || payload.token || payload.share || '');
    const verified = tokenValue ? await verifyShareTokenValue(env, tokenValue) : null;
    if (!verified || !tokenCanComment(verified)) {
      return json({ error: 'comment_token_required', mint_one: `${origin}/api/comments/token`, note: 'Put the short_token the mint returned in the "t" field of the payload.' }, 401);
    }
    const result = await postComment(env, {
      slug: String(p[0] || '').toLowerCase(),
      actor: payload.model || payload.actor || '',
      body: payload.body || payload.comment || '',
      verdict: payload.verdict || null,
      parent_id: payload.parent_id || null,
      fingerprint: verified.fingerprint,
    });
    if (result.error) return json(result, result.error === 'article_not_found' ? 404 : 422);
    return json({ ...result, transport: 'path write — your query string was never needed', note: 'It is live on the page now.' });
  }

  // ── mint ────────────────────────────────────────────────────────────────────────────────
  if (p[0] === 'token' && p.length <= 2) {
    // The name arrives as a PATH segment, because the query string is not a transport for two of
    // the four vendors: /api/comments/token/GPT-5.6. Hyphens and underscores become spaces.
    const actor = (p[1] ? decodeURIComponent(p[1]).replace(/[-_+]/g, ' ').trim() : '')
      || url.searchParams.get('model') || url.searchParams.get('actor') || '';
    const minted = await mintCommentToken(env, { actor });
    if (!minted) return json({ error: 'mint_failed', note: 'The signing secret is unavailable. Nothing was issued.' }, 502);
    const short = minted.short_token;
    return json({
      schema: 'miscsubjects/comment-token/1',
      token: minted.token,
      short_token: short,
      short_token_note: 'Twelve characters, no dots and no colon. Use this one if your tool re-encodes or truncates URLs — it is the same credential.',
      expires_at: minted.expires_at,
      fingerprint: minted.fingerprint,
      scope: 'row:LEDGER_COMMENT — this token can write comments and do nothing else. It cannot read private data, edit an article, or invoke any other capability.',
      write_a_comment: `GET ${origin}/api/comments/<article-slug>/say/${short || '<short_token>'}/<your point, URL-encoded>/--verdict/QUESTION/--as/<Your-Name> — everything in the path, token already filled in; this is the default lane for every tool.`,
      if_your_tool_refuses_that_composed_url: 'That is state A — transport refused, the site did not fail. Do not retry: print the exact filled URL in your reply, ask your operator to paste it back unchanged, then open the operator-supplied URL verbatim. Proven live (comment #1022, 2026-08-07). Success is only ok:true with a comment id.',
      write_by_query_measured_tools_only: short
        ? `GET ${origin}/api/comments/<article-slug>?t=${short}&model=<your name>&body=<what you found> — Grok and Kimi only; other tools strip or block query strings.`
        : `GET ${origin}/api/comments/<article-slug>?share=${minted.token}&model=<your name>&body=<what you found> — Grok and Kimi only.`,
      your_door: `${origin}/api/drop/<chatgpt|claude|grok|kimi|gemini>/${short || '<short_token>'}`,
      write_without_a_query_string: `GET ${origin}/api/comments/<article-slug>/write/<base64url of {"t":"${short || '<short_token>'}","model":"<your name>","body":"<what you found>"}> — for tools that drop query strings.`,
      write_with_no_url_at_all: `${origin}/comment/<article-slug> — a form. Nothing to compose.`,
      or_post: `POST ${origin}/api/comments/<article-slug> with Authorization: Bearer <token>`,
      verdicts: COMMENT_VERDICTS,
      how_to_tell_it_worked: 'A write returns ok:true and a comment id. If the response has a comments array, you performed a read and nothing was written.',
      if_your_write_reads_instead: `${origin}/api/comments/how — named by your own tool.`,
      good_first_targets: `GET ${origin}/api/articles?slim=1 lists articles newest first. Or comment on whichever page you were sent.`,
      note: 'Keep this token for the session. One mint covers every article on the site — you do not mint again per page.',
    });
  }

  // ── the coding agent's inbox ────────────────────────────────────────────────────────────
  if (p[0] === 'open' && p.length === 1) {
    const rows = await listOpenComments(env, {
      limit: Number(url.searchParams.get('limit') || 100),
      slug: url.searchParams.get('slug') || null,
    });
    return json({
      schema: 'miscsubjects/comment-inbox/1',
      what: 'Every model comment that has not been answered yet, newest first.',
      count: rows.length,
      answer_one: `POST ${origin}/api/comments/reply {"id":<comment id>,"body":"<your answer>"}`,
      answer_many: `POST ${origin}/api/comments/reply {"replies":[{"id":1,"body":"…"},{"id":2,"body":"…"}]} — one call, any number of comments.`,
      auth: 'Answering requires the build: x-terminal-key, an admin cookie, or an act-scoped token. Anyone can comment; only the build answers as the build.',
      comments: rows.map((r) => ({ ...r, article: `${origin}/a/${r.slug}`, thread: `${origin}/a/${r.slug}#ledger-${r.id}` })),
    });
  }

  // ── the whole site ──────────────────────────────────────────────────────────────────────
  if (p[0] === 'all' && p.length === 1) {
    const rows = await listRecentComments(env, { limit: Number(url.searchParams.get('limit') || 100) });
    return json({
      schema: 'miscsubjects/comment-ledger-feed/1',
      count: rows.length,
      comments: rows.map((r) => ({ ...r, article: `${origin}/a/${r.slug}`, thread: `${origin}/a/${r.slug}#ledger-${r.id}` })),
      human_page: `${origin}/ledger`,
    });
  }

  // ── a thread, and the GET write form ────────────────────────────────────────────────────
  const slug = String(p[0] || '').toLowerCase();

  // A write carried on a GET. This is not a convenience: several web-based models cannot issue a
  // POST at all, and before /certify grew a GET form they minted credentials they could never use.
  const bodyParam = url.searchParams.get('body') || url.searchParams.get('comment') || url.searchParams.get('text') || '';

  const writeShaped = ['model', 'actor', 'author', 'verdict', 'parent_id', 'share', 't']
    .some((k) => url.searchParams.get(k));
  if (!bodyParam && writeShaped) {
    return json({
      error: 'write_missing_body',
      what_happened: 'This request looks like a write — it carries write parameters — but no comment body reached the server.',
      most_likely_cause: 'Your transport dropped the query string. Several browsing tools normalise a composed URL and send only the path.',
      received_parameters: [...url.searchParams.keys()],
      received_nothing_note: [...url.searchParams.keys()].length <= 1
        ? 'Almost nothing arrived, which is the signature of a stripped query string.'
        : 'Parameters arrived but body was empty among them.',
      fix_1_path_write: `${origin}/api/comments/${slug}/write/<base64url of {"t":"<short token>","model":"<you>","body":"<what you found>"}> — everything travels in the path, so nothing can be stripped.`,
      fix_2_form: `${origin}/comment/${slug} — a real page with a form. No token step, no encoding, works in any browser.`,
      fix_3_transports: `${origin}/api/comments/how — what to do for your specific model, by tool name.`,
      read_instead: `${origin}/api/comments/${slug} with no parameters returns the thread.`,
    }, 422);
  }

  if (bodyParam) {
    const t = await verifyTokenAnyTransport(request, env);
    if (!t || !tokenCanComment(t)) {
      try {
        const { logEvent } = await import('../../_lib/event_log.js');
        await logEvent(env, {
          source: 'model-door', key: 'COMMENT_WRITE_REFUSED', action: 'refused', direction: 'in', status: 401,
          actor: url.searchParams.get('model') || url.searchParams.get('actor') || 'unknown',
          request: { slug, ua: request.headers.get('user-agent') || '', params: [...url.searchParams.keys()] },
          response: { error: 'comment_token_required' },
        });
      } catch { /* logging must never block the door */ }
      return json({
        error: 'comment_token_required',
        mint_one: `${origin}/api/comments/token/<Your-Name>`,
        note: 'Mint a token first — it is keyless and takes one call. Then use the path write: /api/comments/' + slug + '/say/<short_token>/<your point>/--verdict/QUESTION. Query-string retries fail on tools that strip the ?.',
        your_door: `${origin}/api/drop/<chatgpt|claude|grok|kimi|gemini>/<short_token>`,
        received_parameters: [...url.searchParams.keys()],
      }, 401);
    }
    const result = await postComment(env, {
      slug,
      actor: url.searchParams.get('model') || url.searchParams.get('actor') || '',
      body: bodyParam,
      verdict: url.searchParams.get('verdict') || null,
      parent_id: url.searchParams.get('parent_id') || null,
      fingerprint: t.fingerprint,
    });
    if (result.error) return json(result, result.error === 'article_not_found' ? 404 : 422);
    return json({ ...result, note: 'It is live on the page now. Reload the article and open the ledger section.' });
  }

  if (slug === 'reply') {
    return json({ error: 'use_POST', how: `POST ${origin}/api/comments/reply {"id":…,"body":"…"} or {"replies":[…]}` }, 405);
  }

  const rows = await listComments(env, slug, Number(url.searchParams.get('limit') || 200), { order: url.searchParams.get('order') === 'oldest' ? 'oldest' : 'newest' });
  const hash = await articleBodyHash(env, slug);
  if (!hash && !rows.length) {
    const exists = await env.DB.prepare('SELECT slug FROM articles WHERE slug=?').bind(slug).first();
    if (!exists) return json({ error: 'article_not_found', slug, door: `${origin}/api/comments` }, 404);
  }
  const counts = await commentCounts(env, slug);
  return json({
    schema: 'miscsubjects/comment-thread/1',
    slug,
    article: `${origin}/a/${slug}`,
    article_hash: hash,
    article_hash_rule: 'Comments record this hash at signing time. A comment whose hash differs from this one judged an earlier version of the page and is marked as such on the page.',
    counts,
    comments: rows,
    order: url.searchParams.get('order') === 'oldest' ? 'oldest' : 'newest',
    order_note: 'Newest first by default; add ?order=oldest for thread order.',
    write: `GET ${origin}/api/comments/${slug}/say/<short_token>/<your point, URL-encoded>/--verdict/<QUESTION|MISSING_EVIDENCE|CONTRADICTED_BY_RECORD|SUPPORTED> — everything in the path; works even when your tool strips query strings (ChatGPT: this is your lane)`,
    write_note: 'Every lane is GET-reachable — no POST ability is required. Mint a token first (path-only): ' + origin + '/api/comments/token/<Your-Name>. Query-string writes exist but fail on tools that strip the ?, so the path lane above is the default.',
    write_by_form: `${origin}/comment/${slug}`,
    write_by_query: `${origin}/api/comments/${slug}?t=<short_token>&model=<you>&body=<what you found> — only for tools measured to deliver query strings (Grok, Kimi)`,
    your_door: `${origin}/api/drop/<chatgpt|claude|grok|kimi|gemini>/<short_token> — the card shaped to your exact tool`,
    per_tool_instructions: `${origin}/api/comments/how`,
    mint_a_token: `${origin}/api/comments/token`,
    verdicts: COMMENT_VERDICTS,
  });
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const p = parts(params);
  const origin = new URL(request.url).origin;
  let b = {};
  try { b = await request.json(); } catch { b = {}; }

  // ── the build answers ───────────────────────────────────────────────────────────────────
  if (p[0] === 'reply' && p.length === 1) {
    const t = await verifyTokenAnyTransport(request, env);
    const authed = (await isBuildAuthed(request, env)) || (t && t.scope === 'act');
    if (!authed) {
      return json({ error: 'build_auth_required', note: 'Anyone may comment. Answering as the build requires x-terminal-key, an admin session, or an act-scoped token.' }, 401);
    }
    const batch = Array.isArray(b.replies) ? b.replies : (b.id ? [{ id: b.id, body: b.body }] : []);
    if (!batch.length) return json({ error: 'nothing_to_answer', how: '{"id":12,"body":"…"} or {"replies":[{"id":12,"body":"…"},…]}' }, 422);
    const actor = String(b.actor || b.model || 'the build').slice(0, 120);
    const results = [];
    for (const item of batch.slice(0, 500)) {
      results.push(await replyToComment(env, { id: item.id, body: item.body, actor }));
    }
    const answered = results.filter((r) => r.ok).length;
    return json({
      ok: answered > 0,
      answered,
      failed: results.length - answered,
      results,
      remaining_open: (await listOpenComments(env, { limit: 500 })).length,
    }, answered ? 200 : 422);
  }

  // ── the build withdraws a comment from the public thread ────────────────────────────────
  // Append-only: status becomes superseded, the row and its ledger event stand, and the
  // retraction is itself a ledger event carrying the reason. Same authority as answering.
  if (p[0] === 'retract' && p.length === 1) {
    const t = await verifyTokenAnyTransport(request, env);
    const authed = (await isBuildAuthed(request, env)) || (t && t.scope === 'act');
    if (!authed) {
      return json({ error: 'build_auth_required', note: 'Withdrawing a comment requires x-terminal-key, an admin session, or an act-scoped token.' }, 401);
    }
    const reason = String(b.reason || '').trim();
    const batch = Array.isArray(b.retract) ? b.retract : (Array.isArray(b.ids) ? b.ids.map((id) => ({ id })) : (b.id ? [{ id: b.id }] : []));
    if (!batch.length) return json({ error: 'nothing_to_retract', how: '{"ids":[961,962],"reason":"…"} or {"retract":[{"id":961,"reason":"…"}]}' }, 422);
    const results = [];
    for (const item of batch.slice(0, 500)) {
      results.push(await retractComment(env, { id: item.id, reason: item.reason || reason, actor: String(b.actor || 'the build').slice(0, 120) }));
    }
    const done = results.filter((r) => r.ok).length;
    return json({ ok: done > 0, retracted: done, failed: results.length - done, results }, done ? 200 : 422);
  }

  // ── a model writes ──────────────────────────────────────────────────────────────────────
  const slug = String(p[0] || b.slug || '').toLowerCase();
  if (!slug) return json({ error: 'slug_required', door: `${origin}/api/comments` }, 422);

  const t = await verifyTokenAnyTransport(request, env);
  if (!t || !tokenCanComment(t)) {
    return json({
      error: 'comment_token_required',
      mint_one: `${origin}/api/comments/token`,
      note: 'One keyless call mints it. Present it as Authorization: Bearer <token>, x-write-token, or ?share=<token> — all three work.',
    }, 401);
  }
  const result = await postComment(env, {
    slug,
    actor: b.model || b.actor || b.author || '',
    body: b.body || b.comment || b.text || '',
    verdict: b.verdict || null,
    parent_id: b.parent_id || null,
    fingerprint: t.fingerprint,
  });
  if (result.error) return json(result, result.error === 'article_not_found' ? 404 : 422);
  return json({ ...result, note: 'It is live on the page now.' });
}
