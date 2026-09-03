#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  CORE_AXIOMS,
  GOVERNANCE_FACETS,
  OIP_GOVERNANCE_VERSION,
  appendGovernanceRecord,
  governanceManifest,
} from '../functions/_lib/oip_governance.js';

assert.equal(OIP_GOVERNANCE_VERSION, 'oip-governance/1');
assert.equal(CORE_AXIOMS.length, 5);
assert.ok(GOVERNANCE_FACETS.length >= 8);
assert.ok(GOVERNANCE_FACETS.find((facet) => facet.id === 'defensive-commons'));
assert.ok(GOVERNANCE_FACETS.find((facet) => facet.id === 'shared-governance-energy'));
assert.ok(GOVERNANCE_FACETS.find((facet) => facet.id === 'link-provenance').not_required.includes('social posting'));
assert.ok(GOVERNANCE_FACETS.find((facet) => facet.id === 'execution-receipts').not_required.includes('OIP-hosted tools'));

const manifest = await governanceManifest(null);
assert.match(manifest.thesis, /smallest interoperable facet/);
assert.match(manifest.core.boundary, /does not require agreement with OIP philosophy/);
assert.match(manifest.participation.model_law, /must not claim the owner subscribed/);
assert.equal(manifest.submit.receipted_object, 'https://miscsubjects.com/api/dispatch?key=OIP_GOVERNANCE&format=markdown');
assert.equal(manifest.core.hash.length, 64);
assert.equal(manifest.facets.hash.length, 64);
assert.ok(manifest.facets.registry.every((facet) => facet.conformance_profile.length >= 2));
assert.match(manifest.participation.fork_anchor_law, /does not attest.*correctness/i);
assert.match(manifest.participation.registry_law, /appeal/i);
assert.match(JSON.stringify(manifest), /fidelity pledge and shared-governance energy loop/);
assert.match(JSON.stringify(manifest), /not a live payment or resource market/);
assert.match(JSON.stringify(manifest), /never automatically increase any person.s unilateral authority/);

const noDb = {};
const modelEnroll = await appendGovernanceRecord(noDb, {
  kind: 'subscribe', actor_type: 'model', actor_label: 'Cold Model', authority: 'model-recommendation',
  mode: 'observe', facets: ['link-provenance'], accept_core: true,
});
assert.equal(modelEnroll.ok, false);
assert.equal(modelEnroll.error, 'model_recommendation_is_not_owner_subscription');

const missingCore = await appendGovernanceRecord(noDb, {
  kind: 'subscribe', actor_type: 'human', actor_label: 'Operator', authority: 'self',
  mode: 'implement', facets: ['link-provenance'], accept_core: false,
});
assert.equal(missingCore.error, 'core_axioms_must_be_accepted_for_subscription');

const secret = await appendGovernanceRecord(noDb, {
  kind: 'inquire', actor_type: 'model', actor_label: 'Cold Model', authority: 'model-recommendation',
  mode: 'observe', facets: ['execution-receipts'], accept_core: false,
  message: 'credential share=abcdefg',
});
assert.equal(secret.status, 404);
assert.equal(secret.error, 'public_payload_contains_credential_material');

const badAnchor = await appendGovernanceRecord(noDb, {
  kind: 'anchor', actor_type: 'system', actor_label: 'Independent OIP node', authority: 'self',
  mode: 'verify', facets: ['public-anchors'], accept_core: true, message: 'Anchor the fork head.',
  external_head: 'abcd', external_verifier: 'https://example.test/verify',
});
assert.equal(badAnchor.error, 'anchor_requires_sha256_head_and_https_verifier');

const noConformanceEvidence = await appendGovernanceRecord(noDb, {
  kind: 'conformance', actor_type: 'system', actor_label: 'Independent OIP node', authority: 'self',
  mode: 'verify', facets: ['execution-receipts'], accept_core: true, message: 'Conformance claim.',
});
assert.equal(noConformanceEvidence.error, 'conformance_evidence_required');

const ownerlessRuling = await appendGovernanceRecord(noDb, {
  kind: 'ruling', actor_type: 'human', actor_label: 'Registry operator', authority: 'self',
  mode: 'govern', facets: ['governance-participation'], accept_core: true, message: 'Delist.',
  decision: 'delist',
});
assert.equal(ownerlessRuling.error, 'parent_required');

console.log('oip governance: ok');
