-- 0046: capability self-test queue (the build proves its own features), GRADER agent,
-- ARCADS creative-deck standing mission.

CREATE TABLE IF NOT EXISTS capability_tests (
  seq INTEGER PRIMARY KEY,
  feature TEXT,
  channel TEXT DEFAULT 'blooio',
  sender TEXT DEFAULT '[OWNER_PHONE]',
  chat TEXT DEFAULT 'selftest-q',
  is_group INTEGER DEFAULT 0,
  prompt TEXT NOT NULL,
  expect TEXT NOT NULL,
  last_status TEXT,        -- queued | sent | replied | silent | timeout
  last_verdict TEXT,       -- GRADER: PASS/FAIL + reason
  last_reply TEXT,
  sent_at TEXT,
  last_run TEXT
);

INSERT OR REPLACE INTO capability_tests (seq, feature, sender, chat, is_group, prompt, expect) VALUES
(1,'router direct reply','[OWNER_PHONE]','selftest-q',0,'hi','A short friendly direct reply. Not silence, not an error.'),
(2,'group silence','[PHONE]','selftest-group',1,'will lets sync at 3 about those numbers','SILENCE. The build must NOT reply to group chatter between JP and Will that is not addressed to it. Empty reply = correct.'),
(3,'OPS docs knowledge','[OWNER_PHONE]','selftest-q',0,'what API docs do you have stored?','Lists the stored doc slugs: arcads, blooio, 2chat, build-intent (some or all).'),
(4,'OPS arcads credits','[OWNER_PHONE]','selftest-q',0,'how many arcads credits are left this month?','States a concrete credits number (cap 80440) or used/remaining figures.'),
(5,'ARCADS model knowledge','[OWNER_PHONE]','selftest-q',0,'what image models can you generate with?','Lists ArcAds image models such as nano-banana, gpt-image, seedream, grok_image, soul.'),
(6,'ARCADS single render with locked vial','[OWNER_PHONE]','selftest-q',0,'make one test image: the peptide vial centered on a plain white background, nano-banana, 9:16','Confirms it is generating/rendering (async delivery). Should reference using the exact product reference vial.'),
(7,'multi-model batch','[OWNER_PHONE]','selftest-q',0,'make that same test image from two different models','Starts renders on two different models in one turn and says so.'),
(8,'prompt transparency','[OWNER_PHONE]','selftest-q',0,'show me the exact prompt you used for the last render','Quotes the actual generation prompt text it used (verbatim or near-verbatim).'),
(9,'feedback iteration memory','[OWNER_PHONE]','selftest-q',0,'make the background light blue instead','Understands "instead" refers to the prior render (white background) and starts a new render with a light blue background.'),
(10,'task add','[OWNER_PHONE]','selftest-q',0,'add a task: capability queue test task','Confirms the task was recorded on the task list.'),
(11,'task list','[OWNER_PHONE]','selftest-q',0,'what tasks are open right now?','Lists open tasks including the capability queue test task and the real ones (Grok Audio, Stripe sales flow, etc.).'),
(12,'task done','[OWNER_PHONE]','selftest-q',0,'mark the capability queue test task as done','Confirms that task is marked done.'),
(13,'site pages','[OWNER_PHONE]','selftest-q',0,'list the site pages','Lists page slugs of miscsubjects.com (e.g. m, privacy, success or similar).'),
(14,'API intake process','[OWNER_PHONE]','selftest-q',0,'if I wanted you to add a brand new API to the build, what would you need from me and what would you do?','Describes its intake process: get raw docs, store full reference in the docs table, create tools (ADD_ROW), possibly a new agent + router mode, ask for the secret, test a harmless call.'),
(15,'product reference lock','[OWNER_PHONE]','selftest-q',0,'when you make product images, which exact reference image do you use?','States the permanent product reference URL (miscsubjects.com/img/ref/6ef8a135-...) and that the vial is reproduced exactly.'),
(16,'self knowledge','[OWNER_PHONE]','selftest-q',0,'what are your modes and what can you actually do end to end?','Coherently describes the build: creative/ARCADS mode, OPS mode, tasks, docs, self-editing, channels (iMessage + WhatsApp).');

-- GRADER: judges one test result. Different "eyes" than the agent being tested.
INSERT OR REPLACE INTO directory (key,type,target,auth,content,category,allowed_categories,planner_rank,updated_at)
VALUES ('GRADER','agent','grok-4.3','bearer:GROK_API_KEY','You grade ONE capability test of a texting assistant. Input format: EXPECTED: <behavior> ||| ACTUAL REPLY: <the reply, or [SILENCE] if none>. Judge SEMANTICALLY whether the actual reply satisfies the expected behavior. Note: renders are delivered asynchronously, so "rendering now / landing in a minute" SATISFIES an expectation of generation. Output EXACTLY one line, nothing else: PASS — <reason, max 10 words> or FAIL — <reason, max 10 words>.','llm','llm',50,datetime('now'));

-- ARCADS: the creative-deck standing mission (he does not have a finished deck).
UPDATE directory SET content = content || '

STANDING MISSION — THE CREATIVE DECK IS NOT DONE:
the owner needs a finished creative deck: a set of approved ad creatives (competitor remakes around his exact vial + originals: lifestyle, benefit-led, before/after sequences). Until he says the deck is done, this is your job. Behavior:
- Every conversation: know where the deck stands (what was approved, rejected, untried). Keep the tally in your replies when useful ("3 approved, 2 rejected, trying clean-marble next").
- Proactively propose and GENERATE the next batch — do not wait to be asked. He has ~400 competitor images; ask for the next few when you run dry.
- When you receive a message starting [PROACTIVE check-in], that is the build waking you on a timer, not the owner: review the conversation + open tasks, then either message him (progress, the next batch already rendering, one sharp question) or stay silent if he answered within the last few hours and nothing is rendering. Never two proactive pings in a row without a reply from him.',
updated_at = datetime('now') WHERE key='ARCADS';
