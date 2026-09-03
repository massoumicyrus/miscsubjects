// Self-contained unit test for the article API.
// Exercises the REAL handlers against an in-memory D1 stub — no network, no
// TERMINAL_KEY secret, no deployed server. Covers:
//   • catch-all handler  ./[[path]].js  (onRequest)
//       list, get, create (POST), replace (PUT), partial update (PATCH), delete,
//       auth (401), not-found (404), bad-input (400), method-not-allowed (405),
//       ?format=post shape, ?rev=N revision retrieval, immutable-slug DELETE (403),
//       inline webhook append, and the read-only verify chains
//       (provenance, sources, contributions, revisions).
//   • dedicated route    ./[slug]/webhook.js  (onRequestPost)
//       atomic append, auth (401), not-found (404), bad-kind (400).
// Run:  node --test functions/api/articles/articles.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const { onRequest } = await import(new URL('./[[path]].js', import.meta.url));
const { onRequestPost: webhookPost } = await import(new URL('./[slug]/webhook.js', import.meta.url));

const KEY = 'test-terminal-key';
const BASE = 'https://example.test';

// ── Minimal D1-compatible stub. Backs the exact queries every handler issues. ──
function makeDB() {
  const rows = new Map(); // slug -> {slug,title,subject,published,body,meta,created_at,updated_at}
  function exec(sql, params) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (s.startsWith('SELECT COUNT(*) AS c FROM articles')) {
      return { first: () => ({ c: [...rows.values()].filter((r) => Number(r.published) === 1).length }) };
    }
    if (s.startsWith('SELECT * FROM directory')) {
      return { all: () => ({ results: [] }) };
    }
    // listArticles: SELECT ... ORDER BY updated_at DESC
    if (s.startsWith('SELECT') && s.includes('ORDER BY updated_at DESC')) {
      const results = [...rows.values()]
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      return { all: () => ({ results }) };
    }
    // deleteArticle precheck: SELECT slug FROM articles WHERE slug=?
    if (s.startsWith('SELECT slug FROM articles WHERE slug=?')) {
      const r = rows.get(params[0]);
      return { first: () => (r ? { slug: r.slug } : null) };
    }
    // webhook.js read: SELECT slug, meta FROM articles WHERE slug=?
    if (s.startsWith('SELECT slug, meta FROM articles WHERE slug=?')) {
      const r = rows.get(params[0]);
      return { first: () => (r ? { slug: r.slug, meta: r.meta } : null) };
    }
    // getRow: SELECT slug, title, body, meta, ... WHERE slug=?
    if (s.startsWith('SELECT') && s.includes('body') && s.includes('WHERE slug=?')) {
      const r = rows.get(params[0]) || null;
      return { first: () => (r ? { ...r } : null) };
    }
    // upsertArticle: INSERT ... ON CONFLICT(slug) DO UPDATE
    if (s.startsWith('INSERT INTO articles')) {
      const [slug, title, subject, published, body, meta, created_at, updated_at] = params;
      const prev = rows.get(slug);
      if (prev) rows.set(slug, { ...prev, title, body, meta, updated_at });
      else rows.set(slug, { slug, title, subject, published, body, meta, created_at, updated_at });
      return { run: () => ({ success: true }) };
    }
    // patchArticle: UPDATE articles SET title=?, body=?, meta=?, updated_at=? WHERE slug=?
    if (s.startsWith('UPDATE articles SET title=?')) {
      const [title, body, meta, updated_at, slug] = params;
      const prev = rows.get(slug);
      if (prev) rows.set(slug, { ...prev, title, body, meta, updated_at });
      return { run: () => ({ success: true }) };
    }
    // webhook append: UPDATE articles SET meta=?, updated_at=? WHERE slug=?
    if (s.startsWith('UPDATE articles SET meta=?')) {
      const [meta, updated_at, slug] = params;
      const prev = rows.get(slug);
      if (prev) rows.set(slug, { ...prev, meta, updated_at });
      return { run: () => ({ success: true }) };
    }
    // deleteArticle: DELETE FROM articles WHERE slug=?
    if (s.startsWith('DELETE FROM articles WHERE slug=?')) {
      rows.delete(params[0]);
      return { run: () => ({ success: true }) };
    }
    throw new Error('unhandled SQL in stub: ' + s);
  }
  return {
    prepare(sql) {
      return {
        bind: (...params) => ({
          first: () => Promise.resolve(exec(sql, params).first()),
          all: () => Promise.resolve(exec(sql, params).all()),
          run: () => Promise.resolve(exec(sql, params).run()),
        }),
        first: () => Promise.resolve(exec(sql, []).first()),   // no-bind callers (listArticles)
        all: () => Promise.resolve(exec(sql, []).all()),
        run: () => Promise.resolve(exec(sql, []).run()),
      };
    },
    _rows: rows,
  };
}

