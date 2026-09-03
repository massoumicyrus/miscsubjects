import {
  LOOP_LAW_OBJECT,
  loopLawMarkdown,
  loopLawSkillMarkdown,
} from "../../../_lib/loop_law_object.js";
import { articleObjectEnvelope } from "../../../_lib/article_object.js";

export async function onRequestGet({ request, env }) {
  const format = (
    new URL(request.url).searchParams.get("format") || "json"
  ).toLowerCase();
  if (format === "markdown" || format === "md") {
    return new Response(loopLawMarkdown(), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  if (format === "skill") {
    return new Response(loopLawSkillMarkdown(), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  const envelope = await articleObjectEnvelope(
    env,
    {
      slug: "loop-law",
      title: LOOP_LAW_OBJECT.identity.title,
      body: LOOP_LAW_OBJECT.content.thesis,
      meta: JSON.stringify({ conformance_group: "writing" }),
    },
    LOOP_LAW_OBJECT,
  );
  return Response.json({
    ...LOOP_LAW_OBJECT,
    expressions: envelope.expressions,
    ontology: envelope.ontology,
    article_object_law: envelope.law,
  }, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
