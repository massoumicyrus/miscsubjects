import { knowledgeActionSchema } from "../_lib/knowledge_action_object.js";

export async function onRequestGet() {
  return Response.json(knowledgeActionSchema(), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
