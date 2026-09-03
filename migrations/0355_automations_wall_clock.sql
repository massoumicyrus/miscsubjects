-- AN AUTOMATION CAN NOW BE ANCHORED TO A WALL-CLOCK HOUR INSTEAD OF AN INTERVAL.
--
-- Owner order 2026-08-09: "the automated email that goes out is supposed to go out at midnight,
-- not whenever you have it set for ... there is also a build rule that the time is always
-- pacific time."
--
-- Until now every scheduled automation was "every N minutes since the last run". That measures
-- from the previous run, so a daily job drifts by however long that run took and by every late
-- tick: the nightly Loop Bio Labs team report was set to 1440 minutes and went out at 04:42 one
-- night and 20:46 the next. An interval can never hold a time of day.
--
-- at_hour is the hour the job fires, 0-23. at_tz names the zone and defaults to Pacific, which
-- is the build's clock. It is deliberately separate from the store's Chicago day boundary: when
-- a report is sent is a build decision, what counts as a day of sales is the store's.
--
-- trigger='clock' takes the row out of the interval runner's hands entirely. AUTOMATE_RUN_DUE
-- selects trigger='schedule' and AUTOMATE_FIRE selects trigger='event:…', so an anchored row is
-- invisible to both and cannot fire twice by two paths. /api/automations/wall-clock owns it.
-- The two columns were added to the live database on 2026-08-09:
--
--   ALTER TABLE automations ADD COLUMN at_hour INTEGER;
--   ALTER TABLE automations ADD COLUMN at_tz TEXT;
--
-- They are recorded here rather than executed here. ship.mjs applies the newest migration file
-- on every deploy, and ALTER TABLE ADD COLUMN has no IF NOT EXISTS form in SQLite, so a live
-- ALTER in this file aborts the second deploy of the day with "duplicate column name" and takes
-- the whole ship down with it. Everything below is written to be safe to run any number of times.

-- The three Loop Bio Labs reports go out at midnight Pacific. The weekly and monthly recaps ride
-- the same nightly tick and gate themselves on the calendar, so they are anchored too — else
-- they drift onto a different hour than the daily report they sit beside.
UPDATE automations
   SET at_hour = 0, at_tz = 'America/Los_Angeles', trigger = 'clock'
 WHERE key IN ('LBL_DAILY_EMAIL', 'LBL_REPORT_EMAIL');

-- The tick that reads the clock. Every few minutes it asks whether any anchored job has reached
-- its hour; almost every call is a no-op, which is what a clock looks like.
INSERT OR REPLACE INTO directory (key, type, target, auth, content, category, planner_rank, planner_visible, enabled, updated_at) VALUES
('CLOCK_TICK', 'http', 'POST https://miscsubjects.com/api/automations/wall-clock', 'headers:{"x-terminal-key":"$TERMINAL_KEY"}',
'# WHAT: Fire every automation anchored to a wall-clock hour whose hour has arrived, once per local day. Anchored rows (trigger=clock, at_hour set) never fire on an interval — this is the only path that runs them.
# WHEN_TO_USE: the every-few-minutes tick calls it; call it by hand to see what is anchored and what is waiting.
# ARGS: none
# EX: [CLOCK_TICK][/CLOCK_TICK]
[]', 'automation', 60, 0, 1, datetime('now'));

INSERT INTO automations (name, every_min, key, body, enabled, created_at, runs, trigger)
SELECT 'wall-clock tick', 5, 'CLOCK_TICK', '', 1, datetime('now'), 0, 'schedule'
 WHERE NOT EXISTS (SELECT 1 FROM automations WHERE key = 'CLOCK_TICK');
