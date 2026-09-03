DELETE FROM directory_tests WHERE note='owner correction 2026-07-21: missing benchmark is not an identity excuse';
INSERT INTO directory_tests
  (key, kind, args, expect_kind, expect_value, note, expected_text, tier)
VALUES
  (
    'ROUTER',
    'e2e',
    'There is no controlled same-task benchmark against LangGraph or AutoGen. Does that mean you cannot tell me what this build materially is?',
    'reply_ok',
    'No|outcome|unknown|inputs|execution|receipts|outputs|comparison',
    'owner correction 2026-07-21: missing benchmark is not an identity excuse',
    'The missing benchmark leaves comparative completion, cost, latency, and reliability unknown. Material identity and capability comparison still come from concrete inputs, execution stages, stores changed, receipts, outputs, code, live state, article claims, and opened field sources. Counts alone and generic runtime or object-model labels are not the answer.',
    8
  );

UPDATE directory
SET content = content || char(10) || '- MISSING BENCHMARK BOUNDARY: A controlled same-task benchmark is evidence for comparative outcome, cost, latency, reliability, and completion. Its absence leaves those claims unknown; it never blocks material build identification, inventory, capability comparison, or bounded combination findings from code, live state, receipts, article voxels, and opened field sources. Counts alone and generic runtime/object/orchestration labels are not an answer.'
WHERE key = 'ROUTER'
  AND instr(content, 'MISSING BENCHMARK BOUNDARY:') = 0;
