import { skillLawConformance } from "../../../_lib/skill_law_object.js";

export async function onRequestGet() {
  return Response.json(skillLawConformance(), {
    headers: { "cache-control": "no-store" },
  });
}
