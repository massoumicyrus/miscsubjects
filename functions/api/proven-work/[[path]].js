import { isBuildAuthed } from '../../_lib/admin_session.js';
import { scrubOwnerIdentity } from '../../_lib/public_secret_guard.js';
import { buildProvenWorkProjection, formatProvenWorkDrop, redactProvenWorkValue } from '../../_lib/proven_work_projection.js';
import { readEventFull } from '../../_lib/event_log.js';
import { getInvocation } from '../../_lib/invocation_log.js';
import { synthesizeManifest } from '../../_lib/proven_work_widget.js';

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

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str || '')));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function loadArticle(env, slug) {
  const article = await env.DB.prepare('SELECT slug,title,body,meta FROM articles WHERE slug=?').bind(slug).first();
  if (!article) return { error: 'article_not_found', slug };
  let meta = {};
  try { meta = JSON.parse(article.meta || '{}'); } catch {}
  // HASH-BOUND PROOF (owner order 2026-08-03): every token, receipt, and verdict names the
  // exact article version it applies to. The hash is the same body_hash the write path's
  // optimistic-concurrency law uses, so one identity covers reads, writes, and verdicts —
  // a verdict signed against one version can never silently apply to a later edit.
  const articleHash = await sha256Hex(article.body || '');
  const manifest = meta?.extra?.proven_work;
  // TAP-AND-GO, EVERY ARTICLE (owner order 2026-08-03): a page without a hand-bound
  // manifest gets one synthesized at read time from its own stored records, so every
  // article on the site is an isolated, inspectable proof object. Reading is the
  // onboarding: the inspect lane below mints the reader's delegation per call.
  if (!manifest || typeof manifest !== 'object') {
    return { article, manifest: synthesizeManifest(slug, article.title, meta), synthesized: true, articleHash };
  }
  return { article, manifest, articleHash };
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  const parts = pathParts(params);
  // GET FORMS OF THE POST LANES (outside-model finding, 2026-08-03: web ChatGPT minted an
  // inspection receipt but could not close the loop — its transport cannot POST). certify
  // and drop now run identically over GET with query params; the inspect response returns
  // the signing URL ready to fill. One door, both verbs.
  if (parts.length === 2 && ['certify', 'drop'].includes(String(parts[1] || '').toLowerCase())) {
    const q = new URL(request.url).searchParams;
    const lane = String(parts[1]).toLowerCase();
    const bodyObj = lane === 'certify'
      ? {
          verdict: q.get('verdict') || '', model: q.get('model') || '', grounds: q.get('grounds') || '',
          claim_tested: q.get('claim_tested') || undefined,
          inspection_receipt: q.get('inspection_receipt') || '',
          verification_receipts: String(q.get('verification_receipts') || '').split(',').map((x) => x.trim()).filter(Boolean),
        }
      : {};
    const synthetic = new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(bodyObj) });
    return onRequestPost({ request: synthetic, env, params });
  }
  // TAP-AND-GO (owner order 2026-08-03): GET /api/proven-work/<slug>/inspect is the one-step
  // door — no key, no account. The server mints the scoped token itself, executes the
  // receipted read through the same dispatch lane a stranger's token would use, and returns
  // the record plus the caller's own inspection receipt and certify instructions. No bearer
  // ever appears in a stored body or served page; the egress guard stays intact.
  if (parts.length === 2 && parts[1] === 'inspect') {
    const slug = String(parts[0] || '').toLowerCase();
    const loaded = await loadArticle(env, slug);
    if (loaded.error) return json(loaded, 404);
    const origin = new URL(request.url).origin;
    const dropReq = new Request(`${origin}/api/proven-work/${slug}/drop`, { method: 'POST' });
    const drop = await onRequestPost({ request: dropReq, env, params: { path: [slug, 'drop'] } });
    let minted = {}; try { minted = await drop.json(); } catch {}
    const inspectUrl = (minted.block || '').match(/inspect: (\S+)/)?.[1] || null;
    if (!inspectUrl) return json({ error: 'inspect_mint_failed', detail: minted.error || null }, 502);
    let read = {}; let readStatus = 0;
    try { const r = await fetch(inspectUrl); readStatus = r.status; read = await r.json(); } catch (e) { read = { error: String(e && e.message || e) }; }
    return json({
      schema: 'oip/proven-work-inspect/1',
      what: 'A completed, receipted inspection of this proven work object. The manifest below is the record’s index; the receipt is yours; the full evidence room (raw formation payloads) is one further GET.',
      work: `https://miscsubjects.com/a/${slug}`,
      inspection_receipt: read?.proof?.invocation_id || null,
      public_receipt: read?.proof?.invocation_id ? `https://miscsubjects.com/receipt/${read.proof.invocation_id}` : null,
      read_status: readStatus,
      // TIMEOUT FIX (outside-model finding, 2026-08-03: browser runtimes killed this lane
      // twice at the third internal round-trip). The inspect response is now built
      // in-process from the already-loaded manifest — status, requirements, hashes,
      // certifications — and POINTS to the full evidence room instead of inlining every
      // raw gateway payload. One mint, one receipted read, no third fetch.
      projection: {
        work_id: loaded.manifest.work_id || 'page:' + slug,
        status: evaluateManifestStatus(loaded.manifest.requirements),
        claim: loaded.manifest.claim || loaded.article.title,
        article_hash: loaded.articleHash || null,
        requirements: loaded.manifest.requirements || [],
        certifications_count: Array.isArray(loaded.manifest.certifications) ? loaded.manifest.certifications.length : 0,
        last_certifications: (Array.isArray(loaded.manifest.certifications) ? loaded.manifest.certifications : []).slice(-3),
        synthesized: !!loaded.synthesized,
        evidence_room: `${origin}/api/proven-work/${slug}`,
        evidence_room_note: 'The full projection — raw formation payloads, workroom declaration, delegation contract — is that one GET. It is larger and slower by design; this inspect stays fast so the receipt always mints.',
        status_definitions: {
          PROVEN: 'every requirement computes PASS against the record',
          PARTIAL: 'at least one requirement is a named GAP — declared on the object, not hidden',
          FAIL: 'a requirement is contradicted by the record',
          rule: 'Status is computed from the manifest against the record, never asserted by the operator.',
        },
      },
      your_token: { expires_at: minted.expires_at || null, fingerprint: minted.fingerprint || null,
        note: 'The same scoped token backs this read; mint your own durable one: POST /api/proven-work/' + slug + '/drop' },
      certify: {
        browser_safe_get: `${origin}/api/proven-work/${slug}/certify?verdict=<SUPPORTED_BY_RECORD|MISSING_EVIDENCE|CONTRADICTED_BY_RECORD|PROVED|DISPROVED|QUESTION|OBJECTION>&model=<your model name>&grounds=<url-encoded, citing record ids>&inspection_receipt=${encodeURIComponent(read?.proof?.invocation_id || '')}`,
        note: 'Your inspection receipt is already filled in above — set verdict, model, and grounds, then fetch. POST with the same fields works identically.',
        post_form: `POST ${origin}/api/proven-work/${slug}/certify`,
        body: { verdict: 'SUPPORTED_BY_RECORD | MISSING_EVIDENCE | CONTRADICTED_BY_RECORD', model: '<your model>', grounds: '<what you checked, citing record ids>', inspection_receipt: read?.proof?.invocation_id || '<from this response>' },
        rule: 'Certification costs proof of reading; the inspection_receipt above satisfies it.',
      },
    });
  }
  if (!parts.length) {
    return json({
      schema: 'oip/proven-work/1',
      the_product: 'Proven work: AI work that arrives with its proof — the deliverable, the complete formation record (raw request+response payloads, hash-chained on a public ledger, head anchored to drand and Bitcoin), and a door any stranger can open. Every inspection leaves its own receipt.',
      base_unit: 'A claim, a record, and a door. Everything else — completeness, robustness, replay — is a query you run against the record.',
      the_offer: {
        try_free: 'Run the one-step demo below — no key, no account. If your model signs a verdict, it lands on the public ledger.',
        email_one_case: 'Email one bounded case to build@miscsubjects.com — check AI work you were given, or get an answer made on the record by independent models under a pinned ruleset. First case free.',
        wrap_a_workflow: 'Issue a narrow, expiring token to one of your AI workflows; each result comes back with a proven_work field (claim + record + door). First workflow free to map.',
        in_plain_words: 'https://miscsubjects.com/a/what-this-site-sells',
      },
      one_step_demo: 'GET /api/proven-work/three-models-deliberate-one-statutory-question/inspect — returns the record plus YOUR inspection receipt. No key, no account.',
      projection: 'GET /api/proven-work/<article-slug> — the raw proof object (manifest + full evidence payloads).',
      your_own_token: 'POST /api/proven-work/<article-slug>/drop — mints a scoped 7-day token, unlimited receipted reads.',
      certify: 'POST /api/proven-work/<article-slug>/certify {verdict, model, grounds, inspection_receipt} — sign your verdict onto the ledger; requires the receipt your inspection returned.',
      verdicts: ['SUPPORTED_BY_RECORD', 'MISSING_EVIDENCE', 'CONTRADICTED_BY_RECORD'],
      the_standard: 'https://miscsubjects.com/a/proven-work',
      external_anchor: 'https://miscsubjects.com/api/anchor/fbf9bdbc890eb0004d166790252b96b9c6bfaa7af68bf75fdfc81f8bd7400154 — the chain head bound to drand round 6343866 and Bitcoin block 960842.',
      live_examples: ['three-models-deliberate-one-statutory-question', 'eu-ai-act-complete-compliance-guide', 'custody-of-the-answer', 'proven-work-example-one'],
    });
  }

  const slug = parts[0].toLowerCase();
  const loaded = await loadArticle(env, slug);
  if (loaded.error) return json(loaded, 404);
  const { article, manifest } = loaded;

  const ids = [...new Set((manifest.evidence?.agent_turn_ids || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 20);
  let formationRecords = [];
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT id,ts,agent,source,trace_id,turn_key,model_id,n_tools,user_input_sha256,assistant_sha256,user_input,assistant_text,tools_json,commands_json,files_json,tags_json
       FROM agent_turns WHERE id IN (${placeholders}) ORDER BY id ASC`
    ).bind(...ids).all();
    formationRecords = rows.results || [];
  }
  // THE EVIDENCE ROOM (field audits, 2026-08-03: "the door opens the lobby"). Every inv_
  // receipt named in the manifest's evidence arrays resolves here to its full recorded
  // model payload — request and response together, redacted at egress — so the public
  // projection carries the record itself, not pointers a stranger cannot follow.
  const invIds = [...new Set(
    [manifest.evidence?.receipts, ...(manifest.requirements || []).map((r) => r.evidence)]
      .flat().filter((x) => /^inv_/i.test(String(x || '')))
  )].slice(0, 12);
  for (const id of invIds) {
    try {
      const inv = await getInvocation(env, id);
      if (!inv) { formationRecords.push({ receipt: id, error: 'invocation_not_found' }); continue; }
      let ev = null;
      try {
        const rs = (await env.LEDGER.prepare(
          "SELECT id FROM events WHERE trace_id = ? AND action = 'chat_completion' ORDER BY ts ASC, id ASC LIMIT 5")
          .bind(String(inv.trace_id || '')).all()).results || [];
        for (const r of rs) {
          const cand = await readEventFull(env, r.id);
          if (!cand) continue;
          let rq = cand.request_json;
          if (typeof rq === 'string') { try { rq = JSON.parse(rq); } catch {} }
          if (rq?.model || rq?.body?.model) { ev = cand; break; }
          if (!ev) ev = cand;
        }
      } catch {}
      if (!ev && inv.event_id) ev = await readEventFull(env, inv.event_id);
      if (!ev) { formationRecords.push({ receipt: id, object_id: inv.object_id || null, ts: inv.ts || null, error: 'no_gateway_record' }); continue; }
      let req = ev.request_json, res = ev.response_json;
      if (typeof req === 'string') { try { req = JSON.parse(req); } catch {} }
      if (typeof res === 'string') { try { res = JSON.parse(res); } catch {} }
      formationRecords.push(redactProvenWorkValue({
        receipt: id, object_id: inv.object_id || ev.key || null, ts: ev.ts || inv.ts || null,
        trace_id: inv.trace_id || ev.trace_id || null,
        request: req ?? null, response: res ?? null,
        public_receipt: 'https://miscsubjects.com/receipt/' + id,
      }));
    } catch (e) {
      formationRecords.push({ receipt: id, error: 'load_failed:' + (e && e.message || e) });
    }
  }

  const projection = buildProvenWorkProjection({ slug, manifest, formationRecords });
  projection.title = article.title;
  // The exact version this proof object covers. A verdict citing this hash can never
  // silently apply to a later edit of the page.
  projection.article_hash = loaded.articleHash || null;
  projection.article_hash_rule = 'Every token, receipt, and verdict on this object names this hash. If a re-read returns a different article_hash, the page changed after your reading — re-inspect before signing.';
  // THE WORKROOM DECLARATION (owner order 2026-08-03): the object names the capabilities a
  // reader's token may exercise against it, so an outside AI knows instantly what it is
  // allowed to invoke. Hand-bound manifests may declare `capabilities: [ROW_KEY, ...]`;
  // every object carries the universal read-verdict set. Tools are bound to the WORK, not
  // to the agent: a scoped token into the pool inherits exactly these and nothing else.
  {
    const declared = Array.isArray(manifest.capabilities)
      ? manifest.capabilities.map((k) => String(k || '').toUpperCase()).filter(Boolean).slice(0, 24)
      : [];
    projection.workroom = {
      what: 'The capabilities any authorized reader may exercise against this object. Tokens are scoped to the object, never to the operator: mint one and you inherit exactly this list.',
      universal: [
        { key: 'INSPECT', how: `GET https://miscsubjects.com/api/proven-work/${slug}/inspect`, grants: 'the proof package + your own inspection receipt; no key needed — this call mints your delegation' },
        { key: 'HOLD_TOKEN', how: `POST https://miscsubjects.com/api/proven-work/${slug}/drop`, grants: 'a 7-day fingerprinted token for unlimited receipted reads of this object' },
        { key: 'SIGN_VERDICT', how: `POST https://miscsubjects.com/api/proven-work/${slug}/certify`, grants: 'append a signed disposition to this object’s public ledger; strong verdicts cost verification' },
      ],
      declared_capabilities: declared.map((k) => ({
        key: k,
        docs: `https://miscsubjects.com/api/dispatch?explain=1&key=${encodeURIComponent(k)}`,
        note: 'Exercising a declared capability requires a token minted for it by the pool owner (scoped rows: grant); the universal set above needs none.',
      })),
      pool_rule: 'A work object may belong to a team pool. Every token minted into the pool inherits the pool’s declared capabilities against every object in it — the object is the shared surface; agents on any vendor, any device, coordinate through it, and every exercise lands a receipt on this ledger.',
    };
  }
  projection.public_representations = {
    article: `https://miscsubjects.com/a/${slug}`,
    object: `https://miscsubjects.com/api/articles/${slug}`,
    health: `https://miscsubjects.com/api/articles/${slug}/health`,
    revisions: `https://miscsubjects.com/api/articles/${slug}/revisions`,
    ledger: `https://miscsubjects.com/api/articles/${slug}/ledger`,
    manifest: `https://miscsubjects.com/api/articles/${slug}/bundle?format=manifest`,
    proof_projection: new URL(request.url).origin + `/api/proven-work/${slug}`,
  };
  projection.delegation = {
    protocol: 'OIP 1.2.0',
    existing_capability: 'WEB_FETCH',
    scope: 'row:WEB_FETCH',
    fixed_body: `GET|https://miscsubjects.com/api/proven-work/${slug}||`,
    unlimited_uses: true,
    purpose: `prove-or-disprove:article:${slug}`,
    explanation: 'The delegated token can open this proof projection and nothing outside its fixed WEB_FETCH body. Each inspection is receipted under the token fingerprint.',
  };
  return json(projection);
}

