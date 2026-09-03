
DELETE FROM directory_tests
WHERE kind='e2e' AND note='one audit drop must force the meaning, benefit and edge';

INSERT INTO directory_tests (key,kind,args,expect_kind,expect_value,note,expected_text,tier)
VALUES (
  'ROUTER','e2e',
  'I want to give an incognito web model one build-audit drop. What must that single drop force the model to answer so I understand the technical significance instead of getting a feature comparison or a passing footnote?',
  'reply_ok',
  'central finding|meaning|big deal|concrete benefit|edge|enables|what this makes|where it loses|evidence|falsif',
  'one audit drop must force the meaning, benefit and edge',
  'One complete DROP requires the central finding first, then its mechanical meaning, whether and why it is a big deal, concrete benefit, defensible edge, what it enables, what this makes the build, current-landscape position, where the build loses, opened evidence and falsifiers. It rejects feature inventories, passing-footnote findings, router/self-test metrics and JSON-only replies.',
  8
);
