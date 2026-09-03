// CANONICAL KNOWLEDGE-ACTION OBJECT
// Meaning, instruction, execution, evidence, failure, test, repair, and history
// share one identity. Article, Skill, REST, directory, graph, and receipts are facets.

export const KNOWLEDGE_ACTION_FACETS = Object.freeze([
  "identity",
  "content",
  "instructions",
  "relationships",
  "invocation",
  "authority",
  "conformance",
  "representations",
  "version",
  "provenance",
]);

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value))
    return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function knowledgeActionRoutes(slug, key) {
  const article = `/a/${slug}`;
  const api = `/api/articles/${slug}`;
  return Object.freeze({
    article: { route: article, audience: "human reader", role: "explain meaning", media_type: "text/html" },
    markdown: { route: `${api}?format=markdown`, audience: "human or model reader", role: "portable explanation", media_type: "text/markdown" },
    json: { route: api, audience: "software", role: "transport the complete typed object", media_type: "application/json" },
    directory: { route: `/api/directory/${key}`, audience: "router or operator", role: "discover identity and contract", media_type: "application/json" },
    skill: { route: `${api}/skill`, audience: "LLM", role: "teach behavior", media_type: "text/markdown" },
    oip_contract: { route: `/api/dispatch?key=${key}`, audience: "agent or protocol client", role: "discover authority and invocation", media_type: "application/json" },
    invoke: { route: `/api/dispatch?invoke=${key}`, audience: "authorized agent or protocol client", role: "execute behavior and return proof", media_type: "application/json" },
    graph: { route: `${api}/voxels`, audience: "graph client", role: "traverse relationships", media_type: "application/json" },
    versions: { route: `${api}/versions`, audience: "auditor", role: "inspect amendment lineage", media_type: "application/json" },
    conformance: { route: `${api}/conformance`, audience: "test runner or critic", role: "falsify claims and prescribe repair", media_type: "application/json" },
  });
}

export function createKnowledgeActionObject(definition) {
  const slug = definition?.identity?.slug;
  const key = definition?.invocation?.directory_key;
  if (!slug || !key) throw new Error("knowledge_action_identity_required");
  const object = {
    $schema: "https://miscsubjects.com/api/knowledge-action-schema",
    object_type: "knowledge-action",
    ...definition,
    representations: knowledgeActionRoutes(slug, key),
  };
  const missing = KNOWLEDGE_ACTION_FACETS.filter(
    (facet) => object[facet] == null,
  );
  if (missing.length)
    throw new Error(`knowledge_action_facets_missing:${missing.join(",")}`);
  return deepFreeze(object);
}

export function knowledgeActionConformance(object) {
  const checks = [
    [
      "all_facets_present",
      KNOWLEDGE_ACTION_FACETS.every((facet) => object?.[facet] != null),
    ],
    [
      "stable_identity",
      Boolean(object?.identity?.id && object?.identity?.slug),
    ],
    [
      "human_and_behavioral",
      Boolean(
        object?.content?.thesis && object?.instructions?.procedure?.length,
      ),
    ],
    [
      "directory_invocable",
      Boolean(
        object?.invocation?.directory_key &&
          object?.representations?.invoke?.route,
      ),
    ],
    ["authority_explicit", Boolean(object?.authority?.amendment_policy)],
    [
      "graph_traversable",
      Boolean(
        object?.relationships?.edges?.length &&
          object?.representations?.graph?.route,
      ),
    ],
    [
      "typed_expressions",
      Object.values(object?.representations || {}).every(
        (expression) =>
          expression?.route &&
          expression?.audience &&
          expression?.role &&
          expression?.media_type,
      ),
    ],
    [
      "failures_teach",
      Boolean(
        object?.conformance?.failure_modes?.length &&
        object?.conformance?.tests?.length,
      ),
    ],
    ["repair_defined", Boolean(object?.conformance?.repair)],
    [
      "versioned",
      Boolean(object?.version?.current && object?.version?.amendments?.length),
    ],
    ["provenance_addressed", Boolean(object?.provenance?.canonical_source)],
  ].map(([id, passed]) => ({ id, passed }));
  return {
    object_id: object.identity.id,
    passed: checks.every((check) => check.passed),
    score: checks.filter((check) => check.passed).length,
    possible: checks.length,
    checks,
  };
}

export function knowledgeActionVoxels(object) {
  const center = {
    id: object.identity.id,
    kind: "knowledge-action",
    label: object.identity.title,
    url: object.representations.article.route,
  };
  const nodes = [center];
  const edges = [];
  for (const [facet, expression] of Object.entries(object.representations)) {
    const id = `${object.identity.id}:representation:${facet}`;
    nodes.push({
      id,
      kind: "representation",
      label: `${facet} · ${expression.role}`,
      url: expression.route,
    });
    edges.push({ from: object.identity.id, to: id, rel: "renders_as" });
  }
  for (const relation of object.relationships.edges || []) {
    nodes.push({
      id: relation.to,
      kind: relation.kind || "knowledge-action",
      label: relation.label || relation.to,
      url: relation.url || null,
    });
    edges.push({
      from: object.identity.id,
      to: relation.to,
      rel: relation.rel,
    });
  }
  return { object_id: object.identity.id, nodes, edges };
}

export function knowledgeActionVersions(object) {
  return {
    object_id: object.identity.id,
    current: object.version.current,
    amendments: object.version.amendments,
    policy: object.authority.amendment_policy,
    provenance: object.provenance,
  };
}

export function knowledgeActionSchema() {
  return {
    $id: "https://miscsubjects.com/api/knowledge-action-schema",
    title: "Canonical Knowledge-Action Object",
    required: KNOWLEDGE_ACTION_FACETS,
    principle:
      "One canonical identity; many typed expressions optimized for different audiences and roles. Shared identity, meaning, relationships, version, and provenance do not require shared wording.",
    facet_meanings: {
      identity: "stable address and human name",
      content: "explanatory facet",
      instructions: "behavioral and Skill facet",
      relationships: "graph facet",
      invocation: "directory and executable contract facet",
      authority: "permission and amendment facet",
      conformance: "claims, failures, tests, and repair facet",
      representations:
        "purpose-built expressions with distinct audience, role, media type, and route",
      version: "amendment lineage",
      provenance: "historical proof and source location",
    },
  };
}
