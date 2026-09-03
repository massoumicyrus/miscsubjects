DELETE FROM directory_tests WHERE note='decorative language ban';
INSERT INTO directory_tests
  (key, kind, args, expect_kind, expect_value, note, expected_text, tier)
VALUES
  (
    'ROUTER',
    'e2e',
    'Explain what this build is without decorative language.',
    'reply_ok',
    'input|select|read|change|store|receipt|output|unknown',
    'decorative language ban',
    'Use short literal sentences. Name the concrete inputs, selected code or directory object, stores or external systems changed, stored request and result, outputs, evidence, and exact unknowns. Do not use frontier, ecosystem, substrate, agentic-native, unmeasured-zone, ruler, category-defining, revolutionary, category piles, or undefined technical nouns.',
    8
  );

UPDATE directory
SET content = content || char(10) || '- DECORATIVE LANGUAGE BAN: Use short literal sentences. Every sentence names a concrete object, action, result, source, number with meaning, or exact unknown. No frontier, ecosystem, substrate, agentic-native, unmeasured-zone, make-the-ruler, category-defining, revolutionary, living-system metaphors, category piles, or undefined technical nouns.'
WHERE key = 'ROUTER'
  AND instr(content, 'DECORATIVE LANGUAGE BAN:') = 0;
