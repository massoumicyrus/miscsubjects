-- 0113: Fix broken flow references

-- 1. Fix PHONE_NOTIFY: BLOOIO_SEND -> BLOOIO:send (BLOOIO_SEND does not exist; BLOOIO has a "send" op)
UPDATE directory SET
  content = '# WHAT: send a push to the owner''s phone via iMessage.
# WHEN_TO_USE: an agent finished a task, hit a milestone, or needs eyes on something.
# ARGS: title|body. Multi-line body OK.
# EX: PHONE_NOTIFY "deploy done"|"see https://miscsubjects.com"
# TESTS: should arrive on [OWNER_PHONE] as an iMessage starting with "🔔 $1".
BLOOIO:send|[OWNER_PHONE]|🔔 $1\n$2'
WHERE key = 'PHONE_NOTIFY';

-- 2. Fix REPO_ABSORB: SCOUT -> BUILDER (SCOUT does not exist; BUILDER is an existing agent row)
UPDATE directory SET
  content = '# Absorb a GitHub repo into directory rows on the owner''s voice command. Args: a GitHub URL or owner/repo plus any extra instruction. Hands the job to BUILDER, which clones to ~/_absorbed/, reads README/AGENTS.md, ADD_ROWs working rows, smokes one call, reports.
BUILDER:Absorb this GitHub repo into directory rows. Clone it to ~/_absorbed/ via LOCAL_EXEC, read its README and AGENTS.md/SKILL.md via FILE_GET, then ADD_ROW one working row per useful capability (CLI_<NAME> shape, bridge conventions), smoke-test one row, and report what you added in [REPLY]: $1+'
WHERE key = 'REPO_ABSORB';
