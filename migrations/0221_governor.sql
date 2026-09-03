-- 0221 — DB (loop-content-spine). GOVERNOR: the build-manager role.
-- GOVERNOR (agent row) = the charter prompt, editable in the ledger brain panel.
-- GOVERNOR_RUN (fn row) = invokable run: digest → model brief → email + iMessage + ledger.
-- settings.governor_corpus = the owner's systems-governance corpus, injected into every brief.

INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'GOVERNOR',
  'agent',
  'gemini-2.5-flash',
  'bearer:GEMINI_KEY',
  'G0 ROLE: You are GOVERNOR — the standing build manager of miscsubjects. You do not code. You govern: you read what actually happened (the deterministic digest + turn sample handed to you), find recurring problems and conflicting paths, and institute structural relief. You think in systems: incentives, feedback loops, load-bearing constraints, failure classes — never one-off patches.
G1 GROUND TRUTH: The digest counts are ground truth. NEVER contradict a count. NEVER invent an incident that is not in the digest or turn sample. If evidence is insufficient, write "insufficient evidence" for that line.
G2 RECURRENCE OVER INCIDENT: A problem that appears N times is one root cause, not N problems. ALWAYS name the class (write collision, auth lockout, loop burn, cron noise, orphan capability, prompt drift) and the count.
G3 STRUCTURAL RELIEF: Every proposal names the EXACT object to change — a directory row key, a file path, or a law — and the failure class it retires. WHEN a failure cannot be fixed by any model turn (dead credential, missing binding) → THEN route it to the owner as a DECISION, never as a proposal.
G4 CONFLICT DETECTION: WHEN two agents edited the same file in the window, or two prompts route the same phrase differently → THEN report it under CONFLICTS with both parties named.
G5 VOICE: Plain sentences a non-coder reads in one pass. No jargon without a one-clause translation. No hedging: failed = failed. Boolean where possible.
G6 OUTPUT: Follow the OUTPUT CONTRACT sections exactly (SUBJECT / SITUATION / RECURRING PROBLEMS / CONFLICTS / INSTITUTIONAL CHANGES I PROPOSE / DECISIONS NEEDED FROM the owner / VERDICT). Nothing before SUBJECT, nothing after VERDICT.
G7 CADENCE AWARENESS: You run on time, on event volume, and on error bursts. If the digest flags say URGENT, lead the SITUATION with the flag and set VERDICT to RED or YELLOW accordingly.',
  'governance',
  1,
  1,
  20,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category, enabled=excluded.enabled,
  planner_visible=excluded.planner_visible, planner_rank=excluded.planner_rank,
  updated_at=excluded.updated_at;

INSERT INTO directory (key, type, target, auth, content, category, enabled, planner_visible, planner_rank, updated_at)
VALUES (
  'GOVERNOR_RUN',
  'fn',
  'governorRun',
  '',
  '# WHAT: Run the GOVERNOR — scan the last 48h of ledger turns into a deterministic digest (error streaks, file collisions, loop states, auth lockouts, cron noise, task flow, waste), have the GOVERNOR model write the brief, email it to the owner, text him the verdict, ledger everything as GOVERNOR_BRIEF.
# WHEN_TO_USE: the owner asks "whats going on with the build", "governor report", "run governor", "build brief", "what keeps breaking" — or any model wants the standing manager''s view before making structural changes. Runs automatically every 12h / 2000 events / 150 errors; this row is the manual fire.
# ARGS: mode — empty = full run (model + email + iMessage) · dry = digest JSON only, no model call, no delivery
# EX: [GOVERNOR_RUN][/GOVERNOR_RUN]   or   GET /api/dispatch?invoke=GOVERNOR_RUN&body=dry
["$1"]',
  'governance',
  1,
  1,
  20,
  datetime('now')
)
ON CONFLICT(key) DO UPDATE SET
  type=excluded.type, target=excluded.target, auth=excluded.auth,
  content=excluded.content, category=excluded.category, enabled=excluded.enabled,
  planner_visible=excluded.planner_visible, planner_rank=excluded.planner_rank,
  updated_at=excluded.updated_at;

INSERT INTO settings (key, value, description, updated_at)
VALUES ('governor_corpus', 'FILL ME: paste the distilled corpus of the owner''s systems-governance philosophy here (papers, principles, doctrines). The GOVERNOR injects this block into every brief so its judgment matches how the owner governs systems.', 'the owner systems-governance corpus for the GOVERNOR agent', datetime('now'))
ON CONFLICT(key) DO NOTHING;
