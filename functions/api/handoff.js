// GET /api/handoff — unified owner-only content+backend handoff.
// Same role as /api/articles/{slug}/bundle but for the whole build.
import { isBuildAuthed } from "../_lib/admin_session.js";
import {
  buildUnifiedHandoffJson,
  buildUnifiedHandoffMarkdown,
} from "../_lib/unified_handoff.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!(await isBuildAuthed(request, env))) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } });

  const url = new URL(request.url);
  const origin = url.origin;
  // Never reflect an owner credential into generated URLs or handoff text. The caller's
  // existing cookie/header authorizes this response; links carry no secret material.
  const token = "";
  const fmt = String(url.searchParams.get("format") || "json").toLowerCase();

  if (fmt === "markdown" || fmt === "md" || fmt === "text") {
    const md = await buildUnifiedHandoffMarkdown(env, origin, token);
    return new Response(md, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  }

  const json = await buildUnifiedHandoffJson(env, origin, token);
  return new Response(JSON.stringify(json, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}
