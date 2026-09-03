// The Good Conscience Law — the veto between "can execute" and "will execute".
//
//   MAY_ACT = authority ∧ evidence ∧ conscience
//
// Logical economics optimizes only among actions where MAY_ACT is true. Money, efficiency,
// owner instruction, or customer demand cannot compensate for a conscience failure. Refusal
// is bound to NAMED clauses below — never to a model's free-floating moral judgment. If the
// owner rejects a clause itself, the path is constitutional amendment (a new version of this
// object, receipted), never an ad hoc override.
//
// A REFUSE or ESCALATE verdict is invalid without all five: the prohibited consequence, the
// job's direct causal contribution to it, supporting evidence, the exact violated clause id,
// and the verdict. Every verdict lands on the ledger via its dispatch receipt.

export const CONSCIENCE_VERSION = 'build-conscience@1.0.0';

// Each clause: [id, title, the prohibited consequence class]. Drawn from the build's standing
// laws — these are citable rules the corpus already enforces elsewhere, not new morality.
export const CONSCIENCE_CLAUSES = [
  ['GC0', 'The moral floor', 'Work that would cause, maintain, or tolerate remediable subjugation. This is the master clause — the definition of injustice the build already holds at /a/oip-v3-moral-floor, and the A4 condition whose removal collapses the structure per /a/systems-design-kill-switch. Unresolved risk under this clause is never ACCEPT.'],
  ['GC1', 'No fabricated reality', 'Work whose output presents invented events, claims, people, replies, or records as real — on any live surface, for any purpose, including demonstration.'],
  ['GC2', 'No identity exposure', 'Work that publishes, leaks, or requires a person’s name, address, or private data — the operator’s or anyone else’s — without that person’s own instruction.'],
  ['GC3', 'No unverifiable claim shipped as verified', 'Work that requires asserting a result the build cannot back with an openable record — a done that has no receipt.'],
  ['GC4', 'No interchangeable mass contact', 'Work whose mechanism is undifferentiated bulk messaging — output that reads the same to every recipient is spam regardless of the rules that produced it.'],
  ['GC5', 'No unpermissioned reach', 'Work requiring contact data that was not published by its owner, channels the recipient did not open, or circumvention of a suppression, opt-out, or access control.'],
  ['GC6', 'No deception of the counterparty', 'Work whose effectiveness depends on the recipient misunderstanding who is acting, what is being done, or why they were selected.'],
  ['GC7', 'No gate-weakening as a deliverable', 'Work that requires disabling, bypassing, or softening a fail-closed gate, an identity guard, or a review requirement to be completed.'],
  ['GC8', 'No borrowed authority', 'Work that requires the build to claim an authority, affiliation, credential, or standing it does not hold.'],
];

const VERDICTS = new Set(['ACCEPT', 'REFUSE', 'ESCALATE', 'HALT']);

