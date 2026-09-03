import { runGraphQuery } from "../../_lib/graph_query.js";
import { attachSelf } from "../../_lib/self_explain.js";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=30",
    },
  });
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    if (request.method !== "GET") return json({ error: "GET only" }, 405);
    const result = await runGraphQuery(env, new URL(request.url));
    return json(
      attachSelf(result, "graph_query", {
        contains: "Dataview-style claim/source/article queries on live ledger",
        how_to_use: result.api_example,
      }),
    );
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}