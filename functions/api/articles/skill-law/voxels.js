import { skillLawVoxels } from "../../../_lib/skill_law_object.js";

export async function onRequestGet() {
  return Response.json(skillLawVoxels(), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
