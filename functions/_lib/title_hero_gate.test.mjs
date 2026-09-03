import test from 'node:test';
import assert from 'node:assert/strict';

const gate = await import('./title_hero_gate.js');

test('a cold-reader headline passes when it names the event and consequence in plain words', () => {
  assert.equal(
    gate.checkTitle('Banks close millions of money-laundering alerts with one sentence; examiners reopen them'),
    null,
  );
  assert.equal(
    gate.checkTitle('AI-native content: a seven-part test for pages built for models'),
    null,
  );
  assert.match(
    gate.checkTitle('AI-native content, defined and measured: a seven-axis rubric scoring llms.txt, MCP, nanopublications, Wikipedia and this site'),
    /overloaded|shorten/i,
  );
});

test('a headline that needs the surrounding conversation is rejected', () => {
  assert.match(gate.checkTitle('What taking this seriously would mean'), /context|subject/i);
});

test('a story-specific literal editorial image without rendered text passes', () => {
  assert.equal(
    gate.checkHeroBrief('A chest X-ray with one small pulmonary nodule circled by a fading follow-up marker; editorial medical illustration, no readable text, no people'),
    null,
  );
  assert.equal(
    gate.checkHeroBrief('A warm, believable editorial scene of a physical card-catalog drawer merging into real server and network infrastructure; one coherent composition, tangible objects, no readable text, no UI collage'),
    null,
  );
});

test('rendered tables and generic AI art are rejected with the precise issue', () => {
  assert.match(
    gate.checkHeroBrief('A dark dashboard table with rows, columns, labels and model scores'),
    /rendered text|table|dashboard/i,
  );
  assert.match(
    gate.checkHeroBrief('A glowing robot brain made of circuits and generic neural-network nodes'),
    /generic AI/i,
  );
});

test('editorial preflight requires a story rationale before generation and visual inspection before publication', () => {
  assert.equal(typeof gate.editorialPreflight, 'function');

  const proposal = gate.editorialPreflight({
    stage: 'proposal',
    title: 'The scan flagged a pulmonary nodule; the recommended follow-up never happened',
    hero_brief: 'A chest X-ray with one small pulmonary nodule circled by a fading follow-up marker; editorial medical illustration, no readable text, no people',
    editorial_review: {
      headline_subject: 'a missed radiology follow-up',
      hero_subject: 'the chest scan where the missed finding began',
      visual_action: 'the scan itself fills the frame and the nodule remains visibly present',
      rationale: 'The image begins with the actual scan and turns the missing follow-up into the one visual action, so it belongs to this story and not a generic AI article.',
    },
  });
  assert.equal(proposal.ok, true, JSON.stringify(proposal));

  const publish = gate.editorialPreflight({ ...proposal.input, stage: 'publish' });
  assert.equal(publish.ok, false);
  assert.ok(publish.issues.some((x) => x.code === 'hero_not_inspected'));
});

test('continuous audit flags existing unreviewed heroes and filing-label headings', () => {
  assert.equal(typeof gate.auditEditorialArticle, 'function');
  const result = gate.auditEditorialArticle({
    slug: 'example',
    title: 'What this means',
    body: '## Overview\n\nThe article body.',
    hero: 'https://miscsubjects.com/img/gen/example.png',
  });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((x) => x.code === 'headline_context'));
  assert.ok(result.issues.some((x) => x.code === 'heading_filing_label'));
  assert.ok(result.issues.some((x) => x.code === 'hero_review_missing'));
  assert.ok(result.issues.every((x) => x.message && (x.replacement || x.review)));
});