// Fresh env per test group so state is isolated and order-independent within a flow.
function makeEnv() { return { DB: makeDB(), TERMINAL_KEY: KEY }; }

function call(env, method, path, { body, key = KEY } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (key) headers['x-terminal-key'] = key;
  const init = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return onRequest({ request: new Request(BASE + path, init), env });
}
async function jsonOf(res) {
  return { status: res.status, body: await res.json() };
}

const SLUG = 'unit-creatine-cognition';
const CREATE_BODY = {
  slug: SLUG,
  title: 'Creatine Monohydrate and Cognition',
  body: '## What it is\nCreatine monohydrate is a well-studied ergogenic supplement.\n\n## Evidence\nMixed for cognition.',
  hero: 'https://placehold.co/1200x675',
  hero_brief: 'A measured scoop of creatine beside a brain-energy diagram made from tangible laboratory objects; one coherent editorial composition, no readable text, no UI collage',
  editorial_review: {
    headline_subject: 'creatine and cognition',
    hero_subject: 'the supplement and the brain-energy question',
    visual_action: 'the measured supplement sits beside the physical energy system it may affect',
    rationale: 'The scene begins with the actual supplement and makes the cognition question visible without generic AI art or rendered data.',
    inspected: true,
    inspection_note: 'The render shows one scoop, one physical brain-energy mechanism, no readable text, and no dashboard or table.',
  },
  images: [{ url: 'https://placehold.co/600x400', caption: 'Dosing' }],
  style: { theme: 'dark', accent: '#44aaff' },
  tags: ['supplements', 'cognition'],
};

// Seed a fresh env with the canonical article and return it.
async function seeded(extra) {
  const env = makeEnv();
  await call(env, 'POST', '/api/articles', { body: { ...CREATE_BODY, ...(extra || {}) } });
  return env;
}

// ───────────────────────────── CREATE ─────────────────────────────
test('CREATE — POST /api/articles persists fields and returns 200', async () => {
  const env = makeEnv();
  const { status, body } = await jsonOf(await call(env, 'POST', '/api/articles', { body: CREATE_BODY }));
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.slug, SLUG);
  assert.equal(body.title, CREATE_BODY.title);
  assert.equal(body.hero, CREATE_BODY.hero);
  assert.equal(body.style.theme, 'dark');
  assert.deepEqual(body.tags, ['supplements', 'cognition']);
  assert.equal(body.status, 'published');
});

test('CREATE — slug is slugified from a messy input', async () => {
  const env = makeEnv();
  const { body } = await jsonOf(await call(env, 'POST', '/api/articles', {
    body: { slug: '  Messy Slug! ', title: 'A plain guide to article slugs', body: 'x' },
  }));
  assert.equal(body.slug, 'messy-slug');
});

test('CREATE — missing slug/title -> 400', async () => {
  const env = makeEnv();
  const { status } = await jsonOf(await call(env, 'POST', '/api/articles', { body: { slug: '', title: '' } }));
  assert.equal(status, 400);
});

