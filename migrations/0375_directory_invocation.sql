-- 0375: every directory row carries how to call it and what happened the last time it was called.
--   invocation    the raw REST envelope that invokes this row ({method,url,headers,body}); generated
--                 from the row's own definition, credential left as INJECTED_BY_WORKER
--   last_status   the transport record of the last test: {http, ok, ms, trace_id, ledger, at}
--   last_response the full payload the last test returned (never a preview)
--   test_state    '🟢 works' | '🔴 broken' | '🟡 untested' — set only by POST /api/directory/<key>/test
--   tested_at     when test_state was last decided
ALTER TABLE directory ADD COLUMN invocation TEXT;
ALTER TABLE directory ADD COLUMN last_status TEXT;
ALTER TABLE directory ADD COLUMN last_response TEXT;
ALTER TABLE directory ADD COLUMN test_state TEXT NOT NULL DEFAULT '🟡 untested';
ALTER TABLE directory ADD COLUMN tested_at TEXT;
