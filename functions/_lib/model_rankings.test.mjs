import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MODEL_RANKINGS, oceScore, modelRankingsFooter } from './model_rankings.js';

// The rankings block used to print bare three-digit scores with no published formula.
// These tests pin the honesty repair: the scores are computed from the recorded inputs,
// they reproduce the previously published figures exactly, and the rendered block carries
// the formula and each row's arithmetic — generated from the same code, always visible.

test('computed scores reproduce the published figures from the recorded inputs', () => {
  const expected = {
    'MiMo-V2.5-Pro': 1119,
    'DeepSeek V4 Pro': 673,
    'MiniMax M3': 261,
    'GPT-5.6 Terra': 77,
    'GLM 5.2': 66,
    'GPT-5.6 Sol': 51,
    'Qwen3.7 Max': 34,
    'Claude Fable 5': 12,
  };
  for (const row of MODEL_RANKINGS.inputs) {
    assert.equal(oceScore(row), expected[row.name], row.name);
  }
});

test('the rendered block publishes the formula beside the leaderboard, not in a tooltip', () => {
  const html = modelRankingsFooter();
  assert.match(html, /score = \(intelligence index &times; obedience\) &divide; measured cost per task/);
  assert.match(html, /read 4 August 2026 from Artificial Analysis/);
  assert.match(html, /Ai2 IFBench/);
  assert.doesNotMatch(html, /title=/, 'the disclosure is visible text, never a tooltip');
  // Every row shows its own arithmetic, generated from the inputs that computed the score.
  assert.match(html, /1\. MiMo-V2\.5-Pro <code>1,119<\/code> = \(42 &times; 79\.9%\) &divide; \$0\.03/);
  assert.match(html, /8\. Claude Fable 5 <code>12<\/code> = \(60 &times; 63\.5%\) &divide; \$3\.15/);
});

test('every design-system consumer uses the one shared footer composition', () => {
  const design = readFileSync(new URL('./design_system.js', import.meta.url), 'utf8');
  const nav = readFileSync(new URL('./design/compositions/navigation-hub.js', import.meta.url), 'utf8');
  assert.match(design, /export\s*\{\s*footer as designSystemFooter\s*\}/);
  assert.match(nav, /import\s*\{\s*modelRankingsFooter\s*\}/);
  assert.equal((nav.match(/<footer class="ds-foot">/g) || []).length, 1);
  assert.doesNotMatch(design, /<footer class="ds-foot">/, 'design_system must not keep a second footer copy');
});
