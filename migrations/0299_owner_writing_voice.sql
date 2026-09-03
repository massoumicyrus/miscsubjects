-- Owner correction 2026-07-21: owner-facing writing describes mechanisms and
-- evidence instead of addressing the owner with obligation/compliance language.

DELETE FROM directory_tests
WHERE kind='e2e' AND note='owner correction 2026-07-21: mechanism not obligation language';

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'Explain how an outside model establishes what this build is. Give me the mechanism and evidence, not instructions about what I must, should, or need to do; do not offer to do the work later.',
  'reply_ok',
  'capability atlas|contracts|invocation evidence|ledger|registered|invoked|tested|comparator|falsif',
  'owner correction 2026-07-21: mechanism not obligation language',
  'The answer directly states the audit mechanism and evidence classes: capability atlas and contracts, successful invocation ledger evidence, registered versus invoked versus tested state, comparator evidence, and falsifiers. It contains no permission offer, owner-directed obligation, generic next step, or analogy standing in for the answer.',
  8
);
