// GET  /api/writing-law/lease            -> the law, its hash, and what must be attested
// POST /api/writing-law/lease            -> attest against it and receive a single-use write token
//
// The article write path refuses a body write without a token from here. See
// functions/_lib/writing_law_lease.js for why this exists.

import { WRITING_LAW_OBJECT } from '../../_lib/writing_law_object.js';
import {
  ATTESTED_CLAUSES,
  checkAttestations,
  currentLawHash,
  mintToken,
} from '../../_lib/writing_law_lease.js';

const json = (o, s = 200) => new Response(JSON.stringify(o, null, 2), {
  status: s,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

export async function onRequestGet() {
  const clauses = WRITING_LAW_OBJECT?.content?.clauses || [];
  const hash = await currentLawHash(WRITING_LAW_OBJECT);
  const attested = new Set(ATTESTED_CLAUSES.map(([id]) => id));
  return json({
    what: 'Read this law. Hash it. Attest against it with the sentences you are about to publish. '
      + 'Then, and only then, write the article.',
    law_hash: hash,
    clause_count: clauses.length,
    clauses: clauses.map((c) => ({ id: c.id, family: c.family, title: c.title, law: c.law, attested: attested.has(c.id) })),
    attest: ATTESTED_CLAUSES.map(([id, ask]) => ({ clause: id, asks: ask })),
    how_to_lease: {
      method: 'POST /api/writing-law/lease',
      body: {
        law_hash: hash,
        slug: '<the article slug>',
        body: '<the exact markdown body you are about to PUT>',
        agent: '<who you are>',
        attestations: { W21: { how: '<how THIS article satisfies it>', quote: '<a span from the body>' }, '…': {} },
      },
      note: 'Every quote is checked against the body you send. A quote that is not in the body is refused, '
        + 'so the lease cannot be taken before the work is done. The token is scoped to that slug and that '
        + 'exact body, is good for one write, and expires in fifteen minutes.',
    },
    then: 'PUT /api/articles/<slug> with header x-writing-law-token: <token>',
  });
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'json body required' }, 400); }

  const expected = await currentLawHash(WRITING_LAW_OBJECT);
  const result = checkAttestations({
    law_hash: b.law_hash,
    expected_hash: expected,
    slug: b.slug,
    body: b.body,
    attestations: b.attestations,
  });

  if (!result.ok) {
    return json({
      ok: false,
      error: 'writing_law_attestation_refused',
      law_hash: expected,
      issues: result.issues,
      how_to_fix: 'Fix every issue and post again. If the refusal is that a quote is not in the body, '
        + 'the article does not yet satisfy that clause — change the article, not the attestation.',
    }, 422);
  }

  const minted = await mintToken(env, { slug: b.slug, body: b.body, agent: b.agent });
  return json({
    ok: true,
    slug: b.slug,
    law_hash: expected,
    clauses_attested: ATTESTED_CLAUSES.length,
    ...minted,
    then: `PUT /api/articles/${b.slug} with header x-writing-law-token: ${minted.token}`,
  });
}
