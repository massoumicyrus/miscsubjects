import { designLawVoxels } from "../../../_lib/design_law_object.js";

export async function onRequestGet() {
  return Response.json(designLawVoxels(), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