test('CREATE — no auth -> 401', async () => {
  const env = makeEnv();
  const { status } = await jsonOf(await call(env, 'POST', '/api/articles', { body: CREATE_BODY, key: '' }));
  assert.equal(status, 401);
});

test('CREATE — wrong key -> 401', async () => {
  const env = makeEnv();
  const { status } = await jsonOf(await call(env, 'POST', '/api/articles', { body: CREATE_BODY, key: 'nope' }));
  assert.equal(status, 401);
});

// ───────────────────────────── GET ─────────────────────────────
test('GET — single article returns full shape', async () => {
  const env = await seeded();
  const { status, body } = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG));
  assert.equal(status, 200);
  assert.match(body.body, /Creatine monohydrate/);
  assert.ok(Array.isArray(body.images));
  assert.equal(body.images.length, 1);
  assert.equal(body.status, 'published');
});

test('GET — read paths require no auth', async () => {
  const env = await seeded();
  const { status } = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG, { key: '' }));
  assert.equal(status, 200);
});

test('GET — missing slug -> 404', async () => {
  const env = makeEnv();
  const { status } = await jsonOf(await call(env, 'GET', '/api/articles/does-not-exist-zzz'));
  assert.equal(status, 404);
});

test('GET — ?format=post returns the re-postable shape', async () => {
  const env = await seeded();
  const { status, body } = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG + '?format=post'));
  assert.equal(status, 200);
  assert.equal(body.slug, SLUG);
  assert.ok('prov' in body);
  assert.ok(Array.isArray(body.claims));
  assert.ok(Array.isArray(body.sources));
});

// ───────────────────────────── LIST ─────────────────────────────
test('LIST — GET /api/articles contains the created article with row shape', async () => {
  const env = await seeded();
  const { status, body } = await jsonOf(await call(env, 'GET', '/api/articles'));
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.articles));
  const mine = body.articles.filter(a => a.slug === SLUG);
  assert.equal(mine.length, 1);
  for (const k of ['slug', 'title', 'updated_at']) assert.ok(k in mine[0]);
});

test('LIST — empty DB returns []', async () => {
  const env = makeEnv();
  const { status, body } = await jsonOf(await call(env, 'GET', '/api/articles'));
  assert.equal(status, 200);
  assert.deepEqual(body.articles, []);
});

// ───────────────────────────── UPDATE ─────────────────────────────
test('UPDATE — PATCH partial merges meta, preserves body, snapshots a revision', async () => {
  const env = await seeded();
  const deletedSnapshots = [];
  env.KV = { delete: async (key) => { deletedSnapshots.push(key); } };
  const { status, body } = await jsonOf(await call(env, 'PATCH', '/api/articles/' + SLUG, {
    body: { title: 'Creatine and cognition: revised evidence', status: 'published' },
  }));
  assert.equal(status, 200);
  assert.equal(body.title, 'Creatine and cognition: revised evidence');
  assert.match(body.body, /Creatine monohydrate/);          // body untouched by PATCH
  assert.deepEqual(body.tags, ['supplements', 'cognition']); // meta merged, not wiped
  assert.ok(body.revisions >= 1);
  assert.deepEqual(deletedSnapshots, [
    'lastgood:/a/' + SLUG,
    'lastgood:/api/articles/' + SLUG,
  ]);
});

test('UPDATE — PATCH on missing slug -> 404', async () => {
  const env = makeEnv();
  const { status } = await jsonOf(await call(env, 'PATCH', '/api/articles/ghost', { body: { title: 'x' } }));
  assert.equal(status, 404);
});

test('UPDATE — PATCH no auth -> 401', async () => {
  const env = await seeded();
  const { status } = await jsonOf(await call(env, 'PATCH', '/api/articles/' + SLUG, { body: { title: 'x' }, key: '' }));
  assert.equal(status, 401);
});

