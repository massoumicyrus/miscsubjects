import {
  DESIGN_LAW_OBJECT,
  designLawMarkdown,
  designLawSkillMarkdown,
} from "../../../_lib/design_law_object.js";
import { articleObjectEnvelope } from "../../../_lib/article_object.js";

export async function onRequestGet({ request, env }) {
  const format = (
    new URL(request.url).searchParams.get("format") || "json"
  ).toLowerCase();
  if (format === "markdown" || format === "md") {
    return new Response(designLawMarkdown(), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  if (format === "skill") {
    return new Response(designLawSkillMarkdown(), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  const envelope = await articleObjectEnvelope(
    env,
    {
      slug: "design-law",
      title: DESIGN_LAW_OBJECT.identity.title,
      body: DESIGN_LAW_OBJECT.content.thesis,
      meta: JSON.stringify({ conformance_group: "design" }),
    },
    DESIGN_LAW_OBJECT,
  );
  return Response.json({
    ...DESIGN_LAW_OBJECT,
    expressions: envelope.expressions,
    ontology: envelope.ontology,
    article_object_law: envelope.law,
  }, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
