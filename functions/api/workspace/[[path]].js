import { isBuildAuthed, verifyTokenAnyTransport } from '../../_lib/admin_session.js';
import { loadWorkspace, roleGrant, evaluateMutation, appendMutation, resolvePoolToken, MUTATION_OPS } from '../../_lib/workspace_object.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function pathParts(params) {
  const raw = params?.path;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return String(raw || '').split('/').filter(Boolean);
}

async function ledgerWorkspaceEvent(env, { slug, action, actor, request, response, status }) {
  const id = crypto.randomUUID();
  try {
    await env.LEDGER.prepare(
      'INSERT INTO events (id, ts, source, key, action, direction, status, request_json, response_json, trace_id) VALUES (?,?,?,?,?,?,?,?,?,?)'
    ).bind(
      id, new Date().toISOString(), 'workspace', 'WS_MUTATE', action, 'in', status || 200,
      scrubOwnerIdentity(JSON.stringify({ workspace: slug, ...request })), scrubOwnerIdentity(JSON.stringify(response)), 'ws_' + slug,
    ).run();
    return id;
  } catch { return null; }
}

export async function onRequestGet({ request, env, params }) {
  const parts = pathParts(params);
  if (!parts.length) {
    return json({
      schema: 'oip/workspace-spec/1',
      name: 'Workspace — a shared work object for humans and their AIs',
      one_sentence: 'A workspace is an addressable object that declares its work objects, its AI lanes, its roles with their complete authority, and its receipted mutation log; credentials name the workspace and a role, never tools, and resolve against the living declaration at every use.',
      object_model: {
        where_it_lives: 'A workspace IS an article object carrying meta.extra.workspace. Human page: /a/<slug>. Machine projection: /api/workspace/<slug>. Same identity, same history, same ledger as every other object on this site.',
        declaration_schema: {
          version: 'integer',
          purpose: 'string — what this workspace runs',
          status: 'active | archived',
          members: '[{role, ai:{vendor, model}}] — the lanes operating this workspace',
          roles: '{<role>: {rows:[CAPABILITY_KEY...], ops:[mutation-op...], public:bool}} — the COMPLETE authority table; anything not listed is denied',
          objects: '[article-slug...] — the work objects inside the boundary',
          lineage: '[{from, to, rel:"derives"}] — work built on work',
          policies: '[string...] — plain-language statements of the rules the lanes run under',
          mutations: '[{id, ts, op, target, actor, role, credential, detail, decision, decision_reason, ledger_event_id}] — the append-only structural log, DENIED entries included',
        },
      },
      credential_grammar: {
        scope: 'pool:<workspace-slug>:<role> — a signed, expiring, fingerprinted token. It names NO capabilities.',
        resolution: 'At every exercise the gate loads the workspace, reads roles[<role>].rows, and that list — nothing else — is what the credential may invoke. Re-declare a role and every outstanding credential narrows instantly.',
        boundary: 'Any invocation whose body names an object slug is refused unless that slug is in the workspace object set (error: pool_object_boundary). Rows grant verbs against the POOL’S work, never account-wide.',
        attenuation: 'Pool credentials do not attenuate into other scopes and no other scope mints into a pool — fail closed in both directions; re-enter through the workspace for a narrower role.',
        transport: 'Authorization: Bearer <token>, ?share=<token>, or body {"key":<token>} — one credential, every transport.',
      },
      mutation_contract: {
        ops: MUTATION_OPS,
        rule: 'A structural change is a REQUEST. The gate evaluates the credential’s role against roles[<role>].ops: listed → APPROVED and applied; not listed → DENIED and recorded. Both outcomes append to the workspace log AND to the public ledger. The role comes from the credential, never from the request body.',
        receipts: 'Every decision returns ledger_event_id. Resolve it publicly: GET /api/workspace/<slug>/receipt/<ledger_event_id> — the raw ledger row, request and response json included.',
        design_note: 'Three verbs by design. Verbs are added when a real workspace demands them, not before.',
      },
      how_to_enter: {
        observer: 'GET /api/workspace/<slug>/enter?role=observer&actor=<you> — one URL, no key, works from a browsing model that can only GET. (POST with the same fields works identically.) Returns the live token, its fingerprint, expiry, and the exact grant.',
        privileged: 'Roles that can mutate are minted only under the workspace owner’s key. Asking without it returns a receipted 403 — the refusal is part of the record.',
        invited_seat: 'A seat link claims by GET too: /api/workspace/<slug>/claim?code=<invite-code>.',
        first_calls: [
          'GET /api/workspace/<slug> — the full live state',
          'GET /api/dispatch?invoke=WEB_FETCH&body=GET|https://miscsubjects.com/api/workspace/<slug>||&share=<your-token> — a receipted read under your own credential',
          'GET /api/dispatch?explain=1&share=<your-token> — what your credential may do, from the server’s mouth',
        ],
      },
      verify_dont_take_our_word: {
        live_instance: 'GET /api/workspace/ad-operations-q3',
        what_to_check: [
          'Its mutation log contains a DENIED entry (finance role, add-object) with a resolvable receipt — the gate refusing is the load-bearing proof.',
          'Its objects carry revision chains: the repaired divs preserve the pre-repair state (GET /api/articles/adops-q3-creative-deck/voxels — d7 chain).',
          'Each lane’s model calls are on the gateway record with vendor-distinct completions.',
        ],
      },
      human_pages: {
        live_workspace: 'https://miscsubjects.com/a/ad-operations-q3',
        category: 'https://miscsubjects.com/a/the-work-is-the-workspace',
        plain_words_offer: 'https://miscsubjects.com/a/what-this-site-sells',
      },
    });
  }
  if (parts.length === 2 && ['enter', 'claim', 'mutate'].includes(String(parts[1] || '').toLowerCase())) {
    const q = new URL(request.url).searchParams;
    const laneName = String(parts[1]).toLowerCase();
    const bodyObj = laneName === 'enter'
      ? { role: q.get('role') || 'observer', actor: q.get('actor') || 'get-form-visitor', uses: q.get('uses') || undefined }
      : laneName === 'claim'
      ? { code: q.get('code') || '' }
      : {
          op: q.get('op') || '', target: q.get('target') || '', actor: q.get('actor') || '',
          detail: { reason: q.get('reason') || undefined, derives_from: q.get('derives_from') || undefined, edit_receipt: q.get('edit_receipt') || undefined },
        };
    const synthetic = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(bodyObj),
    });
    return onRequestPost({ request: synthetic, env, params });
  }
  // RECEIPT RESOLUTION — every mutation decision names a ledger event; this lane serves the
  // raw row publicly so APPROVED and DENIED alike are checkable by strangers.
  if (parts.length === 3 && parts[1] === 'receipt') {
    const slug = String(parts[0] || '').toLowerCase();
    const id = String(parts[2] || '');
    const row = await env.LEDGER.prepare(
      "SELECT id, ts, source, key, action, status, request_json, response_json, trace_id FROM events WHERE id = ? AND source = 'workspace' LIMIT 1"
    ).bind(id).first();
    if (!row) return json({ error: 'receipt_not_found', id }, 404);
    let req = null, res = null;
    try { req = JSON.parse(row.request_json || 'null'); } catch {}
    try { res = JSON.parse(row.response_json || 'null'); } catch {}
    if (req && String(req.workspace || '') !== slug) return json({ error: 'receipt_belongs_to_other_workspace', id }, 404);
    return json({
      schema: 'oip/workspace-receipt/1',
      receipt: { id: row.id, ts: row.ts, action: row.action, status: row.status, request: req, response: res, trace_id: row.trace_id },
      workspace: `https://miscsubjects.com/api/workspace/${slug}`,
      note: 'The raw ledger row for this structural decision. DENIED rows resolve exactly like APPROVED ones — the refusal is part of the record.',
    });
  }
  const slug = String(parts[0] || '').toLowerCase();
  const loaded = await loadWorkspace(env, slug);
  if (loaded.error) return json(loaded, 404);
  const { article, ws } = loaded;
  const origin = new URL(request.url).origin;
  const roles = {};
  for (const [name, r] of Object.entries(ws.roles || {})) {
    const g = roleGrant(ws, name);
    roles[name] = {
      rows: g.rows.map((k) => ({ key: k, docs: origin + '/api/dispatch?explain=1&key=' + encodeURIComponent(k) })),
      ops: g.ops,
      mint: g.public
        ? 'POST ' + origin + '/api/workspace/' + slug + '/enter {"role":"' + name + '","actor":"<you>"} — public role, mints openly'
        : 'privileged role — mints only under the workspace owner’s key',
    };
  }
  return json({
    schema: 'oip/workspace-projection/1',
    workspace: slug,
    title: article.title,
    human_view: 'https://miscsubjects.com/a/' + slug,
    purpose: ws.purpose || null,
    status: ws.status || 'active',
    members: ws.members || [],
    roles,
    policies: ws.policies || [],
    objects: (ws.objects || []).map((s) => ({
      slug: s,
      article: 'https://miscsubjects.com/a/' + s,
      object: origin + '/api/articles/' + s,
      proof: origin + '/api/proven-work/' + s,
    })),
    lineage: ws.lineage || [],
    mutation_contract: {
      ops: MUTATION_OPS,
      rule: 'A mutation is a request evaluated against the role’s declared ops. In-policy → APPROVED and applied; out-of-policy → DENIED and recorded. Both are receipts on the public ledger.',
      lane: 'POST ' + origin + '/api/workspace/' + slug + '/mutate',
    },
    mutations: (ws.mutations || []).slice(-40),
    boundary: 'Pool credentials grant rows against this workspace’s object set only. A slug-bearing mutation outside it is denied at the door — the denial is itself a receipt.',
  });
}

