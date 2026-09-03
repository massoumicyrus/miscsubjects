const ROOT = 'https://miscsubjects.com';

function record(origin) {
  return {
    schema: 'op-object-protocol/1.0',
    name: 'OP',
    expanded_name: 'Object Protocol',
    previous_name: 'OIP — Object Invocation Protocol',
    definition: 'OP is the common object grammar for discovery, bounded authority, invocation, receipts, replay, repair, provenance, and feedback.',
    compatibility: 'Existing OIP route names, directory keys, receipt ids, and federation identifiers remain valid compatibility identifiers. New human and machine roots use OP.',
    invariants: [
      'A capability is an object with a readable contract.',
      'Authority is an object scope enforced at the dispatch boundary.',
      'Execution is an object invocation.',
      'Proof is an invocation receipt.',
      'Correction is replay or repair linked to the original receipt.',
      'Feedback is a typed contribution linked to the object it evaluates.',
    ],
    roots: {
      human: origin + '/a/op',
      machine: origin + '/api/op',
      operating_system: origin + '/opos',
      dispatch: origin + '/api/dispatch',
      map: origin + '/api/dispatch?map=1',
      registry: origin + '/api/dispatch?registry=1',
      legacy_human: origin + '/a/oip',
    },
  };
}

export function onRequestGet(context) {
  const url = new URL(context.request.url);
  const r = record(url.origin || ROOT);
  if (url.searchParams.get('format') === 'markdown') {
    const lines = ['# OP — Object Protocol', '', r.definition, '', 'Former name: ' + r.previous_name + '.', '', '## Invariants', '', ...r.invariants.map(x => '- ' + x), '', '## Roots', '', ...Object.entries(r.roots).map(([k, v]) => '- ' + k + ': ' + v), '', '## Compatibility', '', r.compatibility];
    return new Response(lines.join('\n'), { headers: { 'content-type': 'text/markdown; charset=utf-8', 'access-control-allow-origin': '*' } });
  }
  return new Response(JSON.stringify(r, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } });
}
