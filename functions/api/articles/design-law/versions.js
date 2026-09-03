import { designLawVersions } from "../../../_lib/design_law_object.js";

export async function onRequestGet() {
  return Response.json(designLawVersions(), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
