// Executable closure registry for the post-v1.1 protocol laws. A law is deployed only
// when its conformance clause ships in the same runtime. scripts/ship.mjs enforces this
// mapping before a production deploy; /api/protocol-laws makes the mapping public.
export const PROTOCOL_LAWS = Object.freeze([
  { id: 'L11', title: 'Computed federation census', status: 'deployed', clause: 'C39' },
  { id: 'L12', title: 'Production deployment mutex', status: 'deployed', clause: 'C40' },
  { id: 'L13', title: 'Relay outcome taxonomy', status: 'deployed', clause: 'C41' },
  { id: 'L14', title: 'Public-ingress credential guard with revocation', status: 'deployed', clause: 'C42' },
  { id: 'L15', title: 'Canonical objection repair lineage', status: 'deployed', clause: 'C43' },
  { id: 'L16', title: 'Unknown-key fail-closed education', status: 'deployed', clause: 'C44' },
  { id: 'L17', title: 'Law-to-clause atomic closure', status: 'deployed', clause: 'C45' },
]);

export function protocolLawManifest() {
  return {
    protocol: 'OIP',
    kind: 'protocol_law_registry',
    version: '1.2',
    invariant: 'Every deployed protocol law has exactly one named conformance clause in the same deploy.',
    laws: PROTOCOL_LAWS,
  };
}
