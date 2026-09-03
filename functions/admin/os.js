// /admin/os was a mistaken merge surface. Ledger lives at /admin/ledger only.
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const dest = new URL('/admin/ledger', url.origin);
  for (const [k, v] of url.searchParams) dest.searchParams.set(k, v);
  return new Response(null, {
    status: 301,
    headers: {
      location: dest.toString(),
      'cache-control': 'no-store, no-cache, must-revalidate',
      pragma: 'no-cache',
    },
  });
}