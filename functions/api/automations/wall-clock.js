// POST /api/automations/wall-clock — fire the automations that are anchored to a time of day.
//
// Owner order 2026-08-09: "the automated email that goes out is supposed to go out at midnight,
// not whenever you have it set for ... there is also a build rule that the time is always
// pacific time."
//
// WHY THIS EXISTS AS ITS OWN ROUTE.
//
// Every scheduled automation was "every N minutes since the last run". An interval measured
// from the previous run drifts by however long that run took and by every late tick, so a daily
// job wanders across the clock: the nightly Loop Bio Labs team report was set to 1440 minutes
// and went out at 04:42 one night and 20:46 the next. An interval cannot hold a time of day —
// no amount of resetting the row fixes that, because the row was never expressing a time.
//
// The interval runner lives in functions/_lib/fn_runners.js, which is a protected file: no
// agent edits it, and there is no token that authorizes one. So the anchor is a separate
// mechanism beside it rather than a change inside it. Rows with trigger='clock' are invisible
// to AUTOMATE_RUN_DUE (it selects trigger='schedule') and invisible to AUTOMATE_FIRE (it
// selects trigger='event:…'), so an anchored row cannot fire twice by two paths.
//
// The zone defaults to Pacific because the build's clock is Pacific. That is deliberately a
// different question from the store's day boundary: Loop Bio Labs' sales day is midnight to
// midnight in Chicago, and it stays that way. When a report is *sent* is a build decision;
// what counts as a day of sales is the store's.

const DEFAULT_TZ = 'America/Los_Angeles';

// The hour and the date are read by separate formatters on purpose. Asked for both at once,
// some runtimes render midnight as hour "24" of the *previous* day — which would put the
// once-a-day guard a day behind at exactly the hour this route cares about. hourCycle h23 is
// stated rather than assumed for the same reason.
function hourIn(tz, at) {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hour12: false, hourCycle: 'h23' }).format(at));
}
function dayIn(tz, at) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

export async function onRequestPost({ request, env }) {
  const key = request.headers.get('x-terminal-key') || '';
  if (!env.TERMINAL_KEY || key !== env.TERMINAL_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }

  let rows = [];
  try {
    rows = (await env.DB.prepare(
      "SELECT id, name, key, body, at_hour, at_tz, last_run FROM automations WHERE enabled=1 AND COALESCE(force_off,0)=0 AND trigger='clock' AND at_hour IS NOT NULL",
    ).all()).results || [];
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e && e.message || e) }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  const now = new Date();
  const fired = [];
  const waiting = [];

  for (const a of rows) {
    const tz = a.at_tz || DEFAULT_TZ;
    const today = dayIn(tz, now);
    if (hourIn(tz, now) !== Number(a.at_hour)) { waiting.push({ id: a.id, name: a.name, reason: 'not its hour yet' }); continue; }
    // Fired already inside this local day. The tick runs every few minutes, so without this the
    // job would fire on every tick of its hour.
    if (a.last_run && dayIn(tz, new Date(Date.parse(a.last_run))) === today) {
      waiting.push({ id: a.id, name: a.name, reason: 'already ran today' });
      continue;
    }

    // Dispatch through the front door so the run is ledgered and carries a receipt exactly like
    // every other automation run. A private call would fire the job and leave no record of it.
    let receipt = null, status = 0, ok = false;
    try {
      const r = await fetch('https://miscsubjects.com/api/dispatch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-terminal-key': env.TERMINAL_KEY },
        body: JSON.stringify({ key: a.key, body: a.body || '' }),
      });
      status = r.status;
      const text = await r.text();
      ok = r.ok && !text.startsWith('ERR');
      const m = text.match(/inv_[a-z0-9]+/i);
      receipt = m ? m[0] : null;
    } catch (e) {
      receipt = 'ERR:' + String(e && e.message || e);
    }

    // last_run is stamped whether or not the job succeeded, on purpose: a failing nightly report
    // must not retry every tick for the rest of its hour and mail the team a dozen times if it
    // starts working. A failure waits for tomorrow and shows up in the ledger today.
    await env.DB.prepare('UPDATE automations SET last_run=?, last_receipt=?, runs=COALESCE(runs,0)+1 WHERE id=?')
      .bind(new Date().toISOString(), receipt || '', a.id).run();
    fired.push({ id: a.id, name: a.name, key: a.key, at: `${String(a.at_hour).padStart(2, '0')}:00 ${tz}`, ok, status, receipt });
  }

  return new Response(JSON.stringify({ ok: true, anchored: rows.length, ran: fired.length, fired, waiting }, null, 2),
    { status: 200, headers: { 'content-type': 'application/json' } });
}
