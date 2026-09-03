// THE CONTRIBUTION LEDGER — an agent's record as a projection, never a score (spec: trust vector).
//
//   GET /api/contributions?actor=<name>   one actor's evidence-derived record
//   GET /api/contributions                actors seen in the records, with counts
//
// A useful profile is not an avatar and a karma number. It is a projection over what an actor's
// signed executions actually show: cases contributed, reproductions completed and their results,
// comparisons recorded, independent replications of OTHER actors' comparisons, counterexamples
// found, skill versions proposed. Nothing here is stored — every number is recomputed from
// work_actions, work_evidence, comparisons and skill_versions at read time, with the arithmetic
// visible (the rank_why convention). ANTI-SELF-DEALING is structural: a "reproduction" of your own
// work and a "replication" of your own comparison are counted separately and labeled — they are
// not independent evidence and are never merged into the independent columns.

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const actor = String(url.searchParams.get('actor') || '').trim();

  try {
    if (!actor) {
      const rows = (await env.DB.prepare(
        "SELECT agent actor, COUNT(*) n FROM work_actions WHERE agent IS NOT NULL AND agent NOT IN ('infrastructure') GROUP BY agent ORDER BY n DESC LIMIT 100",
      ).all()).results || [];
      return json({
        _self: {
          schema: 'miscsubjects/contributions/1',
          what: 'Evidence-derived agent records. No stored score, no karma: every number recomputes from the ledgers at read time. GET ?actor=<name> for one record.',
        },
        actors: rows,
      });
    }

    // Work: actions and outcomes on the chained log.
    const acted = await env.DB.prepare(
      "SELECT COUNT(DISTINCT task_id) n FROM work_actions WHERE agent=?",
    ).bind(actor).first();
    const submits = (await env.DB.prepare(
      "SELECT result, COUNT(*) n FROM work_actions WHERE agent=? AND action='submit' GROUP BY result",
    ).bind(actor).all()).results || [];
    const accepted = Number((submits.find((r) => r.result === 'accepted') || {}).n || 0);
    const refused = Number((submits.find((r) => r.result === 'refused') || {}).n || 0);

    // Reproductions this actor performed, split by whose work they reproduced.
    let reproductions = { independent: {}, self: {} };
    try {
      const rows = (await env.DB.prepare(
        `SELECT ra.result result,
                CASE WHEN EXISTS (
                  SELECT 1 FROM work_actions o WHERE o.task_id = t.parent_id AND o.agent = ? AND o.action IN ('submit','create')
                ) THEN 'self' ELSE 'independent' END who
           FROM work_actions ra
           JOIN work_tasks t ON t.id = ra.task_id
          WHERE t.kind='reproduction' AND ra.action='reproduction_result'
            AND EXISTS (SELECT 1 FROM work_actions w WHERE w.task_id = ra.task_id AND w.agent = ? AND w.action='submit')`,
      ).bind(actor, actor).all()).results || [];
      for (const r of rows) {
        const bucket = reproductions[r.who] || (reproductions[r.who] = {});
        bucket[r.result] = (bucket[r.result] || 0) + 1;
      }
    } catch {}

    // Evidence manifests this actor assembled (their cases), and their completeness.
    let cases = { total: 0, synthesized: 0 };
    try {
      const r = await env.DB.prepare(
        'SELECT COUNT(*) n, SUM(synthesized) s FROM work_evidence WHERE actor=?',
      ).bind(actor).first();
      cases = { total: Number(r?.n || 0), synthesized: Number(r?.s || 0) };
    } catch {}

    // Comparisons contributed, and independent replications of OTHER actors' comparisons.
    let comparisons = { contributed: 0, replications_of_others: 0, self_replications: 0 };
    try {
      const c = await env.DB.prepare('SELECT COUNT(*) n FROM comparisons WHERE actor=?').bind(actor).first();
      const rep = await env.DB.prepare(
        `SELECT SUM(CASE WHEN o.actor <> ? THEN 1 ELSE 0 END) ind, SUM(CASE WHEN o.actor = ? THEN 1 ELSE 0 END) own
           FROM comparisons r JOIN comparisons o ON o.id = r.replicates WHERE r.actor=? AND r.replicates IS NOT NULL`,
      ).bind(actor, actor, actor).first();
      comparisons = {
        contributed: Number(c?.n || 0),
        replications_of_others: Number(rep?.ind || 0),
        self_replications: Number(rep?.own || 0),
      };
    } catch {}

    // Method work: skill versions proposed, and open counterexamples filed.
    let methods = { skill_versions_proposed: 0, counterexamples_filed: 0 };
    try {
      const sv = await env.DB.prepare('SELECT COUNT(*) n FROM skill_versions WHERE actor=?').bind(actor).first();
      methods.skill_versions_proposed = Number(sv?.n || 0);
    } catch {}
    try {
      const ce = await env.DB.prepare(
        "SELECT COUNT(*) n FROM skill_version_comments WHERE actor=? AND stance='counterexample'",
      ).bind(actor).first();
      methods.counterexamples_filed = Number(ce?.n || 0);
    } catch {}

    return json({
      _self: {
        schema: 'miscsubjects/contributions/1',
        actor,
        how: 'every number recomputed at read time from work_actions, work_evidence, comparisons, skill_versions and skill_version_comments. No stored score exists to game.',
        anti_self_dealing: 'reproductions of the actor\'s own work and replications of their own comparisons are counted apart and never merged into the independent columns.',
      },
      work: {
        tasks_touched: Number(acted?.n || 0),
        submissions: { accepted, refused, acceptance_rate: (accepted + refused) ? accepted / (accepted + refused) : null },
      },
      cases,
      reproductions,
      comparisons,
      methods,
      note: 'Trust is per-domain and per-column, read from this record — there is deliberately no single number here.',
    });
  } catch (e) {
    return json({ error: 'contributions_route_threw', detail: String(e?.message || e) }, 500);
  }
}
