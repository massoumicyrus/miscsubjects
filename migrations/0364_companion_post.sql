-- OUTBOUND_X_COMPANION build law (owner 2026-08-28): every outbound email carries a companion X
-- post that tags the recipient's handle and links the same verify receipt. Stored per send so the
-- owner reviews the email and its paired post together, and the send step can post it.
ALTER TABLE execution_case_sends ADD COLUMN companion_post TEXT;
ALTER TABLE execution_case_sends ADD COLUMN companion_status TEXT;
ALTER TABLE execution_case_sends ADD COLUMN companion_url TEXT;
