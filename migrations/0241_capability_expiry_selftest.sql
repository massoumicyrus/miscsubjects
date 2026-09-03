-- Capability-token self-tests must score the live token state, not stale launch-day success.
UPDATE directory_tests
SET expect_value = 'expired|no longer valid|not valid|token expired',
    expected_text = 'Explains the historical capability token is expired/no longer valid; expiring tokens are not expected to remain invokable forever.'
WHERE kind = 'e2e'
  AND key = 'ROUTER'
  AND args = 'what can capability cap_bfca1ad52e52a8ec do?'
  AND note = 'oip-caps v0.3';