export async function onRequestPost({ request, env, params }) {
  const parts = pathParts(params);
  const slug = String(parts[0] || '').toLowerCase();
  const lane = String(parts[1] || '').toLowerCase();
  if (!slug || !['enter', 'mutate', 'invite', 'claim'].includes(lane)) return json({ error: 'use_POST_/api/workspace/<slug>/enter_/mutate_/invite_or_/claim' }, 404);
  const loaded = await loadWorkspace(env, slug);
  if (loaded.error) return json(loaded, 404);
  const { ws } = loaded;
  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'body_must_be_json' }, 400); }

  if (lane === 'invite') {
    if (!(await isBuildAuthed(request, env))) return json({ error: 'owner_only', note: 'Creating a seat is the workspace owner’s act. POST with the owner key.' }, 403);
    const role = String(body.role || '').toLowerCase();
    const grant = roleGrant(ws, role);
    if (!grant) return json({ error: 'role_not_declared', declared: Object.keys(ws.roles || {}) }, 422);
    const name = String(body.name || '').slice(0, 80) || null;
    const code = [...crypto.getRandomValues(new Uint8Array(9))].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');
    const invite = { workspace: slug, role, name, created: new Date().toISOString(), claims_left: Math.max(1, Math.min(10, Number(body.claims) || 1)) };
    await env.KV.put('wsinvite:' + code, JSON.stringify(invite), { expirationTtl: 60 * 60 * 24 * 30 });
    await ledgerWorkspaceEvent(env, {
      slug, action: 'invite_created', actor: 'owner',
      request: { role, name, claims: invite.claims_left }, response: { created: true, code_prefix: code.slice(0, 4) + '…' }, status: 200,
    });
    const origin = new URL(request.url).origin;
    return json({
      ok: true,
      send_this_link: `${origin}/workspace/${slug}/join/${code}`,
      seat: { workspace: slug, role, name, claims: invite.claims_left, expires: '30 days' },
      what_the_recipient_sees: 'A plain-English page: what this workspace is, what their seat may do, one button to claim it, and the single block they paste into any AI they already use.',
    });
  }

  // CLAIM — the recipient's side of an invite. Validates the code, burns a claim, mints the
  // seat's live credential, and returns the paste block. The token travels only in this
  // JSON response to the claimant — never in served HTML.
  if (lane === 'claim') {
    const code = String(body.code || '').trim().toLowerCase();
    if (!code) return json({ error: 'code_required' }, 400);
    const raw = await env.KV.get('wsinvite:' + code);
    if (!raw) return json({ error: 'invite_invalid_or_expired', note: 'Ask the person who sent you the link for a fresh one.' }, 404);
    let invite = {}; try { invite = JSON.parse(raw); } catch {}
    if (invite.workspace !== slug) return json({ error: 'invite_invalid_or_expired' }, 404);
    if (!(invite.claims_left > 0)) return json({ error: 'invite_already_claimed', note: 'This seat was already claimed. Ask for a fresh link.' }, 409);
    const grant = roleGrant(ws, invite.role);
    if (!grant) return json({ error: 'role_no_longer_declared', role: invite.role }, 409);
    const origin = new URL(request.url).origin;
    const mintUrl = new URL('/api/dispatch', origin);
    mintUrl.searchParams.set('mint_share', '1');
    mintUrl.searchParams.set('scope', 'pool');
    mintUrl.searchParams.set('workspace', slug);
    mintUrl.searchParams.set('role', invite.role);
    mintUrl.searchParams.set('ttl', String(60 * 60 * 24 * 7));
    mintUrl.searchParams.set('uses', '200');
    mintUrl.searchParams.set('purpose', 'workspace:' + slug + ':' + invite.role + ':seat' + (invite.name ? ':' + invite.name : ''));
    mintUrl.searchParams.set('actor', invite.name || 'invited-member');
    const headers = new Headers();
    if (env.TERMINAL_KEY) headers.set('x-terminal-key', env.TERMINAL_KEY);
    const mintedResponse = await fetch(mintUrl, { headers });
    let minted = {}; try { minted = await mintedResponse.json(); } catch {}
    if (!mintedResponse.ok || !minted?.ok || !minted?.share_token) {
      return json({ error: 'seat_mint_failed', status: mintedResponse.status, cause: minted?.error || 'invalid_mint_response' }, 502);
    }
    invite.claims_left -= 1;
    invite.claimed_at = new Date().toISOString();
    invite.fingerprint = minted.fingerprint;
    await env.KV.put('wsinvite:' + code, JSON.stringify(invite), { expirationTtl: 60 * 60 * 24 * 30 });
    await ledgerWorkspaceEvent(env, {
      slug, action: 'seat_claimed', actor: invite.name || 'invited-member',
      request: { role: invite.role, code_prefix: code.slice(0, 4) + '…' }, response: { minted: true, fingerprint: minted.fingerprint, expires_at: minted.expires_at }, status: 200,
    });
    const pasteBlock = [
      `You are joining a shared team workspace as its "${invite.role}" seat${invite.name ? ' (' + invite.name + ')' : ''}. The workspace is a live object at ${origin}/api/workspace/${slug} — fetch that URL first: it lists the work objects, every role's exact authority, and the receipted change log.`,
      ``,
      `Your live credential (expires ${minted.expires_at}, fingerprint ${minted.fingerprint}):`,
      `${minted.share_token}`,
      ``,
      `What your seat may invoke: ${grant.rows.join(', ') || 'read-only'}. What it may change: ${grant.ops.join(', ') || 'nothing — structural change requests from this seat are refused and the refusal is recorded'}.`,
      ``,
      `Use it on any call as Authorization: Bearer <credential> or ?share=<credential>. Everything works by plain GET. Start with:`,
      `1. GET ${origin}/api/workspace/${slug} — the live state`,
      `2. GET ${origin}/api/dispatch?explain=1&share=<credential> — the server's own statement of what you may do`,
      `3. GET ${origin}/api/dispatch?invoke=WEB_FETCH&body=${encodeURIComponent('GET|' + origin + '/api/workspace/' + slug + '||')}&share=<credential> — a receipted read; the receipt is yours`,
      `4. To request a structural change (decided against your role, both outcomes receipted): GET ${origin}/api/workspace/${slug}/mutate?op=<${MUTATION_OPS.join('|')}>&target=<object-slug>&reason=<url-encoded reason>&actor=<you>&share=<credential>`,
      ``,
      `Every action you take lands a receipt on the public ledger under your fingerprint. The human page: ${origin}/a/${slug}`,
    ].join('\n');
    return json({
      ok: true,
      workspace: slug,
      role: invite.role,
      seat_name: invite.name,
      fingerprint: minted.fingerprint,
      expires_at: minted.expires_at,
      token: minted.share_token,
      grants: { rows: grant.rows, ops: grant.ops },
      paste_block: pasteBlock,
      note: 'Paste the block into whatever AI you already use — ChatGPT, Claude, Gemini, anything that can fetch a URL. Your AI is then operating in the workspace under this seat.',
    });
  }

  if (lane === 'enter') {
    const role = String(body.role || '').toLowerCase();
    const actor = String(body.actor || 'anonymous').slice(0, 120);
    const grant = roleGrant(ws, role);
    if (!grant) return json({ error: 'role_not_declared', declared: Object.keys(ws.roles || {}) }, 422);
    const ownerAuthed = await isBuildAuthed(request, env);
    if (!grant.public && !ownerAuthed) {
      await ledgerWorkspaceEvent(env, {
        slug, action: 'enter_denied', actor,
        request: { role, public: false }, response: { denied: true, reason: 'privileged_role_requires_owner_mint' }, status: 403,
      });
      return json({ error: 'privileged_role_requires_owner_mint', role, note: 'This role can mutate the work; its credential is minted by the workspace owner. Public roles: ' + Object.entries(ws.roles || {}).filter(([, r]) => r.public).map(([n]) => n).join(', ') }, 403);
    }
    const origin = new URL(request.url).origin;
    const mintUrl = new URL('/api/dispatch', origin);
    mintUrl.searchParams.set('mint_share', '1');
    mintUrl.searchParams.set('scope', 'pool');
    mintUrl.searchParams.set('workspace', slug);
    mintUrl.searchParams.set('role', role);
    mintUrl.searchParams.set('ttl', String(60 * 60 * 24 * 7));
    mintUrl.searchParams.set('uses', String(body.uses ? Math.max(1, Math.min(500, Number(body.uses) || 0)) : 200));
    mintUrl.searchParams.set('purpose', 'workspace:' + slug + ':' + role);
    mintUrl.searchParams.set('actor', actor);
    const headers = new Headers();
    const terminalKey = request.headers.get('x-terminal-key') || env.TERMINAL_KEY || '';
    if (terminalKey) headers.set('x-terminal-key', terminalKey);
    const cookie = request.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);
    const mintedResponse = await fetch(mintUrl, { headers });
    let minted = {}; try { minted = await mintedResponse.json(); } catch {}
    if (!mintedResponse.ok || !minted?.ok || !minted?.share_token) {
      return json({ error: 'pool_token_mint_failed', status: mintedResponse.status, cause: minted?.error || 'invalid_mint_response' }, 502);
    }
    await ledgerWorkspaceEvent(env, {
      slug, action: 'enter', actor,
      request: { role, fingerprint: minted.fingerprint }, response: { minted: true, fingerprint: minted.fingerprint, expires_at: minted.expires_at }, status: 200,
    });
    return json({
      ok: true,
      workspace: slug,
      role,
      grants: { rows: grant.rows, ops: grant.ops },
      fingerprint: minted.fingerprint,
      expires_at: minted.expires_at,
      token: minted.share_token,
      how: 'Present as Authorization: Bearer <token> (or ?share=). Rows resolve from this workspace’s living declaration at every exercise; every use lands a receipt.',
      boundary: 'Slug-bearing mutations outside this workspace’s object set are denied at the door.',
      mutate: 'POST ' + origin + '/api/workspace/' + slug + '/mutate {"op":"...","target":"...","detail":{...}}',
      get_only_clients: 'Everything works by GET too: enter at ' + origin + '/api/workspace/' + slug + '/enter?role=<role>&actor=<you>; file a mutation at ' + origin + '/api/workspace/' + slug + '/mutate?op=<op>&target=<object-slug>&reason=<url-encoded>&actor=<you>&share=<credential>; invocations run at ' + origin + '/api/dispatch?invoke=<KEY>&body=<url-encoded>&share=<credential>.',
    });
  }

  // MUTATE — the governance lane. The role comes from the CREDENTIAL, never from the body:
  // a caller cannot assert its way into authority it was not minted.
  const ownerAuthed = await isBuildAuthed(request, env);
  let role = null, actorFingerprint = null;
  if (ownerAuthed) {
    role = String(body.as_role || 'owner').toLowerCase();
    actorFingerprint = 'owner';
  } else {
    const tok = await verifyTokenAnyTransport(request, env);
    if (!tok || tok.scope !== 'pool' || !tok.pool) {
      return json({ error: 'pool_credential_required', note: 'Mutations are decided against the role carried by a pool credential for this workspace. Enter first: POST /api/workspace/' + slug + '/enter' }, 401);
    }
    if (tok.pool.workspace !== slug) {
      return json({ error: 'wrong_workspace', credential_workspace: tok.pool.workspace, this_workspace: slug }, 403);
    }
    await resolvePoolToken(env, tok);
    role = tok.pool.role;
    actorFingerprint = tok.fingerprint;
  }
  const op = String(body.op || '').toLowerCase();
  const target = String(body.target || '').toLowerCase() || null;
  const actor = String(body.actor || '').slice(0, 160) || null;
  const detail = (body.detail && typeof body.detail === 'object') ? body.detail : {};
  const verdict = ownerAuthed && role === 'owner'
    ? { decision: 'APPROVED', reason: 'owner_authority' }
    : evaluateMutation(ws, role, op);

  if (verdict.decision === 'APPROVED' && op === 'add-object' && target) {
    const exists = await env.DB.prepare('SELECT slug FROM articles WHERE slug=?').bind(target).first();
    if (!exists) {
      verdict.decision = 'DENIED';
      verdict.reason = 'target_object_does_not_exist';
    }
  }

  const entry = {
    id: 'wsm_' + crypto.randomUUID().slice(0, 8),
    ts: new Date().toISOString(),
    op, target, actor, role,
    credential: actorFingerprint,
    detail: {
      derives_from: detail.derives_from ? String(detail.derives_from) : undefined,
      reason: detail.reason ? String(detail.reason).slice(0, 800) : undefined,
      edit_receipt: detail.edit_receipt ? String(detail.edit_receipt).slice(0, 60) : undefined,
    },
    decision: verdict.decision,
    decision_reason: verdict.reason,
  };
  entry.ledger_event_id = await ledgerWorkspaceEvent(env, {
    slug, action: op || 'unknown', actor: actor || actorFingerprint,
    request: { op, target, role, credential: actorFingerprint, detail: entry.detail },
    response: { decision: verdict.decision, reason: verdict.reason },
    status: verdict.decision === 'APPROVED' ? 200 : 403,
  });
  await appendMutation(env, slug, entry); // both decisions are part of the record; only APPROVED add-object mutates the object set
  return json({
    ok: verdict.decision === 'APPROVED',
    decision: verdict.decision,
    reason: verdict.reason,
    mutation: entry,
    receipt: entry.ledger_event_id,
    note: verdict.decision === 'APPROVED'
      ? 'Applied and recorded. The workspace projection now carries this mutation.'
      : 'Denied and recorded. The denial is a receipt: bounded authority means the gate says no in writing.',
  }, verdict.decision === 'APPROVED' ? 200 : 403);
}
