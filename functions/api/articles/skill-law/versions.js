import { skillLawVersions } from "../../../_lib/skill_law_object.js";

export async function onRequestGet() {
  return Response.json(skillLawVersions(), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
