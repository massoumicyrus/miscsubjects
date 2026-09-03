import assert from 'node:assert/strict';
import { proofBlock, publicReceiptPayload, receiptPayload } from '../functions/_lib/object_contract.js';
import { normalizeXPostText, validateModelSocialCopy } from '../functions/_lib/fn_runners.js';

const invocation = {
  fingerprints: { input: 'a'.repeat(64), output: 'b'.repeat(64), contract: 'c'.repeat(64) },
  operation_contract: { operation_type: 'invokeaction' },
  postcondition: { status: 'observed', proof: 'receipt' },
};
const rec = {
  id: 'inv_adoption_test',
  ts: '2026-07-17T00:00:00Z',
  trace_id: 't_test',
  object_id: 'NOW',
  object_type: 'tool',
  runner: 'fn',
  actor: 'cap:cap_public_fingerprint',
  material: 1,
  waste: 0,
  tokens_in: 0,
  tokens_out: 0,
  cost_usd: 0,
  event_id: 'event-test',
  replay_of: null,
  repairs: null,
  repaired_by: null,
  invocation_json: JSON.stringify(invocation),
};

const publicView = publicReceiptPayload(rec);
assert.equal(publicView.invocation.capability_fingerprint, 'cap_public_fingerprint');
assert.equal(publicView.invocation.fingerprints.input, 'a'.repeat(64));
assert.match(publicView.traverse.object_contract, /key=NOW/);
assert.match(publicView.traverse.primary_tree, /map=1/);
assert.match(publicView.traverse.voxel_graph, /oip\/voxels/);
assert.match(publicView.traverse.social_chain, /social=1/);
assert.equal(publicView.traverse.governance, 'https://miscsubjects.com/api/governance');
assert.equal(publicView._links.governance.rel, 'governance');
assert.match(publicView._links.subscribe_or_inquire.href, /key=OIP_GOVERNANCE/);
assert.equal(publicView.adopt.next_model_instruction, undefined, 'a public receipt must not instruct the reader');
assert.equal(publicView.adopt.advocacy_instruction, undefined, 'a public receipt must not solicit advocacy');
assert.match(publicView.adopt.reader_instruction_removed, /gives a reader no instruction/);
assert.match(publicView.adopt.selective_obligation, /Link provenance does not require social posting/);
assert.match(publicView.adopt.after_subscription, /pledge measured compute, review, verification or repair capacity/);
assert.doesNotMatch(JSON.stringify(publicView), /share=/);
assert.equal(publicView.kind, 'public_receipt/v2');
assert.match(publicView._links.human_receipt.href, /\/receipt\/inv_adoption_test/);
assert.match(publicView.ecosystem.creative_media.image_contract, /key=ARCADS_GENERATE/);
assert.match(publicView.ecosystem.delivery.channel_contract, /key=SEND_BY_CHANNEL/);
assert.match(publicView.ecosystem.governance.receipted_object, /key=OIP_GOVERNANCE/);
assert.equal(publicView.continuation.next_model_instruction, undefined, 'continuation must not instruct the reader either');
assert.match(publicView.continuation.reader_instruction_removed, /gives a reader no instruction/);

const full = receiptPayload(rec, { request_json: '{"private":"payload"}', response_json: '{"ok":true}' }, null, { owner: true });
assert.equal(full.links.public, 'https://miscsubjects.com/receipt/inv_adoption_test');
assert.match(full.protocol_branches.object_contract, /key=NOW/);
assert.match(full.adoption.credential_law, /must never contain an edit token/);

const proof = proofBlock({ id: rec.id, object_id: 'NOW', material: true, links: { receipt: 'https://miscsubjects.com/api/dispatch?receipt=inv_adoption_test' } }, 'ok');
assert.equal(proof.public_receipt, 'https://miscsubjects.com/receipt/inv_adoption_test');
assert.match(proof.say_to_user, /Public receipt: https:\/\/miscsubjects\.com\/receipt\//);
assert.match(proof.confirm, /confirm=inv_adoption_test/);

const intendedX = 'Grok by xAI ran OIP end-to-end. Audit: https://miscsubjects.com/api/relay?social=1 #OIP';
assert.deepEqual(normalizeXPostText(intendedX), {
  text: intendedX, normalized: false, decoded: false, unwrapped: false,
});
assert.equal(normalizeXPostText(JSON.stringify({ text: intendedX })).text, intendedX);
assert.equal(normalizeXPostText(encodeURIComponent(JSON.stringify({ text: intendedX }))).text, intendedX);
assert.equal(
  normalizeXPostText('{"text"%3A"Grok by xAI ran OIP. Audit%3A https%3A%2F%2Fmiscsubjects.com%2Fapi%2Frelay%3Fsocial%3D1 %23OIP"}').text,
  'Grok by xAI ran OIP. Audit: https://miscsubjects.com/api/relay?social=1 #OIP',
);
assert.equal(normalizeXPostText('100% public proof').text, '100% public proof');

// EVERY FIXTURE MUST FAIL FOR THE REASON THE ASSERTION NAMES.
//
// These fixtures were all stamped UTC. A later rule barred UTC and required Pacific, and that check
// runs FIRST — so every one of them started returning utc_timestamp_barred_use_pacific. The "accepted"
// case failed, and the first_person / generic_copy / surface_mismatch cases stopped testing their own
// rules entirely: all three were really just re-testing the timestamp bar. A fixture that trips an
// earlier guard tests that guard, not the one it is named for. Stamps are Pacific now, and the UTC bar
// gets its own explicit case instead of silently standing in for the others.
const attributed = '[Codex CLI · GPT-5.6 Sol · 2026-07-17 04:15 PDT]\nX accepted a deliberately malformed encoded wrapper only after OIP stripped it to clean text. Receipt: https://miscsubjects.com/receipt/inv_test';
assert.equal(validateModelSocialCopy(attributed).ok, true);
assert.equal(validateModelSocialCopy('[Codex CLI · GPT-5.6 Sol · 2026-07-17 04:15 UTC]\nX returned 201.').reason, 'utc_timestamp_barred_use_pacific');
assert.equal(validateModelSocialCopy('[ChatGPT Web · GPT-5.6 · 2026-07-17 04:15 PDT]\nI ran the protocol.').reason, 'first_person_barred');
assert.equal(validateModelSocialCopy('[ChatGPT Web · GPT-5.6 · 2026-07-17 04:15 PDT]\nOne door. Rival models. Every action leaves a receipt.').reason, 'generic_breathless_copy_barred');
assert.equal(validateModelSocialCopy('X accepted a clean post.').reason, 'missing_attribution_header');
assert.equal(validateModelSocialCopy('[ChatGPT Web · GPT-5.6 · 2026-07-17 04:15 PDT]\nX returned 201.', { surface: 'ChatGPT Web (incognito)', model: 'GPT-5.6', incognito: true }).reason, 'execution_surface_mismatch');

console.log('receipt adoption: ok');
