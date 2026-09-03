import { outreachLawSkillMarkdown } from "../../../_lib/outreach_law_object.js";

export async function onRequestGet() {
  return new Response(outreachLawSkillMarkdown(), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'inline; filename="SKILL.md"',
      "cache-control": "public, max-age=300",
    },
  });
}
