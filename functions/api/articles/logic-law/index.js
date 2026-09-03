import {
  LOGIC_LAW_OBJECT,
  logicLawMarkdown,
  logicLawSkillMarkdown,
} from "../../../_lib/logic_law_object.js";
import { articleObjectEnvelope } from "../../../_lib/article_object.js";

export async function onRequestGet({ request, env }) {
  const format = (
    new URL(request.url).searchParams.get("format") || "json"
  ).toLowerCase();
  if (format === "markdown" || format === "md") {
    return new Response(logicLawMarkdown(), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  if (format === "skill") {
    return new Response(logicLawSkillMarkdown(), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  const envelope = await articleObjectEnvelope(
    env,
    {
      slug: "logic-law",
      title: LOGIC_LAW_OBJECT.identity.title,
      body: LOGIC_LAW_OBJECT.content.thesis,
      meta: JSON.stringify({ conformance_group: "writing" }),
    },
    LOGIC_LAW_OBJECT,
  );
  return Response.json({
    ...LOGIC_LAW_OBJECT,
    expressions: envelope.expressions,
    ontology: envelope.ontology,
    article_object_law: envelope.law,
  }, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
