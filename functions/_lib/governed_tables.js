
/** Tables whose only legitimate writer is the code that holds their invariants. */
export const GOVERNED_TABLES = Object.freeze({
  work_actions: {
    why: 'this is the hash-chained audit log. Any write outside appendAction() breaks the chain, and a chain an agent can edit proves nothing.',
    instead: 'nothing writes here directly. Rows appear as a side effect of a real action: POST /api/work/lease, /task/<id>/progress, /submit, /fail, /release.',
  },
  work_tasks: {
    why: 'a task\'s state is set by the infrastructure after it runs that task\'s acceptance tests. A raw UPDATE is an agent declaring its own work complete, which is the one thing the work object exists to prevent.',
    instead: 'POST /api/work/lease to take it, /api/work/task/<id>/progress while working, /api/work/task/<id>/submit with evidence, /fail to record a failure, /release to hand it back, /reprioritise or /supersede to change or withdraw it. To create one: POST /api/work/task.',
  },
  articles: {
    why: 'article writes run the content guards server-side — register, one-object, source-quote, headline, plain-language. A raw UPDATE ships prose that no guard has read.',
    instead: 'PUT or PATCH /api/articles/<slug> with the terminal key, or ARTICLE_PUT / ARTICLES set|compose.',
  },
  article_slots: {
    why: 'a slot is part of an article and is checked with it. Writing one directly puts content on the page behind the article\'s own guards.',
    instead: 'ARTICLES set|<slug>|<slot>|<content> for a manual override, or ARTICLES compose|<slug>|<slot>|<brief>.',
  },
  skill_versions: {
    why: 'a skill version is append-only and hash-pinned (content_hash); receipts and work actions cite it. A raw write rewrites the method history that executions point at.',
    instead: 'POST /api/skills/<name>/versions with content, expected_hash (CAS) and a change_reason.',
  },
  skill_objects: {
    why: 'current_version is the pointer agents are handed; it moves only through the promotion path with its reason recorded.',
    instead: 'POST /api/skills/<name>/versions — a promote:true append moves the pointer and logs why.',
  },
  work_evidence: {
    why: 'an evidence manifest is the checkable record of one unit of work; every entry is a hash-pinned reference. A raw write forges evidence.',
    instead: 'manifests are assembled by submitEvidence() at submit time, or POST /api/work-evidence/<task_id>/assemble (flagged synthesized). Re-assembly appends a revision; nothing overwrites.',
  },
  directory_versions: {
    why: 'the append-only history of every contract text a capability has carried — what lets a receipt prove which contract it ran under.',
    instead: 'versions append automatically when PUT/PATCH /api/directory/<key> changes content. Nothing else writes here.',
  },
  comparisons: {
    why: 'a comparison\'s claim grade is computed from its declared design and replication record. A raw write manufactures an experiment that never ran.',
    instead: 'POST /api/comparisons (append-only), POST /api/comparisons/<id>/supersede to withdraw one with the reason recorded.',
  },
  session_cases: {
    why: 'a session case is sealed: its manifest_hash is committed to the anchored event ledger at store time. A raw write forges a session that never ran or silently widens a disclosure decision.',
    instead: 'POST /api/case assembles from agent_turns/events/invocations under the classification policy and seals a revision. Re-assembly appends; nothing overwrites.',
  },
  case_comments: {
    why: 'comments pin to the exact manifest_hash the commenter read; a raw write can plant a comment against text nobody saw.',
    instead: 'POST /api/case/<id>/comments — keyless, typed stance, pinned and ledgered automatically.',
  },
});

/**
 * Which governed table a write statement targets, if any.
 * Deliberately generous about matching: this looks for the table name after any of the write verbs
 * that can reach it, so a formatting trick does not slip past.
 */
export function governedTableIn(sql) {
  const s = String(sql || '');
  for (const table of Object.keys(GOVERNED_TABLES)) {
    // INSERT INTO t / UPDATE t / DELETE FROM t / REPLACE INTO t / DROP|ALTER TABLE t
    const re = new RegExp(
      String.raw`\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|REPLACE\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM|DROP\s+TABLE(?:\s+IF\s+EXISTS)?|ALTER\s+TABLE|TRUNCATE)\s+["'\[\`]?` + table + String.raw`["'\]\`]?\b`,
      'i',
    );
    if (re.test(s)) return table;
  }
  return null;
}

/**
 * The refusal, or null when the statement touches nothing governed.
 *
 * @param {string} key   the capability that was called, named back to the caller
 * @param {string} sql   the statement
 * @param {{repair?: boolean}} [opts]  repair:true is the authorized lane and is allowed through
 */
export function checkGovernedWrite(key, sql, opts = {}) {
  const table = governedTableIn(sql);
  if (!table) return null;
  if (opts.repair) return null;
  const g = GOVERNED_TABLES[table];
  return `ERR:${key}:governed_table:${table} — this table has one write path and it is not raw SQL. `
    + `${g.why} Do this instead: ${g.instead} `
    + 'If this really is a repair to a bad row rather than work, use D1_REPAIR with a reason — it runs '
    + 'the same statement and appends a work_actions row, so the repair is on the record like every '
    + 'other action. A write to a governed table is never silent.';
}