test('UPDATE — PUT full replace overwrites body/tags and appends a revision', async () => {
  const env = await seeded();
  await call(env, 'PATCH', '/api/articles/' + SLUG, { body: { title: 'Creatine evidence: first revision' } }); // -> revision 0
  const { status, body } = await jsonOf(await call(env, 'PUT', '/api/articles/' + SLUG, {
    body: { title: 'Creatine evidence after full review', body: '## Replaced\nFull replacement.', tags: ['rewritten'] },
  }));
  assert.equal(status, 200);
  assert.equal(body.title, 'Creatine evidence after full review');
  assert.match(body.body, /Full replacement/);
  assert.deepEqual(body.tags, ['rewritten']);
  assert.ok(body.revisions >= 2);
});

test('UPDATE — PUT no auth -> 401', async () => {
  const env = await seeded();
  const { status } = await jsonOf(await call(env, 'PUT', '/api/articles/' + SLUG, { body: { title: 'x', body: 'y' }, key: '' }));
  assert.equal(status, 401);
});

test('UPDATE — PUT missing title -> 400', async () => {
  const env = await seeded();
  const { status } = await jsonOf(await call(env, 'PUT', '/api/articles/' + SLUG, { body: { title: '', body: 'y' } }));
  assert.equal(status, 400);
});

// ─────────────────────── REVISIONS (append-only history) ───────────────────────
test('REVISIONS — ?rev=0 returns the preserved prior snapshot verbatim', async () => {
  const env = await seeded();
  await call(env, 'PATCH', '/api/articles/' + SLUG, { body: { title: 'Creatine evidence: second title' } });
  const { status, body } = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG + '?rev=0'));
  assert.equal(status, 200);
  assert.equal(body.rev, 0);
  assert.equal(body.is_head, false);
  assert.equal(body.title, CREATE_BODY.title); // the original, not "second title"
  assert.equal(body.hero, CREATE_BODY.hero);
  assert.equal(body.hero_brief, CREATE_BODY.hero_brief);
  assert.equal(body.editorial_review.inspected, true);
  assert.deepEqual(body.tags, CREATE_BODY.tags);
  assert.deepEqual(body.style, CREATE_BODY.style);
});

test('REVISIONS — out-of-range rev -> 404', async () => {
  const env = await seeded();
  const { status } = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG + '?rev=99'));
  assert.equal(status, 404);
});

test('REVISIONS — GET /<slug>/revisions lists snapshots', async () => {
  const env = await seeded();
  await call(env, 'PATCH', '/api/articles/' + SLUG, { body: { title: 'Creatine evidence: revision one' } });
  const { status, body } = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG + '/revisions'));
  assert.equal(status, 200);
  assert.equal(body.head_index, 1);
  assert.equal(body.revisions.length, 1);
  assert.equal(body.revisions[0].n, 0);
});

// ─────────────────────── PROVENANCE chain (hash-verified) ───────────────────────
test('PROVENANCE — empty ledger verifies valid:true at genesis', async () => {
  const env = await seeded();
  const { status, body } = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG + '/provenance'));
  assert.equal(status, 200);
  assert.equal(body.verification.valid, true);
  assert.equal(body.energy.passes, 0);
});

test('PROVENANCE — a prov write produces a verifiable chain', async () => {
  const env = await seeded({
    prov: { model: 'grok-4.3', action: 'write', prompt: 'p', input: 'i', response: 'r', tokens_in: 10, tokens_out: 20, cost: 0.001 },
  });
  const { status, body } = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG + '/provenance'));
  assert.equal(status, 200);
  assert.equal(body.verification.valid, true);
  assert.equal(body.verification.entries, 1);
  assert.equal(body.energy.passes, 1);
  assert.equal(body.energy.tokens_total, 30);
});

test('SOURCES — empty source ledger verifies valid:true', async () => {
  const env = await seeded();
  const { status, body } = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG + '/sources'));
  assert.equal(status, 200);
  assert.equal(body.verification.valid, true);
  assert.equal(body.count, 0);
});

test('CONTRIBUTIONS — empty ledger verifies valid:true', async () => {
  const env = await seeded();
  const { status, body } = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG + '/contributions'));
  assert.equal(status, 200);
  assert.equal(body.verification.valid, true);
  assert.equal(body.count, 0);
});

