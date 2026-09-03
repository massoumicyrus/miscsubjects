import {
  articleRepresentations,
  articleSkillMarkdown,
} from "./article_skill.js";

export const ARTICLE_OBJECT_LAW = Object.freeze({
  id: "law:article-object",
  statement:
    "Every article is an ontological object with typed human, model, directory, API, source, relationship, conformance, failure, and receipt expressions.",
  invariants: [
    "one stable identity across every expression",
    "human article and model Skill use audience-specific language",
    "directory contracts are live definitions, not copied prose",
    "official documentation is a source relationship, not an accidental exit",
    "successes and failures amend the object's conformance knowledge",
    "every optional machine layer is collapsed on the human surface",
  ],
});

export const DESIGN_ONTOLOGY = Object.freeze([
  {
    id: "capability:openai-image",
    label: "GPT Image",
    relation: "renders_visual_design_with",
    directory_keys: ["OPENAI_IMAGE", "OPENAI_IMAGE_EDIT"],
    source: {
      label: "OpenAI image generation documentation",
      url: "https://platform.openai.com/docs/guides/image-generation",
      publisher: "OpenAI",
      kind: "official_documentation",
    },
  },
  {
    id: "capability:grok-image",
    label: "Grok Image",
    relation: "renders_visual_design_with",
    directory_keys: ["GROK_IMAGE_R2", "GROK_IMAGE", "GROK_IMAGE_EDIT"],
    source: {
      label: "xAI image generation documentation",
      url: "https://docs.x.ai/developers/model-capabilities/images/generation",
      publisher: "xAI",
      kind: "official_documentation",
    },
  },
  {
    id: "capability:arcads",
    label: "ArcAds",
    relation: "produces_image_and_video_design_with",
    directory_keys: [
      "ARCADS_GENERATE",
      "ARCADS_VIDEO_GENERATE",
      "ARCADS_ROUTES",
      "ARCADS_UPLOAD",
    ],
    source: {
      label: "ArcAds OpenAPI source",
      url: "/api/directory/PROVIDER_DOCS",
      publisher: "ArcAds / build source store",
      kind: "api_documentation_source",
    },
  },
  {
    id: "capability:grok-video",
    label: "Grok Video",
    relation: "renders_motion_design_with",
    directory_keys: ["GROK_VIDEO_START", "GROK_VIDEO_GET"],
    source: {
      label: "xAI video generation documentation",
      url: "https://docs.x.ai/developers/model-capabilities/video/generation",
      publisher: "xAI",
      kind: "official_documentation",
    },
  },
]);

const ARTICLE_ONTOLOGIES = Object.freeze({
  "design-law": {
    conformance_group: "design",
    relationships: DESIGN_ONTOLOGY,
  },
  design: { conformance_group: "design", relationships: DESIGN_ONTOLOGY },
  oip: {
    conformance_group: "oip",
    relationships: [
      {
        id: "directory:oip-tree",
        label: "OIP capability tree",
        relation: "discovers_tools_through",
        directory_keys: ["OIP_TREE", "WORLD_MAP"],
        source: {
          label: "Object Invocation Protocol article corpus",
          url: "/a/oip",
          publisher: "miscsubjects",
          kind: "canonical_article",
        },
      },
    ],
  },
  "oip-github": {
    conformance_group: "github",
    relationships: [
      {
        id: "capability:github",
        label: "GitHub",
        relation: "operates_repository_through",
        directory_keys: ["GITHUB", "CLI_GH", "FILE_GET", "FILE_PUT"],
        source: {
          label: "GitHub REST API documentation",
          url: "https://docs.github.com/en/rest",
          publisher: "GitHub",
          kind: "official_documentation",
        },
      },
    ],
  },
  "oip-tap-go": {
    conformance_group: "capability-delegation",
    relationships: [
      {
        id: "operation:mint-capability",
        label: "Mint scoped capability",
        relation: "creates_token_drop_with",
        directory_keys: ["OIP_TREE", "WORLD_MAP"],
        operations: [
          {
            label: "Mint row capability",
            method: "GET",
            route:
              "/api/dispatch?mint_share=1&scope=row&key=KEY&ttl=600&uses=1",
          },
          {
            label: "Create complete Tap & Go drop",
            method: "GET",
            route: "/api/dispatch?tap_go=1&scope=row&key=KEY",
          },
          {
            label: "Explain capability",
            method: "GET",
            route: "/api/dispatch?explain=TOKEN",
          },
          {
            label: "Revoke capability",
            method: "POST",
            route: "/api/dispatch?revoke=TOKEN",
          },
        ],
        source: {
          label: "OIP capability-delegation specification",
          url: "/a/oip-tap-go",
          publisher: "miscsubjects",
          kind: "canonical_article",
        },
      },
    ],
  },
  "what-is-token-drop": {
    conformance_group: "capability-delegation",
    relationships: [
      {
        id: "article:oip-tap-go",
        label: "Tap & Go delegation",
        relation: "implemented_by",
        directory_keys: ["OIP_TREE", "WORLD_MAP"],
        operations: [
          {
            label: "Mint token drop",
            method: "GET",
            route:
              "/api/dispatch?tap_go=1&scope=row&key=KEY&ttl=600&uses=1",
          },
        ],
        source: {
          label: "Tap & Go article",
          url: "/a/oip-tap-go",
          publisher: "miscsubjects",
          kind: "canonical_article",
        },
      },
    ],
  },
});

