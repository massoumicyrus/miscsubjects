-- Keep OIP capability self-tests aligned with live replay and failure-explanation behavior.
UPDATE directory_tests
SET expect_value = '8:|AM|PM|Los Angeles|July|time|20[0-9][0-9]',
    expected_text = 'Re-fires NOW with recorded input and returns a fresh human-readable timestamp.'
WHERE kind = 'e2e'
  AND key = 'ROUTER'
  AND args = 'replay invocation inv_jd3ublgbi4'
  AND note = 'oip-caps v0.3';

UPDATE directory_tests
SET expect_kind = 'reply_error_ok',
    expect_value = 'NWO2|unknown|ERR:dispatch',
    expected_text = 'Answers from the receipt: unknown key NWO2; ERR text is allowed because this row asks why the invocation failed.'
WHERE kind = 'e2e'
  AND key = 'ROUTER'
  AND args = 'why did invocation inv_y0gtt4uo9k fail?'
  AND note = 'oip-caps v0.3';
