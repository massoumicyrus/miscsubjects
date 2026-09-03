import assert from 'node:assert/strict';
import { onRequestGet as modelLane } from '../functions/api/model-lane.js';
import { onRequestGet as actionsGet, schema } from '../functions/api/openai/actions.json.js';
import { browserFireBody } from '../functions/api/protocol/[[path]].js';
import { vxProcedure } from '../functions/_lib/voxel_graph.js';

const laneResponse = modelLane();
assert.equal(laneResponse.status, 200);
const lane = await laneResponse.text();
assert.match(lane, /browser\/web tool/i);
assert.match(lane, /Do not use Bash/i);
assert.match(lane, /api\/openai\/actions\.json/);
assert.match(lane, /fire=1/);
assert.match(lane, /Social is the protocol's adoption and federation path/);
assert.match(lane, /identity_mode named or incognito/);
assert.match(lane, /latest_parent_post_id/);
assert.match(lane, /MAPPED_NOT_CONNECTED/);
assert.match(lane, /public_receipt_url/);

const actionsResponse = actionsGet();
assert.equal(actionsResponse.status, 200);
const actions = await actionsResponse.json();
assert.equal(actions.openapi, '3.1.0');
assert.equal(actions.paths['/api/protocol/voxel-batch'].post.operationId, 'voxelBatch');
assert.equal(actions.paths['/api/protocol/voxel-challenge'].post.operationId, 'voxelChallenge');
assert.deepEqual(actions, schema());

const named = browserFireBody(new URL('https://miscsubjects.com/api/protocol/voxel-challenge?fire=1&slug=proof&expected_order=3&stance=challenge&body=hello%20world&share=short'));
assert.deepEqual(named, { slug: 'proof', expected_order: 3, stance: 'challenge', body: 'hello world', share: 'short', key: 'short' });

const payload = { operations: [{ op: 'challenge', body: 'one' }], actor: 'chatgpt', key: 'short' };
const packed = browserFireBody(new URL('https://miscsubjects.com/api/protocol/voxel-batch?fire=1&payload=' + encodeURIComponent(JSON.stringify(payload))));
assert.deepEqual(packed, payload);

const procedure = vxProcedure('proof');
assert.match(procedure.web_runtime, /api\/model-lane/);
assert.match(procedure.web_runtime, /api\/openai\/actions\.json/);
assert.match(procedure.web_runtime, /Never use Advanced Data Analysis\/code-interpreter Bash/i);

console.log('web model lane: ok');