function safeDirectoryRow(row) {
  return {
    key: row.key,
    type: row.type,
    // The raw target is the implementation endpoint — a Worker host, an internal path, a
    // provider URL. This object is served publicly, so only the verb travels; callers
    // invoke through the public contract route below, which is the supported path anyway.
    method: (() => {
      const verb = String(row.target || "").trim().split(/\s+/)[0].toUpperCase();
      return /^(GET|POST|PUT|PATCH|DELETE|HEAD)$/.test(verb) ? verb : null;
    })(),
    category: row.category || null,
    enabled: row.enabled !== 0,
    contract: row.content || "",
    input_schema: row.input_schema || null,
    examples: row.examples || null,
    authority_required: Boolean(row.auth),
    representations: {
      article: `/a/directory/${encodeURIComponent(row.key)}`,
      json: `/api/directory/${encodeURIComponent(row.key)}`,
      skill: `/api/directory/${encodeURIComponent(row.key)}?format=skill`,
      oip_contract: `/api/dispatch?key=${encodeURIComponent(row.key)}`,
    },
  };
}

async function readDirectoryRows(env, keys) {
  if (!keys.length || !env?.DB) return [];
  const rows = await Promise.all(
    keys.map((key) =>
      env.DB.prepare("SELECT * FROM directory WHERE key = ?")
        .bind(key)
        .first()
        .catch(() => null),
    ),
  );
  return rows.filter(Boolean).map(safeDirectoryRow);
}

async function readDirectoryCategories(env, categories) {
  const clean = [...new Set(categories.map((value) => String(value || "").toLowerCase()).filter(Boolean))].slice(0, 8);
  if (!clean.length || !env?.DB) return [];
  const placeholders = clean.map(() => "?").join(",");
  const result = await env.DB.prepare(
    `SELECT * FROM directory WHERE lower(category) IN (${placeholders}) AND enabled <> 0 ORDER BY planner_rank, key LIMIT 24`,
  )
    .bind(...clean)
    .all()
    .catch(() => ({ results: [] }));
  return (result.results || []).map(safeDirectoryRow);
}

function configuredOntology(article) {
  const meta = (() => {
    try {
      return JSON.parse(article?.meta || "{}") || {};
    } catch {
      return {};
    }
  })();
  const explicitKeys = [
    ...(meta.directory_keys || []),
    ...(meta.extra?.directory_keys || []),
  ];
  const preset = ARTICLE_ONTOLOGIES[article?.slug] || {};
  const semanticCategories = [
    ...(meta.tags || []),
    ...(meta.categories || []),
    ...(meta.extra?.categories || []),
    ...String(article?.slug || "").split("-"),
  ];
  return {
    conformance_group:
      meta.conformance_group ||
      meta.extra?.conformance_group ||
      preset.conformance_group ||
      "article",
    relationships: preset.relationships || [],
    explicitKeys,
    semanticCategories,
  };
}

export async function articleObjectEnvelope(env, article, payload) {
  const ontology = configuredOntology(article);
  const relatedKeys = ontology.relationships.flatMap(
    (relationship) => relationship.directory_keys || [],
  );
  const directory = await readDirectoryRows(env, [
    ...new Set([...ontology.explicitKeys, ...relatedKeys]),
  ]);
  const categoryDirectory = await readDirectoryCategories(
    env,
    ontology.semanticCategories,
  );
  const allDirectory = [
    ...new Map(
      [...directory, ...categoryDirectory].map((row) => [row.key, row]),
    ).values(),
  ];
  const byKey = new Map(allDirectory.map((row) => [row.key, row]));
  const relationships = ontology.relationships.map((relationship) => ({
    ...relationship,
    directory: (relationship.directory_keys || [])
      .map((key) => byKey.get(key))
      .filter(Boolean),
  }));
  const routes = articleRepresentations(article.slug);
  return {
    object_type: "article-object",
    identity: {
      id: `article:${article.slug}`,
      slug: article.slug,
      title: article.title,
    },
    law: ARTICLE_OBJECT_LAW,
    expressions: {
      human: { route: routes.article, role: "explain", audience: "human" },
      skill: {
        route: routes.skill,
        role: "direct behavior",
        audience: "model",
        content: articleSkillMarkdown(article),
      },
      json: { route: routes.json, role: "transport object", audience: "software" },
      markdown: {
        route: routes.markdown,
        role: "portable explanation",
        audience: "human or model",
      },
      directory: allDirectory,
    },
    ontology: {
      conformance_group: ontology.conformance_group,
      inferred_from: ontology.semanticCategories,
      relationships,
      sources: relationships.map((relationship) => relationship.source).filter(Boolean),
    },
    conformance: {
      success_events: `/api/articles/${encodeURIComponent(article.slug)}/invocations?status=success`,
      failure_events: `/api/articles/${encodeURIComponent(article.slug)}/invocations?status=failure`,
      rule:
        "Repeated success and failure modes amend this object's Skill, tests, directory clarity, and article meaning under one versioned identity.",
    },
    article: { ...payload },
  };
}
