-- BUILD LAW — TIME: NOW returns the Pacific server clock via the fn, not SQLite UTC datetime('now').
UPDATE directory
SET type='fn', target='now',
    content='# Return the current time from the build clock in Pacific time (America/Los_Angeles).
# WHEN_TO_USE: any object or model that needs the current date or time.
# ARGS: none
# EX: [NOW][/NOW]
# OUTPUT: { now, today, time, zone, iso } — Pacific-offset ISO; today is the Pacific calendar date.',
    updated_at=datetime('now')
WHERE key='NOW';
