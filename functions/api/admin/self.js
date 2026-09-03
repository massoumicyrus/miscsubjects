import { isBuildAuthed } from "../../_lib/admin_session.js";
import {
  adminPageSelf,
  adminPageSelfMarkdown,
  adminPagesIndexMarkdown,
  adminPagesIndexPayload,
} from "../../_lib/admin_page_self.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (!(await isBuildAuthed(request, env))) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } });

  const url = new URL(context.request.url);
  const pageId = String(url.searchParams.get("page") || "").trim();
  const fmt = String(url.searchParams.get("format") || "json").toLowerCase();

  if (!pageId) {
    const payload = adminPagesIndexPayload();
    if (fmt === "markdown" || fmt === "md" || fmt === "text") {
      return new Response(adminPagesIndexMarkdown(), {
        headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=120" },
      });
    }
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=120" },
    });
  }

  const self = adminPageSelf(pageId);
  if (!self) {
    return new Response(JSON.stringify({ error: "unknown_page", page: pageId, hint: "GET /api/admin/self for the full index" }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (fmt === "markdown" || fmt === "md" || fmt === "text") {
    return new Response(adminPageSelfMarkdown(self), {
      headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=120" },
    });
  }
  return new Response(JSON.stringify(self), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=120" },
  });
}
