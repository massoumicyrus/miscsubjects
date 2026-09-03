import { unifiedGraphResponse } from "../_lib/unified_graph.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=15",
    },
  });
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (request.method !== "GET") {
      return json({ error: "GET only" }, 405);
    }
    const body = await unifiedGraphResponse(env, request);
    return json(body);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}