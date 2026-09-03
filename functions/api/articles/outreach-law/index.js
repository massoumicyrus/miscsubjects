import {
  OUTREACH_LAW_OBJECT,
  outreachLawMarkdown,
  outreachLawSkillMarkdown,
} from "../../../_lib/outreach_law_object.js";
import { articleObjectEnvelope } from "../../../_lib/article_object.js";

export async function onRequestGet({ request, env }) {
  const format = (
    new URL(request.url).searchParams.get("format") || "json"
  ).toLowerCase();
  if (format === "markdown" || format === "md") {
    return new Response(outreachLawMarkdown(), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  if (format === "skill") {
    return new Response(outreachLawSkillMarkdown(), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }
  const envelope = await articleObjectEnvelope(
    env,
    {
      slug: "outreach-law",
      title: OUTREACH_LAW_OBJECT.identity.title,
      body: OUTREACH_LAW_OBJECT.content.thesis,
      meta: JSON.stringify({ conformance_group: "writing" }),
    },
    OUTREACH_LAW_OBJECT,
  );
  return Response.json({
    ...OUTREACH_LAW_OBJECT,
    expressions: envelope.expressions,
    ontology: envelope.ontology,
    article_object_law: envelope.law,
  }, {
    headers: { "cache-control": "public, max-age=300" },
  });
}
