-- Tool-count self-test must require the total capability count, not a category count.
UPDATE directory_tests
SET expect_value = 'total|tools|6[0-9][0-9]|665|668',
    expected_text = 'Report the total tool/capability count from WORLD_MAP total_tools or DIR_LIST count, not a category count.'
WHERE kind = 'e2e'
  AND args = 'how many tools do you have';
