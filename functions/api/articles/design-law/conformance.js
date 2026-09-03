import { designLawConformance } from "../../../_lib/design_law_object.js";

export async function onRequestGet() {
  return Response.json(designLawConformance(), {
    headers: { "cache-control": "no-store" },
  });
}
