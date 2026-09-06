function absolute(origin, path) {
  return String(path || '').startsWith('http') ? String(path) : origin + String(path || '');
}

function groupedCounts(catalog) {
  const counts = {};
  for (const object of catalog || []) counts[object.kind] = (counts[object.kind] || 0) + 1;
  return counts;
}

function declaredOperations(catalog) {
  return (catalog || [])
    .filter((object) => Array.isArray(object.operations) && object.operations.some((op) => op && op.href && op.method))
    .map((object) => ({ ...object, operations: object.operations.filter((op) => op && op.href && op.method) }))
    .sort((a, b) => (a.kind === 'environment' ? -1 : b.kind === 'environment' ? 1 : 0) || (a.kind === 'store' || a.kind === 'ledger' ? -1 : 0) - (b.kind === 'store' || b.kind === 'ledger' ? -1 : 0) || a.ref.localeCompare(b.ref));
}

export function environmentManualMarkdown(catalog, { origin = 'https://miscsubjects.com' } = {}) {
  const counts = groupedCounts(catalog);
  const lines = [
    '# miscsubjects environment',
    '',
    'This is the canonical manual for the live environment. It is generated from the same directory descriptors used by the runtime. Do not infer an operation from a page label or from model memory; resolve the object and use the operation it declares.',
    '',
    '## Sources of truth',
    '',
    'Directory = nouns. Ledger = verbs. Everything else = views.',
    '',
    '- **Directory = current state (nouns).** Every object the environment has is one directory row: agents, tools, pages, laws, prompts, models, sheets, sources, external systems. Objects, schemas, operations, source references, relationships, governance attachments, comparables, and representations live there. Canonical ref: `directory://catalog`.',
    '- **Ledger = history and execution evidence (verbs).** Every action ever taken is one append-only row: requests, raw responses, parsed results, errors, effects, costs, revisions, and failures. Canonical ref: `ledger://events`.',
    '- **Everything else is a view.** Human pages, Sheets, OpenAPI, MCP resources, maps, and this document are projections of those two. They do not own a second copy of the contract; a sheet re-reads its source on every open and an edit made through it lands on the object itself.',
    '',
    '## Canonical references',
    '',
    '```text',
    'environment://miscsubjects',
    'page://admin/sheets',
    'route://GET/api/sheets/{id}',
    'directory://ROUTER',
    'prompt://ROUTER/system',
    'model://xai/grok-4.3',
    'sheet://<sheet-id>/<tab>/<range>',
    'source://functions/_lib/object_contract.js',
    'law://design/D08',
    'skill://coding-law',
    'store://DB/articles',
    'ledger://invocation/<id>',
    'external://google/apps-script',
    '```',
    '',
    'A reference identifies an object. It never contains a credential. Authority is supplied separately.',
    '',
    '## Discovery',
    '',
    '- List or search objects: `' + absolute(origin, '/api/environment/objects') + '?kind=<kind>&q=<words>`',
    '- Describe one object: `' + absolute(origin, '/api/environment/objects') + '?ref=<canonical-ref>`',
    '- Resolve its effective rules: `' + absolute(origin, '/api/environment/governance') + '?ref=<canonical-ref>`',
    '- Explain its comparables: `' + absolute(origin, '/api/environment/comparables') + '?ref=<canonical-ref>&dimension=<dimension>`',
    '- HTTP schema projection: `' + absolute(origin, '/api/environment/openapi.json') + '`',
    '- Descriptor JSON Schema: `' + absolute(origin, '/api/environment/schema.json') + '`',
    '',
    'Every object response uses the same fields: `ref`, `kind`, `parent_ref`, `source`, `schema`, `operations`, `relationships`, `governance`, `comparables`, `representations`, `revision`, and `hash`.',
    '',
    '## Authority',
    '',
    'Reading this manual, the object catalog, governance, comparables, the public directory list and one directory row needs no credential. Every operation marked `owner` needs the build authority, presented one of these ways: header `authorization: Bearer <build key>` (sheets, dispatch), header `x-terminal-key: <build key>` (every /api route), or an admin session cookie. The key itself is never in this document, never in a ref, and never in a URL you hand to someone else. If an operation answers 401, report the denial; do not look for another door.',
    '',
    '## How to act',
    '',
    '1. Resolve the target by canonical reference. If it is missing, search; never guess another object.',
    '2. Choose only an operation listed in `operations`.',
    '3. Use its exact method, URL, input schema, authority, preconditions, effects, and concurrency field.',
    '4. If authority is denied, report the denial. Never broaden authority or move credentials into a reference.',
    '5. After execution, follow the returned ledger or receipt reference. The receipt, not HTTP status alone, establishes what happened.',
    '',
    '## Governance',
    '',
    '`direct` rules are attached to the target. `inherited` rules arrive through explicit `part_of` or `inherits_rules_from` paths. `overridden` rules remain visible with the object and reason that displaced them. `effective` is the resolved set. Every effective rule names its immutable revision/hash and `applies_because` path. `unresolved` and `conflicts` are defects; do not silently choose an answer.',
    '',
    '## Comparables',
    '',
    'A comparable is valid only when it names dimensions, basis, similarities, material differences, sources, verification time, and evidence status. Semantic comparables are not performance claims. Executed A/B results remain separate `CMP-*` objects.',
    '',
    '## Sheets: a new view over any objects, with no new code',
    '',
    'Cells remain arbitrary text, JSON, formulas, or source. A sheet may project any directory field or ledger field by column name and JSON path. A projection keeps the underlying object reference; it is not a copied source of truth. Recalculation, sorting, and filtering never invoke a tool or model.',
    '',
    'To give someone a sheet that shows and edits a chosen set of objects:',
    '',
    '1. Read what a view may project: `GET ' + absolute(origin, '/api/sheets/view-sources') + '` (sources `directory`, `ledger`, `directory_versions`, `agent_turns`, …; each with its columns and JSON columns).',
    '2. Create the view sheet: `POST ' + absolute(origin, '/api/sheets') + '` with `{"title":"Agents","view":{"source":"directory","filters":[{"field":"type","op":"=","value":"agent"}],"columns":["key","content","descriptor_json.governance.direct","updated_at"]},"pins":[{"label":"ROUTER prompt","ref":"directory/ROUTER/content"}]}`. The response carries `sheet.id` and `open`, the link to hand out: `' + absolute(origin, '/admin/sheets?tab=<id>') + '`.',
    '3. Read it as data: `GET ' + absolute(origin, '/api/sheets/<id>/view') + '` returns the columns, the rows, and for every row the object id and its href, so a model can name exactly which object a cell belongs to.',
    '4. Edit through it: a pinned field writes the object itself with `POST ' + absolute(origin, '/api/sheets/<id>/pins') + '` `{"ref":"directory/<KEY>/content","value":"…"}`; a full object edit is `PATCH ' + absolute(origin, '/api/directory/<KEY>') + '` with `expected_descriptor_rev`; a new object is `POST ' + absolute(origin, '/api/directory') + '`; removal is `DELETE ' + absolute(origin, '/api/directory/<KEY>') + '`. The ledger is append-only, so a ledger view is read-only by construction.',
    '5. Its webhook address: `POST ' + absolute(origin, '/api/sheets/<id>/values:append') + '` `{"values":[["col a","col b"]]}` appends a row to any stored sheet. Any system that can send JSON with the build authority header can point at it. Every append is one ledger row (`SHEET_VALUES_APPEND`).',
    '6. Change what it shows later: `PATCH ' + absolute(origin, '/api/sheets/<id>') + '` `{"col_meta":{"view":{…},"pins":[…]}}`. No source row changes.',
    '',
    '## Every sheet is an object with its own link',
    '',
    'A sheet is `sheet://<id>`. Its human link is `' + absolute(origin, '/sheet/<id>') + '`; its self-description is `GET ' + absolute(origin, '/api/sheets/<id>/self') + '` (`?format=markdown` for prose): what it is, its exact operations with this sheet\'s URLs filled in, its webhook address, how authority works, and where its receipts land. As an environment object it answers at `' + absolute(origin, '/api/environment/objects?ref=sheet%3A%2F%2F<id>') + '` with the same fields as every other object.',
    '',
    'Visibility is per sheet: `PATCH ' + absolute(origin, '/api/sheets/<id>') + '` `{"visibility":"public"}` lets anyone read it at its link and on its GET lanes; `"private"` (the default) needs authority for reads too. Writes always need authority. To hand one sheet to a web model without the build key, the owner mints a token scoped to that sheet: `GET ' + absolute(origin, '/api/dispatch?mint_share=1&scope=sheet:<id>&ttl=86400') + '`; the model presents it as `?share=<token>` or `authorization: Bearer <token>` and can read, write cells, append, run the view and write pins on that sheet and nothing else.',
    '',
    'A column path is `column` or `column.json.path`: `descriptor_json.comparables[0].dimensions`, `request_json.body.messages[0].content`, `response_json.usage.total_tokens`. Filter ops: `=`, `!=`, `contains`, `starts`, `in`, `>`, `<`, `>=`, `<=`, `empty`, `not_empty`; `any` matches every text column of the row.',
    '',
    '## Where receipts land',
    '',
    'Every operation above writes one ledger row: directory changes as `DIRECTORY_MUTATE` (source `directory`), sheet writes as `SHEET_*` (source `sheets`), invocations under the row key that ran. Read them with `GET ' + absolute(origin, '/api/events?source=<source>&key=<key>&limit=50') + '` or the environment slice `GET ' + absolute(origin, '/api/environment/changes?after=<ISO-8601>') + '`, or project them into a sheet with `view.source = "ledger"`. The receipt, not the HTTP status, is what happened.',
    '',
    '## Evidence states',
    '',
    '- `contract_only` — schema-valid example; never executed.',
    '- `executed` — an invocation record exists and transport completed.',
    '- `effect_verified` — declared postconditions were independently checked.',
    '- `failed` — the real failure and payload remain available.',
    '- `stale` — a relevant object, prompt, model, adapter, or rule revision changed after verification.',
    '',
    'Only `effect_verified` against current revisions may be described as working.',
    '',
    '## Declared operations, generated from the catalog',
    '',
    'Every object below declared its operations in its own descriptor. Nothing here is written by hand; edit the object and this section changes. Objects without declared operations are reachable through `directory://catalog` by key.',
    '',
  ];
  for (const object of declaredOperations(catalog)) {
    lines.push('### `' + object.ref + '` — ' + (object.title || object.ref) + (object.hash ? '  (rev ' + object.revision + ', ' + object.hash + ')' : ''));
    if (object.summary) lines.push('', object.summary);
    lines.push('');
    for (const op of object.operations) {
      const authority = op.authority && typeof op.authority === 'object' ? Object.keys(op.authority).filter((k) => op.authority[k]).join('/') : 'unknown';
      const effects = Array.isArray(op.effects) && op.effects.length ? ' → ' + op.effects.join('; ') : ' → no side effects';
      lines.push('- `' + op.id + '`: `' + String(op.method || '').toUpperCase() + ' ' + absolute(origin, op.href) + '` (' + authority + ')' + (op.summary ? ' — ' + op.summary : '') + effects + (op.concurrency ? ' — concurrency: `' + op.concurrency + '`' : ''));
      if (op.input_schema && op.input_schema.properties) {
        const required = new Set(Array.isArray(op.input_schema.required) ? op.input_schema.required : []);
        lines.push('  - input: ' + Object.entries(op.input_schema.properties).map(([name, spec]) => '`' + name + '`' + (required.has(name) ? '*' : '') + (spec && spec.description ? ' (' + spec.description + ')' : '')).join(', '));
      }
    }
    lines.push('');
  }
  lines.push('## Current object families', '');
  for (const [kind, count] of Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push('- `' + kind + '`: ' + count);
  }
  lines.push('', 'Start with the target object, not a feature request. The grammar above is the complete route from intent to an exact operation and its evidence.');
  return lines.join('\n');
}
