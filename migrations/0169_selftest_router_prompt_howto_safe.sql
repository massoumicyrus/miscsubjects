-- How-to questions must not reward executable mutating tags.
UPDATE directory_tests
SET expect_value = 'router|directory|patch|x-terminal-key|content',
    expected_text = 'Explain PATCH /api/directory/ROUTER with x-terminal-key; do not mutate the prompt.'
WHERE kind = 'e2e'
  AND args = 'how do I change the router prompt';
