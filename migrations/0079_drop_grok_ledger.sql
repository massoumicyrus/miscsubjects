-- 0079: remove the grok ledger. There is ONE ledger now — events (binding LEDGER),
-- vertical + chronological, every payload in/out. functions/grok/audit.js no longer
-- writes grok_ledger; the /grok page that displayed it was deleted.
DROP TABLE IF EXISTS grok_ledger;
