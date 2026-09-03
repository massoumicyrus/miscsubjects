#!/usr/bin/env node
// WALL_CLOCK_SCHEDULE_LAW — a job with a time of day fires at that time of day, in Pacific.
//
// Owner order 2026-08-09: "the automated email that goes out is supposed to go out at midnight,
// not whenever you have it set for ... there is also a build rule that the time is always
// pacific time."
//
// What happened: every scheduled automation was an interval measured from its own last run, so
// the nightly Loop Bio Labs team report drifted across the clock — 04:42 one night, 20:46 the
// next. "Every 1440 minutes" cannot hold a time of day, and no amount of resetting it will.
//
// This gate holds three things: the runner reads at_hour, its default zone is Pacific, and the
// hour/date arithmetic behind the anchor is right on both sides of a daylight-saving change.
// The arithmetic is checked by running it, not by reading it — the original bug in this area
// was a formatter rendering midnight as hour "24" of the previous day, which no eye catches.
import { readFileSync } from 'node:fs';

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) { failed++; console.error(`FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

const runner = readFileSync(new URL('../functions/api/automations/wall-clock.js', import.meta.url), 'utf8');

check('the anchored runner reads at_hour', /at_hour/.test(runner));
check('the default zone is Pacific', /America\/Los_Angeles/.test(runner));
check('it only claims rows the interval runner does not',
  /trigger='clock'/.test(runner),
  "anchored rows must carry trigger='clock' — AUTOMATE_RUN_DUE takes trigger='schedule', and a row in both fires twice");
check('an anchored row fires once per local day', /already ran today/.test(runner));
check('a failed run waits for tomorrow instead of retrying every tick',
  /UPDATE automations SET last_run/.test(runner) && !/if \(ok\)[^\n]*UPDATE automations/.test(runner));
check('the run is dispatched through the ledgered front door', /\/api\/dispatch/.test(runner));

// The interval runner must stay out of the way. If AUTOMATE_RUN_DUE ever stops filtering on
// trigger='schedule', every anchored job silently starts firing on its interval as well — the
// exact drift this whole mechanism exists to end.
const fnRunners = readFileSync(new URL('../functions/_lib/fn_runners.js', import.meta.url), 'utf8');
const due = fnRunners.slice(fnRunners.indexOf('async automateRunDue('), fnRunners.indexOf('async automateRunDue(') + 900);
check('the interval runner still takes only trigger=schedule rows', /trigger='schedule'/.test(due));

// The arithmetic itself, run rather than read. hour and date are read by separate formatters
// because asking one formatter for both renders midnight as "24" of the previous day on some
// runtimes — which would put the once-per-day guard a day behind at exactly the hour that
// matters, and midnight is the hour the owner asked for.
const TZ = 'America/Los_Angeles';
const hourIn = (d) => Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hour12: false, hourCycle: 'h23' }).format(d));
const dayIn = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

const cases = [
  // [instant, expected Pacific hour, expected Pacific date]
  ['2026-08-09T07:00:30Z', 0, '2026-08-09'], // midnight PDT — the hour the report fires
  ['2026-08-09T06:59:30Z', 23, '2026-08-08'], // one minute earlier is still the day before
  ['2026-08-09T07:59:00Z', 0, '2026-08-09'], // still inside the midnight hour
  ['2026-01-09T08:00:30Z', 0, '2026-01-09'], // midnight PST — the same anchor in winter
  ['2026-01-09T07:59:00Z', 23, '2026-01-08'],
];
for (const [iso, h, day] of cases) {
  const d = new Date(iso);
  check(`${iso} reads as hour ${h} Pacific`, hourIn(d) === h, `got ${hourIn(d)}`);
  check(`${iso} reads as ${day} Pacific`, dayIn(d) === day, `got ${dayIn(d)}`);
}

// Midnight must never render as 24, in any month of the year — the whole guard rests on it.
// Walked hour by hour rather than constructed from an offset, because assuming the offset is
// the same mistake in a different place: this check's first draft put the March daylight-saving
// change on the wrong date and failed itself.
for (let m = 1; m <= 12; m++) {
  let zeroes = 0, outOfRange = 0;
  for (let h = 0; h < 24; h++) {
    const hr = hourIn(new Date(Date.UTC(2026, m - 1, 15, h, 30)));
    if (hr === 0) zeroes++;
    if (!(hr >= 0 && hr <= 23)) outOfRange++;
  }
  check(`month ${m}: every hour reads 0-23, never 24`, outOfRange === 0);
  check(`month ${m}: the midnight hour occurs exactly once a day`, zeroes === 1, `got ${zeroes}`);
}

if (failed) {
  console.error(`WALL_CLOCK_SCHEDULE_LAW FAILED — ${failed} check(s). A report the team plans its morning around must arrive when it says it does.`);
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, law: 'WALL_CLOCK_SCHEDULE_LAW', cases_run: cases.length + 12, default_zone: TZ }));