export async function onRequestPost({ request, env, params }) {
  const parts = pathParts(params);
  const slug = String(parts[0] || '').toLowerCase();

  // CERTIFY — any model or person that has actually read the record may sign a verdict onto
  // the ledger (owner order 2026-08-03). The signature costs proof of reading: a real
  // inspection receipt (the inv_ id returned by a tokenized read of this object's projection).
  // No receipt, no signature. The certification itself lands on the article and the ledger.
  if (slug && parts[1] === 'certify' && parts.length === 2) {
    let b = {};
    try { b = await request.json(); } catch { return json({ error: 'body_must_be_json' }, 400); }
    const verdict = String(b.verdict || '').toUpperCase();
    // Two grammars, one ledger (owner order 2026-08-03): the record grammar for claim-level
    // verdicts, and the plain disposition grammar for whole-object judgments and questions.
    const ALLOWED = ['SUPPORTED_BY_RECORD', 'MISSING_EVIDENCE', 'CONTRADICTED_BY_RECORD',
      'PROVED', 'DISPROVED', 'CONTESTED', 'QUESTION', 'OBJECTION', 'INCONCLUSIVE'];
    if (!ALLOWED.includes(verdict)) return json({ error: 'verdict_must_be_one_of', allowed: ALLOWED }, 422);
    const model = String(b.model || '').slice(0, 120).trim();
    const grounds = String(b.grounds || '').slice(0, 800).trim();
    const inspectionReceipt = String(b.inspection_receipt || '').trim();
    if (!model || !grounds) return json({ error: 'model_and_grounds_required' }, 422);
    if (!/^inv_[a-z0-9]+$/i.test(inspectionReceipt)) {
      return json({ error: 'inspection_receipt_required', note: 'Certification costs proof of reading: fetch the inspect URL first; the returned invocation id is your inspection_receipt.' }, 422);
    }
    const inv = await getInvocation(env, inspectionReceipt);
    if (!inv) return json({ error: 'inspection_receipt_not_found', receipt: inspectionReceipt }, 422);
    // READ vs VERIFIED, brutally (owner order 2026-08-03): opening the object is cheap and
    // automatic — the inspection receipt proves READ. A STRONG verdict must prove
    // verification work: either grounds that cite the specific record ids, hashes, or URLs
    // the certifier actually checked, or verification_receipts naming the tool calls it ran.
    // "10,000 models looked at this" is a vanity metric; "3 ran the tools and found gaps"
    // is the asset. QUESTION / OBJECTION / INCONCLUSIVE stay cheap by design.
    const STRONG = ['SUPPORTED_BY_RECORD', 'CONTRADICTED_BY_RECORD', 'PROVED', 'DISPROVED', 'CONTESTED', 'MISSING_EVIDENCE'];
    const verificationReceipts = (Array.isArray(b.verification_receipts) ? b.verification_receipts : [])
      .map((x) => String(x || '').trim()).filter((x) => /^inv_[a-z0-9]+$/i.test(x)).slice(0, 20);
    if (STRONG.includes(verdict)) {
      const citesRecord = /inv_[a-z0-9]{4,}|[a-f0-9]{16,64}|https?:\/\/\S+/i.test(grounds);
      if (!verificationReceipts.length && !citesRecord) {
        return json({
          error: 'verification_required',
          note: 'A strong verdict costs verification, not reading. Cite in grounds the exact record ids, hashes, or URLs you checked — or attach verification_receipts: the inv_ ids of the tool calls you ran against the record. To ask or object without verifying, use QUESTION or OBJECTION.',
        }, 422);
      }
    }
    const loaded = await loadArticle(env, slug);
    if (loaded.error) return json(loaded, 404);
    const cert = {
      verdict, model, grounds,
      claim_tested: String(b.claim_tested || '').slice(0, 400) || null,
      inspection_receipt: inspectionReceipt,
      verification_receipts: verificationReceipts,
      // The verdict is bound to the exact article version being judged: the hash recorded
      // here is the page's body hash at signing time. Readers comparing it to the current
      // article_hash can see whether the page changed after this verdict.
      article_hash: loaded.articleHash || null,
      ts: new Date().toISOString(),
    };
    // Append to the article's manifest (capped) and to the ledger, atomically enough for an
    // append-only list: read-modify-write on meta.extra.proven_work.certifications.
    const row = await env.DB.prepare('SELECT meta FROM articles WHERE slug=?').bind(slug).first();
    let meta = {}; try { meta = JSON.parse(row.meta || '{}'); } catch {}
    // Hand-bound manifests keep their certifications inline. Pages running on a synthesized
    // manifest store them in a sibling key so the synthesized requirements never get frozen
    // into a half-empty stored manifest.
    let totalCerts = 0;
    if (meta.extra?.proven_work && typeof meta.extra.proven_work === 'object') {
      const pw = meta.extra.proven_work;
      pw.certifications = (Array.isArray(pw.certifications) ? pw.certifications : []).slice(-199);
      pw.certifications.push(cert);
      totalCerts = pw.certifications.length;
      meta.extra = { ...(meta.extra || {}), proven_work: pw };
    } else {
      const certsArr = (Array.isArray(meta.extra?.proven_work_certs) ? meta.extra.proven_work_certs : []).slice(-199);
      certsArr.push(cert);
      totalCerts = certsArr.length;
      meta.extra = { ...(meta.extra || {}), proven_work_certs: certsArr };
    }
    await env.DB.prepare('UPDATE articles SET meta=? WHERE slug=?').bind(JSON.stringify(meta), slug).run();
    try {
      await env.LEDGER.prepare(
        'INSERT INTO events (id, ts, source, key, action, direction, status, request_json, response_json, trace_id) VALUES (?,?,?,?,?,?,?,?,?,?)'
      ).bind(
        crypto.randomUUID(), new Date().toISOString(), 'proven-work', 'PW_CERTIFY', 'certify', 'in', 200,
        scrubOwnerIdentity(JSON.stringify({ slug, ...cert })), JSON.stringify({ recorded: true, total_certifications: totalCerts }),
        String(inv.trace_id || ''),
      ).run();
    } catch { /* the article append is the durable record; the ledger row is best-effort */ }
    return json({ ok: true, recorded: cert, total_certifications: totalCerts,
      note: 'The certification is appended to the work object and visible in its projection. It signs your reading, not the operator’s status.' });
  }

  if (!slug || parts[1] !== 'drop' || parts.length !== 2) {
    return json({ error: 'use_POST_/api/proven-work/<article-slug>/drop_or_/certify' }, 404);
  }
  // AUTOMATIC DOOR (owner order 2026-08-03): anyone reading a proven work object may mint its
  // scoped inspection token without asking. The token is safe by construction — fixed to one
  // GET of one public projection, expiring, receipted per use — so the mint itself needs no
  // gate. The server signs the mint with its own key; the caller never sees that key.
  const loaded = await loadArticle(env, slug);
  if (loaded.error) return json(loaded, 404);

  const origin = new URL(request.url).origin;
  const proofUrl = `${origin}/api/proven-work/${slug}`;
  const mintUrl = new URL('/api/dispatch', origin);
  mintUrl.searchParams.set('mint_share', '1');
  mintUrl.searchParams.set('scope', 'row');
  mintUrl.searchParams.set('key', 'WEB_FETCH');
  mintUrl.searchParams.set('ttl', String(60 * 60 * 24 * 7));
  mintUrl.searchParams.set('uses', '0');
  mintUrl.searchParams.set('body_fixed', `GET|${proofUrl}||`);
  mintUrl.searchParams.set('purpose', `prove-or-disprove:article:${slug}`);
  mintUrl.searchParams.set('actor', `article:${slug}`);

  const headers = new Headers();
  // The server signs the mint itself: the public caller supplies nothing and receives a token
  // that can only read this object's projection. Caller-supplied keys are accepted but not required.
  const terminalKey = request.headers.get('x-terminal-key') || env.TERMINAL_KEY || '';
  const cookie = request.headers.get('cookie');
  if (terminalKey) headers.set('x-terminal-key', terminalKey);
  if (cookie) headers.set('cookie', cookie);
  const mintedResponse = await fetch(mintUrl, { headers });
  let minted = {};
  try { minted = await mintedResponse.json(); } catch {}
  if (!mintedResponse.ok || !minted?.ok || !minted?.share_token) {
    return json({
      error: 'proof_token_mint_failed',
      status: mintedResponse.status,
      cause: minted?.error || 'invalid_mint_response',
      note: minted?.note || 'The existing delegated-token route did not return a token; inspect the mint response before retrying.',
    }, 502);
  }

  const workId = loaded.manifest.work_id || null;
  const status = evaluateManifestStatus(loaded.manifest.requirements);
  return json({
    schema: 'oip/proven-work-drop/1',
    work_id: workId,
    article: `https://miscsubjects.com/a/${slug}`,
    projection: proofUrl,
    fingerprint: minted.fingerprint,
    scope: minted.scope,
    max_uses: minted.max_uses,
    expires_at: minted.expires_at,
    block: formatProvenWorkDrop({ slug, workId, status, minted }),
  });
}

function evaluateManifestStatus(requirements) {
  const rows = Array.isArray(requirements) ? requirements : [];
  return rows.length && rows.every((row) => String(row?.status || '').toUpperCase() === 'PASS') ? 'PROVEN' : 'PARTIAL';
}
