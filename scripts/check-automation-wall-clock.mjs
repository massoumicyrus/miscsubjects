#!/usr/bin/env node
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
