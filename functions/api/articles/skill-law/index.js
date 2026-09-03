import {
  SKILL_LAW_OBJECT,
  skillLawMarkdown,
  skillLawSkillMarkdown,
} from "../../../_lib/skill_law_object.js";
import { articleObjectEnvelope } from "../../../_lib/article_object.js";

export async function onRequestGet({ request, env }) {
  const format = (
    new URL(request.url).searchParams.get("format") || "json"
  ).toLowerCase();
  if (format === "markdown" || format === "md") {
    return new Response(skillLawMarkdown(), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  if (format === "skill") {
    return new Response(skillLawSkillMarkdown(), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  const envelope = await articleObjectEnvelope(
    env,
    {
      slug: "skill-law",
      title: SKILL_LAW_OBJECT.identity.title,
      body: SKILL_LAW_OBJECT.content.thesis,
      meta: JSON.stringify({ conformance_group: "skills" }),
    },
    SKILL_LAW_OBJECT,
  );
  return Response.json({
    ...SKILL_LAW_OBJECT,
    expressions: envelope.expressions,
    ontology: envelope.ontology,
    article_object_law: envelope.law,
  }, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
