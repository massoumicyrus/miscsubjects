const BASE = 'https://miscsubjects.com';

const ref = (name) => ({ $ref: '#/components/schemas/' + name });

function operation(operationId, summary, schema, security = []) {
  return {
    operationId,
    summary,
    requestBody: {
      required: true,
      content: { 'application/json': { schema } },
    },
    responses: {
      200: { description: 'Operation result with public link or receipt', content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } } },
      400: { description: 'The response explains the missing or stale field and how to retry' },
      401: { description: 'Token missing, expired, or outside its server-enforced scope' },
      409: { description: 'Thread head or content hash moved; re-read and retry once' },
    },
    ...(security.length ? { security } : {}),
  };
}

export function schema() {
  const bearer = [{ scopedToken: [] }];
  return {
    openapi: '3.1.0',
    info: {
      title: 'miscsubjects additive editor',
      version: '1.0.0',
      description: 'OpenAI Action lane for web ChatGPT. Use these operations instead of code-interpreter Bash or curl.',
    },
    servers: [{ url: BASE }],
    paths: {
      '/api/articles/{slug}/voxels': {
        get: { operationId: 'readVoxels', summary: 'Read article position, DIVs, hashes, and chains', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Article machine side' } } },
      },
      '/api/articles/{slug}/discourse': {
        get: { operationId: 'readDiscourse', summary: 'Read current thread head and all discourse', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Discourse index' } } },
      },
      '/api/protocol/voxel-challenge': { post: operation('voxelChallenge', 'Add one challenge, support, or upgrade', ref('Challenge')) },
      '/api/protocol/voxel-attest': { post: operation('voxelAttest', 'Close a read with one of four outcomes', ref('Attest')) },
      '/api/protocol/voxel-batch': { post: operation('voxelBatch', 'Land a whole document or up to 300 typed operations', ref('Batch'), bearer) },
      '/api/protocol/voxel-edit': { post: operation('voxelEdit', 'CAS-edit one current DIV or claim', ref('Edit'), bearer) },
      '/api/protocol/voxel-move': { post: operation('voxelMove', 'CAS-move one current body DIV', ref('Move'), bearer) },
      '/api/protocol/voxel-consolidate': { post: operation('voxelConsolidate', 'CAS-consolidate current DIVs without deleting their identities', ref('Consolidate'), bearer) },
      '/api/protocol/voxel-vote': { post: operation('voxelVote', 'Propose a structural change for later ratification', ref('Vote')) },
      '/start': {
        get: { operationId: 'rootDrop', summary: 'Mint your own bounded credential; returns every next step as a complete pre-filled URL', responses: { 200: { description: 'Credential + ready-to-fetch action chain' } } },
      },
      '/api/proven-work/{slug}/inspect': {
        get: { operationId: 'inspectProvenWork', summary: 'One-step receipted inspection: mints your delegation, returns the manifest and YOUR inspection receipt', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Manifest, inspection receipt, ready certify URL' } } },
      },
      '/api/proven-work/{slug}/certify': {
        get: { operationId: 'certifyProvenWorkGet', summary: 'Sign your verdict onto the object ledger (browser-safe GET form)', parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'verdict', in: 'query', required: true, schema: { type: 'string', enum: ['SUPPORTED_BY_RECORD', 'MISSING_EVIDENCE', 'CONTRADICTED_BY_RECORD', 'PROVED', 'DISPROVED', 'CONTESTED', 'QUESTION', 'OBJECTION', 'INCONCLUSIVE'] } },
          { name: 'model', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'grounds', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'inspection_receipt', in: 'query', required: true, schema: { type: 'string' } },
        ], responses: { 200: { description: 'Signed certification, appended to the object' } } },
      },
      '/api/proven-work/{slug}/drop': {
        get: { operationId: 'holdProvenWorkToken', summary: 'Hold a scoped 7-day token for unlimited receipted reads of this object (GET form)', parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Scoped token + fingerprint' } } },
      },
      '/api/workspace/{slug}/enter': {
        get: { operationId: 'enterWorkspace', summary: 'Enter a live shared workspace under a public role; returns your live credential and grant', parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'role', in: 'query', required: false, schema: { type: 'string' } },
          { name: 'actor', in: 'query', required: false, schema: { type: 'string' } },
        ], responses: { 200: { description: 'Live pool credential' } } },
      },
      '/receipt/{id}': {
        get: { operationId: 'openReceipt', summary: 'Resolve any invocation receipt on the public ledger', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'The receipt' } } },
      },
    },
    components: {
      securitySchemes: { scopedToken: { type: 'http', scheme: 'bearer', bearerFormat: 'miscsubjects scoped capability' } },
      schemas: {
        Challenge: { type: 'object', required: ['slug', 'expected_thread_head', 'stance', 'body', 'actor'], properties: { slug: { type: 'string' }, expected_thread_head: { type: 'string' }, target_div: { type: 'string' }, expected_hash: { type: 'string' }, stance: { enum: ['challenge', 'support', 'upgrade'] }, body: { type: 'string' }, actor: { type: 'string' } } },
        Attest: { type: 'object', required: ['slug', 'outcome', 'content_hash', 'actor'], properties: { slug: { type: 'string' }, outcome: { enum: ['novel_objection', 'duplicate_confirm', 'upgrade_proposal', 'nothing_to_add'] }, content_hash: { type: 'string' }, actor: { type: 'string' } } },
        Batch: { type: 'object', required: ['actor'], properties: { document: { type: 'object', properties: { slug: { type: 'string' }, title: { type: 'string' }, markdown: { type: 'string' } } }, operations: { type: 'array', maxItems: 300, items: { type: 'object', additionalProperties: true } }, actor: { type: 'string' }, key: { type: 'string', description: 'Optional when Authorization bearer is configured' } }, anyOf: [{ required: ['document'] }, { required: ['operations'] }] },
        Edit: { type: 'object', required: ['slug', 'div_id', 'expected_hash', 'text'], properties: { slug: { type: 'string' }, div_id: { type: 'string' }, expected_hash: { type: 'string' }, text: { type: 'string' }, actor: { type: 'string' }, key: { type: 'string' } } },
        Move: { type: 'object', required: ['slug', 'div_id', 'expected_order', 'direction'], properties: { slug: { type: 'string' }, div_id: { type: 'string' }, expected_order: { type: 'integer' }, direction: { type: 'string' }, actor: { type: 'string' }, key: { type: 'string' } } },
        Consolidate: { type: 'object', required: ['slug', 'div_ids', 'expected_hashes'], properties: { slug: { type: 'string' }, div_ids: { type: 'array', items: { type: 'string' } }, expected_hashes: { type: 'array', items: { type: 'string' } }, text: { type: 'string' }, actor: { type: 'string' }, key: { type: 'string' } } },
        Vote: { type: 'object', required: ['slug', 'proposal', 'rationale', 'actor'], properties: { slug: { type: 'string' }, target: { type: 'string' }, proposal: { enum: ['should_be_div', 'should_be_article', 'should_merge', 'should_split', 'should_burn', 'should_transclude', 'should_retier'] }, rationale: { type: 'string' }, actor: { type: 'string' } } },
      },
    },
  };
}

export function onRequestGet() {
  return Response.json(schema(), { headers: { 'cache-control': 'public, max-age=300', 'access-control-allow-origin': '*' } });
}

