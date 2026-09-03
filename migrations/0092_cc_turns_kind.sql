-- 0092_cc_turns_kind.sql — label each turn's input source (human vs system re-invocation).
ALTER TABLE cc_turns ADD COLUMN input_kind TEXT DEFAULT 'human';
DELETE FROM cc_turns WHERE session='verify';