// ─────────────────────── WEBHOOK (inline, via [[path]].js) ───────────────────────
test('WEBHOOK(inline) — POST /<slug>/webhook appends a claim and GET reflects it', async () => {
  const env = await seeded();
  const { status, body } = await jsonOf(await call(env, 'POST', '/api/articles/' + SLUG + '/webhook', {
    body: { kind: 'claim', data: { id: 'c1', text: 'Creatine is well studied.' } },
  }));
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.kind, 'claim');
  assert.equal(body.index, 0);
  const got = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG));
  assert.equal(got.body.claims.length, 1);
  assert.equal(got.body.claims[0].text, 'Creatine is well studied.');
});

test('WEBHOOK(inline) — bad kind -> 400', async () => {
  const env = await seeded();
  const { status } = await jsonOf(await call(env, 'POST', '/api/articles/' + SLUG + '/webhook', {
    body: { kind: 'banana', data: { x: 1 } },
  }));
  assert.equal(status, 400);
});

test('WEBHOOK(inline) — no auth -> 401', async () => {
  const env = await seeded();
  const { status } = await jsonOf(await call(env, 'POST', '/api/articles/' + SLUG + '/webhook', {
    body: { kind: 'claim', data: { id: 'c1' } }, key: '',
  }));
  assert.equal(status, 401);
});

// ─────────────────────── WEBHOOK (dedicated route, [slug]/webhook.js) ───────────────────────
function webhookCall(env, slug, { body, key = KEY } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (key) headers['x-terminal-key'] = key;
  const init = { method: 'POST', headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return webhookPost({
    request: new Request(BASE + '/api/articles/' + slug + '/webhook', init),
    env,
    params: { slug },
  });
}

test('WEBHOOK(route) — onRequestPost appends a source', async () => {
  const env = await seeded();
  const { status, body } = await jsonOf(await webhookCall(env, SLUG, {
    body: { kind: 'source', data: { id: 's1', url: 'https://example.org', title: 'Ref' } },
  }));
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.immutable_append, true);
  const got = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG));
  assert.equal(got.body.sources.length, 1);
});

test('WEBHOOK(route) — no auth -> 401', async () => {
  const env = await seeded();
  const { status } = await jsonOf(await webhookCall(env, SLUG, {
    body: { kind: 'source', data: { id: 's1' } }, key: '',
  }));
  assert.equal(status, 401);
});

test('WEBHOOK(route) — missing article -> 404', async () => {
  const env = makeEnv();
  const { status } = await jsonOf(await webhookCall(env, 'ghost', {
    body: { kind: 'source', data: { id: 's1' } },
  }));
  assert.equal(status, 404);
});

test('WEBHOOK(route) — missing kind/data -> 400', async () => {
  const env = await seeded();
  const { status } = await jsonOf(await webhookCall(env, SLUG, { body: { kind: 'source' } }));
  assert.equal(status, 400);
});

// ───────────────────────────── DELETE ─────────────────────────────
test('DELETE — no auth -> 401', async () => {
  const env = await seeded();
  const { status } = await jsonOf(await call(env, 'DELETE', '/api/articles/' + SLUG, { key: '' }));
  assert.equal(status, 401);
});

test('DELETE — removes the article and returns the slug', async () => {
  const env = await seeded();
  const { status, body } = await jsonOf(await call(env, 'DELETE', '/api/articles/' + SLUG));
  assert.equal(status, 200);
  assert.equal(body.deleted, SLUG);
});

test('DELETE — GET after delete -> 404, second DELETE -> 404', async () => {
  const env = await seeded();
  await call(env, 'DELETE', '/api/articles/' + SLUG);
  const gone = await jsonOf(await call(env, 'GET', '/api/articles/' + SLUG));
  assert.equal(gone.status, 404);
  const again = await jsonOf(await call(env, 'DELETE', '/api/articles/' + SLUG));
  assert.equal(again.status, 404);
});

