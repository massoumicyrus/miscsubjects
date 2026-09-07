// Mechanical tests for the learned-flow compiler. node scripts/flow-learn.test.mjs
import assert from 'node:assert/strict';
import { compileSteps, slugKey, parseLearnBody } from '../functions/_lib/flow_learn.js';

let n = 0;
const test = (name, fn) => { try { fn(); n++; console.log('ok', name); } catch (e) { console.log('FAIL', name); throw e; } };

const dir = { QUAKE_FEED: { sensitive: 0 }, WIKIPEDIA_SUMMARY: { sensitive: 0 }, CLAUDE_WEB: { sensitive: 0 }, STRIPE_REFUND_CREATE: { sensitive: 1 }, X_POST: { sensitive: 0 }, GONE: undefined, OFF: { sensitive: 0, enabled: 0 } };

test('the first step input becomes $1 and a later step that consumed the previous output becomes $PREV', () => {
  const out = 'M 4.8 - 10 km SW of Ridgecrest, CA';
  const c = compileSteps([
    { key: 'QUAKE_FEED', input: 'ridgecrest', output: out },
    { key: 'CLAUDE_WEB', input: out, output: 'reviewed' },
  ], { dir });
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(c.dsl, 'QUAKE_FEED: $1+\n> CLAUDE_WEB: $PREV');
  assert.equal(c.bindings === undefined, true);
  assert.deepEqual(c.notes.map((x) => x.binding), ['argument', 'previous_output']);
  assert.equal(c.auto_enable, true);
});
test('a literal that embeds the argument and the previous output is rewritten, and a pure constant stays a constant', () => {
  const out = 'a long enough previous output to be recognised';
  const c = compileSteps([
    { key: 'WIKIPEDIA_SUMMARY', input: 'Turnstile', output: out },
    { key: 'CLAUDE_WEB', input: `Critique this summary of Turnstile: ${out}`, output: 'ok' },
    { key: 'QUAKE_FEED', input: 'M4', output: 'x' },
  ], { dir });
  assert.equal(c.ok, true, JSON.stringify(c));
  assert.equal(c.dsl.split('\n> ')[1], 'CLAUDE_WEB: Critique this summary of $1+: $PREV');
  assert.equal(c.notes[2].binding, 'constant');
});
test('a sensitive step compiles but leaves the proposal disabled (risk high)', () => {
  const c = compileSteps([{ key: 'QUAKE_FEED', input: 'a', output: 'b' }, { key: 'STRIPE_REFUND_CREATE', input: 'cus_1', output: 'ok' }], { dir });
  assert.equal(c.ok, true); assert.equal(c.risk, 'high'); assert.equal(c.auto_enable, false);
});
test('a side-effecting step name leaves the proposal disabled even when the row is not marked sensitive', () => {
  const c = compileSteps([{ key: 'QUAKE_FEED', input: 'a', output: 'b' }, { key: 'X_POST', input: 'b', output: 'posted' }], { dir });
  assert.equal(c.ok, true); assert.deepEqual(c.side_effecting, ['X_POST']); assert.equal(c.auto_enable, false);
});
test('a capability that no longer exists cannot be compiled', () => {
  const c = compileSteps([{ key: 'QUAKE_FEED', input: 'a', output: 'b' }, { key: 'GONE', input: 'b', output: 'c' }], { dir });
  assert.equal(c.ok, false); assert.equal(c.error, 'UNKNOWN_CAPABILITY');
});
test('a disabled capability cannot be compiled', () => {
  const c = compileSteps([{ key: 'QUAKE_FEED', input: 'a', output: 'b' }, { key: 'OFF', input: 'b', output: 'c' }], { dir });
  assert.equal(c.error, 'CAPABILITY_DISABLED');
});
test('too few real steps is refused; meta rows do not count', () => {
  const c = compileSteps([{ key: 'D1_QUERY', input: 'select 1', output: '1' }, { key: 'QUAKE_FEED', input: 'a', output: 'b' }], { dir });
  assert.equal(c.error, 'TOO_FEW_STEPS');
});
test('a balanced JSON literal is a safe constant wherever it sits in the body', () => {
  const ok = compileSteps([{ key: 'QUAKE_FEED', input: 'a', output: 'b' }, { key: 'WIKIPEDIA_SUMMARY', input: 'title={"q":"x|y","n":[1,2]}', output: 'c' }], { dir });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const braceFirst = compileSteps([{ key: 'QUAKE_FEED', input: 'a', output: 'b' }, { key: 'WIKIPEDIA_SUMMARY', input: '{"q":"x"}', output: 'c' }], { dir });
  assert.equal(braceFirst.ok, true, 'a body beginning with { never begins the step part');
  const empty = compileSteps([{ key: 'QUAKE_FEED', input: 'a', output: 'b' }, { key: 'WIKIPEDIA_SUMMARY', input: '{}', output: 'c' }], { dir });
  assert.equal(empty.ok, true);
  const unbalanced = compileSteps([{ key: 'QUAKE_FEED', input: 'a', output: 'b' }, { key: 'WIKIPEDIA_SUMMARY', input: 'x {y', output: 'c' }], { dir });
  assert.equal(unbalanced.error, 'UNSAFE_LITERAL');
});
test('a constant carrying a flow delimiter is refused rather than written into the DSL broken', () => {
  const c = compileSteps([{ key: 'QUAKE_FEED', input: 'a', output: 'b' }, { key: 'WIKIPEDIA_SUMMARY', input: 'x > y', output: 'c' }], { dir });
  assert.equal(c.error, 'UNSAFE_LITERAL');
});
test('names become keys or nothing', () => {
  assert.equal(slugKey('customer lookup'), 'CUSTOMER_LOOKUP'); assert.equal(slugKey('9lives'), null); assert.equal(slugKey(''), null);
});
test('the body grammar is name|source|json-options', () => {
  const b = parseLearnBody('QUAKE_REVIEW|t_abc123|{"replay":true,"arg":"ridgecrest"}');
  assert.equal(b.name, 'QUAKE_REVIEW'); assert.equal(b.source, 't_abc123'); assert.equal(b.replay, true); assert.equal(b.arg, 'ridgecrest');
});
test('a step that triggers or delivers is side-effecting even when the row is not marked sensitive', () => {
  const c = compileSteps([{ key: 'DELIVER_PENDING_ASSETS', input: 'a', output: 'b' }, { key: 'SIBLING_WORKFLOW_DELIVER_TRIGGER', input: 'b', output: 'c' }], { dir: { DELIVER_PENDING_ASSETS: { sensitive: 0 }, SIBLING_WORKFLOW_DELIVER_TRIGGER: { sensitive: 0 } } });
  assert.equal(c.ok, true); assert.deepEqual(c.side_effecting, ['DELIVER_PENDING_ASSETS', 'SIBLING_WORKFLOW_DELIVER_TRIGGER']); assert.equal(c.auto_enable, false);
});
console.log(`\n${n} assertions passed`);
