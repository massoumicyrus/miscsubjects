// GET /verify/article/<slug> — the verification address for one ARTICLE, in the same namespace as
// the send receipts. Every article's proof strip links here; every send receipt lives one level up.
//
// One verification namespace, two object kinds (owner law 2026-08-11): a recipient's agent that
// learned to verify a SEND at /verify/snd_… must find an ARTICLE verifiable at the same door. The
// article proof machinery already exists — the proven-work object, the inspect/certify doors, the
// comment ledger — so this route is a pointer, not a copy: the human is sent to the page whose
// proof strip carries the machinery; ?format=json (or an Accept: application/json caller) gets the
// machine map of every verification surface the article has.

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
  });
}

const BASE = 'https://miscsubjects.com';

export async function onRequestGet({ env, params, request }) {
  const slug = String(params.slug || '').toLowerCase();
  const row = await env.DB.prepare('SELECT slug, title FROM articles WHERE slug=?').bind(slug).first();
  if (!row) return json({ ok: false, error: 'no_such_article', slug, articles: BASE + '/api/articles' }, 404);
  const wantsJson = new URL(request.url).searchParams.get('format') === 'json'
    || /application\/json/.test(request.headers.get('accept') || '');
  if (!wantsJson) {
    return Response.redirect(BASE + '/a/' + encodeURIComponent(slug), 302);
  }
  return json({
    _self: { schema: 'miscsubjects/article-verification-map/1', what: 'Every surface on which this article can be verified, and the doors to sign what you find.' },
    article: { slug: row.slug, title: row.title, rendered: BASE + '/a/' + row.slug },
    proof_object: {
      manifest: BASE + '/api/proven-work/' + row.slug,
      inspect_mints_your_delegation: BASE + '/api/proven-work/' + row.slug + '/inspect',
      certify_a_verdict: BASE + '/api/proven-work/' + row.slug + '/certify',
    },
    formation_record: {
      revisions: BASE + '/api/articles/' + row.slug + '/provenance',
      per_div_chains: BASE + '/api/articles/' + row.slug + '/voxels',
      live_ledger: BASE + '/api/articles/' + row.slug + '/ledger',
    },
    criticism: {
      thread: BASE + '/a/' + row.slug + '#ledger',
      write: BASE + '/api/comments/' + row.slug,
      token: BASE + '/api/comments/token',
    },
    send_ledger: { what: 'Emails that promoted this build are receipted separately', url: BASE + '/api/verify' },
  });
}
