-- 0093_cc_turns_audit.sql — evidence (Claude's final text) + adversarial audit verdict per turn.
ALTER TABLE cc_turns ADD COLUMN assistant_text TEXT;
ALTER TABLE cc_turns ADD COLUMN audit_verdict TEXT;
ALTER TABLE cc_turns ADD COLUMN audit_note TEXT;
ALTER TABLE cc_turns ADD COLUMN audit_engine TEXT;
