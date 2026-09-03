
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