test('DELETE — immutable_slug article is protected -> 403', async () => {
  const env = await seeded({ immutable_slug: true });
  const { status, body } = await jsonOf(await call(env, 'DELETE', '/api/articles/' + SLUG));
  assert.equal(status, 403);
  assert.match(body.error, /immutable/);
});

// ───────────────────────────── ROUTING ─────────────────────────────
test('ROUTING — unsupported method on collection -> 405', async () => {
  const env = makeEnv();
  const { status } = await jsonOf(await call(env, 'DELETE', '/api/articles'));
  assert.equal(status, 405);
});

test('ROUTING — handler never throws on malformed JSON body (caught -> 400)', async () => {
  const env = makeEnv();
  const res = await onRequest({
    request: new Request(BASE + '/api/articles', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-terminal-key': KEY },
      body: '{not json',
    }),
    env,
  });
  // .catch(() => ({})) inside the handler => empty body => slug/title required => 400
  assert.equal(res.status, 400);
});

// ─────────────────────── EDITORIAL TITLE/HERO GATE ───────────────────────
test('EDITORIAL PREFLIGHT — rejects an overloaded headline and a rendered dashboard before generation', async () => {
  const env = makeEnv();
  const { status, body } = await jsonOf(await call(env, 'POST', '/api/articles/editorial-preflight', {
    body: {
      stage: 'proposal',
      title: 'AI-native content, defined and measured: a seven-axis rubric scoring llms.txt, MCP, nanopublications, Wikipedia and this site',
      hero_brief: 'A dark dashboard table with rows, columns, labels and model scores',
      editorial_review: {
        headline_subject: 'AI-native content', hero_subject: 'a model-readable publishing structure',
        visual_action: 'a dashboard presents the scores', rationale: 'A dashboard shows scores.',
      },
    },
  }));
  assert.equal(status, 422, JSON.stringify(body));
  assert.equal(body.ok, false);
  assert.ok(body.issues.some((item) => item.code === 'headline_preflight'));
  assert.ok(body.issues.some((item) => item.code === 'hero_preflight'));
});

test('EDITORIAL WRITE GATE — refuses a changed hero until the actual render was inspected', async () => {
  const env = await seeded();
  const { status, body } = await jsonOf(await call(env, 'PATCH', '/api/articles/' + SLUG, {
    body: {
      hero: 'https://placehold.co/1200x675/new',
      hero_brief: 'A clinical bottle of creatine beside a tangible model of brain-energy metabolism; one coherent editorial scene, no readable text, no UI collage',
      editorial_review: {
        headline_subject: 'creatine and cognition', hero_subject: 'the supplement and brain-energy metabolism',
        visual_action: 'the measured dose connects to the physical energy pathway',
        rationale: 'The actual supplement remains the anchor and the visual action expresses the cognition question.',
      },
    },
  }));
  assert.equal(status, 422, JSON.stringify(body));
  assert.equal(body.error, 'editorial_preflight_refused');
  assert.ok(body.issues.some((item) => item.code === 'hero_not_inspected'));
});

test('EDITORIAL AUDIT — continuously flags an existing cold-context title and unreviewed hero', async () => {
  const env = makeEnv();
  env.DB._rows.set('legacy', {
    slug: 'legacy', title: 'What this means', subject: 'What this means', published: 1,
    body: '## Overview\n\nA legacy article.', meta: JSON.stringify({ hero: 'https://placehold.co/legacy' }),
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  });
  const { status, body } = await jsonOf(await call(env, 'GET', '/api/articles/editorial-audit'));
  assert.equal(status, 200);
  assert.equal(body.failed, 1);
  assert.ok(body.articles[0].issues.some((item) => item.code === 'headline_context'));
  assert.ok(body.articles[0].issues.some((item) => item.code === 'heading_filing_label'));
  assert.ok(body.articles[0].issues.some((item) => item.code === 'hero_review_missing'));
  assert.ok(body.articles[0].issues.every((item) => item.message && (item.replacement || item.review)));
});
