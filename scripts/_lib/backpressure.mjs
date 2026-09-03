// One place to decide whether a failed read was the infrastructure pushing back.
//
// Three gates independently reported D1 backpressure as a finding about the corpus on
// 2026-09-02: PLAIN_LANGUAGE_LAW printed "an article is written in encyclopedia register" for
// prose it never fetched, SOURCE_QUOTE_LAW printed "repair the data; do not raise the ceiling"
// for a 7429, and the migration runner called an unparseable body a failed statement. Each one
// sends the next reader to fix something that was never broken, which is worse than no gate.
//
// The rule this encodes: a gate that could not read its subject has not judged its subject.
// It blocks the ship — silence is never a pass — but it says the read failed and exits 2, and
// the caller is expected to treat 2 differently from a real violation.

// D1 answers 7429 "requests queued for too long" under load, the account's REST endpoint
// answers 7500 "internal error" in bursts, and the edge sometimes answers with a bare error
// page that parses as nothing at all. None of these say anything about the data.
export const BACKPRESSURE =
  /7429|7500|D1 DB is overloaded|Requests queued for too long|isolate exceeded its memory limit|Network connection lost|fetch failed|render error|unparseable|\b(429|500|502|503|504)\b/i;

export const isBackpressure = (text) => BACKPRESSURE.test(String(text || ''));

// Synchronous, because the gates that need it drive wrangler through spawnSync and have no
// event loop to await on. Atomics.wait blocks the thread without burning it.
export function sleepSync(ms) {
  if (!(ms > 0)) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Overload clears on its own but not instantly: an immediate retry is the same request into the
// same queue. SOURCE_QUOTE_LAW retried four times with no delay and failed all four.
export const backoffFor = (attempt, why) =>
  (isBackpressure(why) ? Math.min(30000, attempt * 8000) : attempt * 2000);

// The one message shape for "I could not read my subject", and the one exit code for it.
export function exitUnread(law, why, tries) {
  console.error(
    `${law} could not read its subject after ${tries} tries: ${String(why).slice(0, 300)}. ` +
      'Nothing was audited, so nothing here is a verdict on the data. Re-run when the read succeeds; do not weaken the gate.',
  );
  process.exit(2);
}
