// /content/<slug> is the legacy reader path. The canonical article path is /a/<slug>.
// If the slug exists in the articles table, redirect permanently. Otherwise 404.
export async function onRequestGet({ params, env }) {
  const slug = String(params.slug || "").toLowerCase();
  if (!slug) return new Response("Not found", { status: 404 });

  const a = await env.DB.prepare("SELECT slug FROM articles WHERE slug=?")
    .bind(slug)
    .first();
  if (!a) return new Response("Not found", { status: 404 });

  return new Response(null, {
    status: 301,
    headers: {
      location: "/a/" + slug,
      "cache-control": "public, max-age=300",
    },
  });
}
