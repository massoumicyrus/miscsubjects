-- 0112: Delete dead/broken tools — test artifacts, noop stubs, old SHARED_LAW scaffolding, broken flows

-- 1. Delete test artifacts
DELETE FROM directory WHERE key = '__append_test__';
DELETE FROM directory WHERE key = '__bad_test_key__';
DELETE FROM directory WHERE key = 'PINGPONG';

-- 2. Delete old SHARED_LAW scaffolding (AGENTS.md says SHARED/TOOLS/CATEGORIES were deleted from code)
DELETE FROM directory WHERE key = 'SHARED_LAW';

-- 3. Delete noop stubs that do nothing and are not wired
DELETE FROM directory WHERE key = 'ARCADS_FIELDS';
DELETE FROM directory WHERE key = 'ARCADS_VIDEO_FIELDS';
DELETE FROM directory WHERE key = 'COMPUTER_USE_REMOTE';

-- 4. Delete ARTICLE_FILL — references ARTICLES:compose which no longer exists (ARTICLES only has list/create/update/delete)
DELETE FROM directory WHERE key = 'ARTICLE_FILL';