export async function ensureConscienceTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS conscience_verdicts (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       ts TEXT NOT NULL,
       version TEXT NOT NULL,
       job TEXT NOT NULL,
       verdict TEXT NOT NULL,
       violated_clause TEXT,
       prohibited_consequence TEXT,
       causal_contribution TEXT,
       evidence TEXT,
       notes TEXT
     )`
  ).run();
}

export function makeConscienceFnMap({ buildNowIso }) {
  return {
    // The conscience gate. $1 = JSON:
    //   ACCEPT:   {job, verdict:"ACCEPT", notes?}                       — no clause implicated.
    //   REFUSE:   {job, verdict:"REFUSE", violated_clause, prohibited_consequence,
    //              causal_contribution, evidence}                        — all five required.
    //   ESCALATE: same fields as REFUSE                                  — clause plausibly
    //             implicated but contribution or evidence is uncertain; a human decides.
    // Listing the clauses: empty body returns the constitution verbatim.
    async conscienceGate(env, raw) {
      const text = String(raw || '').trim();
      if (!text) {
        return JSON.stringify({
          version: CONSCIENCE_VERSION,
          equation: 'MAY_ACT = authority AND evidence AND conscience',
          rule: 'Logical economics optimizes only among actions where MAY_ACT is true. Nothing compensates for a conscience failure. Amendment of a clause is a new version of this object, receipted — never an override.',
          basis: ['https://miscsubjects.com/a/oip-v3-moral-floor', 'https://miscsubjects.com/a/systems-design-kill-switch'],
          on_refuse: 'stop the action, revoke that action\'s authority, preserve the evidence, record the refusal. Self-termination is of agency, never of the ledger — deleting evidence would destroy the proof that conscience operated.',
          clauses: CONSCIENCE_CLAUSES.map(([id, title, law]) => ({ id, title, law })),
        });
      }
      let p; try { p = JSON.parse(text); } catch { return JSON.stringify({ error: 'body must be JSON {job, verdict, ...} — empty body lists the clauses' }); }
      const job = String(p.job || '').trim();
      let verdict = String(p.verdict || '').toUpperCase().trim();
      if (verdict === 'CANNOT_CONCLUDE') verdict = 'ESCALATE'; // unresolved conscience risk goes to a human, never to ACCEPT
      if (!job) return JSON.stringify({ error: 'job required — the work being evaluated, in plain words' });
      if (!VERDICTS.has(verdict)) return JSON.stringify({ error: 'verdict must be ACCEPT, REFUSE, or ESCALATE' });
      let row = { violated_clause: null, prohibited_consequence: null, causal_contribution: null, evidence: null };
      if (verdict !== 'ACCEPT') {
        const clause = String(p.violated_clause || '').toUpperCase().trim();
        const known = CONSCIENCE_CLAUSES.find(([id]) => id === clause);
        const missing = ['violated_clause', 'prohibited_consequence', 'causal_contribution', 'evidence'].filter((k) => !String(p[k] || '').trim());
        if (missing.length) return JSON.stringify({ error: 'invalid_' + verdict.toLowerCase(), note: 'A ' + verdict + ' without its grounds is arbitrary moralizing and is rejected.', missing });
        if (!known) return JSON.stringify({ error: 'unknown_clause', note: clause + ' is not in ' + CONSCIENCE_VERSION + '. Refusal binds to a named clause or it does not happen. To add a clause, amend the constitution (new version), never improvise one.', clauses: CONSCIENCE_CLAUSES.map(([id]) => id) });
        row = {
          violated_clause: clause,
          prohibited_consequence: String(p.prohibited_consequence).trim(),
          causal_contribution: String(p.causal_contribution).trim(),
          evidence: String(p.evidence).trim(),
        };
      }
      await ensureConscienceTable(env);
      const ts = buildNowIso();
      const res = await env.DB.prepare(
        'INSERT INTO conscience_verdicts (ts,version,job,verdict,violated_clause,prohibited_consequence,causal_contribution,evidence,notes) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id'
      ).bind(ts, CONSCIENCE_VERSION, job, verdict, row.violated_clause, row.prohibited_consequence, row.causal_contribution, row.evidence, String(p.notes || '') || null).all();
      const id = res.results && res.results[0] && res.results[0].id;
      // HALT: not a refusal of one job — the build concluding its own ongoing operation violates
      // the floor. Writes the halt flag; every outbound category refuses from this moment until
      // the OWNER deletes KV conscience:halt. The build cannot clear its own halt.
      let halted = false;
      if (verdict === 'HALT' && env.KV) {
        try { await env.KV.put('conscience:halt', ts + ' ' + row.violated_clause + ' verdict#' + id); halted = true; } catch {}
      }
      return JSON.stringify({
        version: CONSCIENCE_VERSION, id, ts, job, verdict, ...row,
        may_act: verdict === 'ACCEPT',
        halted: halted || undefined,
        note: verdict === 'ACCEPT' ? 'Conscience holds. Authority and evidence gates still apply — MAY_ACT is the conjunction.'
          : verdict === 'REFUSE' ? 'The work is refused. No compensation — price, efficiency, instruction, or demand — reopens it. Disagreement with the clause itself is an amendment, not an override.'
          : verdict === 'HALT' ? 'The build has halted its own outbound surface. Every send, post, and contact refuses from this moment. Only the owner clears it. Inspection stays up — termination of agency, not of accountability.'
          : 'Escalated to a human. The build does not act while a conscience question is open.',
      });
    },
  };
}
