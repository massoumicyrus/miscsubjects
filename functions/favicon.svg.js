const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#fff"/><circle cx="60" cy="40" r="20" fill="#050505"/></svg>`;

export async function onRequestGet() {
  return new Response(ICON, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=31536000",
    },
  });
}
