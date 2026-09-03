import { logicLawSkillMarkdown } from "../../../_lib/logic_law_object.js";

export async function onRequestGet() {
  return new Response(logicLawSkillMarkdown(), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'inline; filename="SKILL.md"',
      "cache-control": "public, max-age=300",
    },
  });
}
