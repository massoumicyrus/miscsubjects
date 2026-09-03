// WELL-KNOWN SKILL INDEX (spec Phase 6) — the agentskills.io discovery convention (the pattern X
// publishes at /.well-known/agent-skills/index.json). A pure projection of the skill store:
// every entry points at the live skill object; digests are per-version content hashes when the
// store holds them. This is what makes the build's methods installable by the broader ecosystem
// (npx skills add https://miscsubjects.com) without a parallel registry to maintain.
import { SKILL_REGISTRY } from '../../_lib/skill_registry.js';
import { getSkillHead } from '../../_lib/skill_store.js';

export async function onRequestGet({ env }) {
  const base = 'https://miscsubjects.com';
  const skills = [];
  for (const s of SKILL_REGISTRY.skills) {
    const head = await getSkillHead(env, s.name).catch(() => null);
    skills.push({
      name: s.name,
      description: s.description,
      url: base + '/api/skills/' + s.name + '/skill',
      bundle: base + '/api/skills/' + s.name + '/bundle?format=zip',
      ...(head?.version ? { version: String(head.object.current_version), digest: 'sha256:' + head.version.content_hash } : {}),
      'x-evidence': base + '/api/skills/' + s.name + '/evidence',
    });
  }
  return new Response(JSON.stringify({
    schemaVersion: '0.2.0',
    provider: { name: 'miscsubjects', url: base },
    generated_from: 'the live skill store — this index is a projection, never a second source of truth',
    skills,
  }, null, 2), {
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' },
  });
}
