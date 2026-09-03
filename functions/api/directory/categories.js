export async function onRequestGet(context) {
  const { env } = context;
  const r = await env.DB.prepare(
    'SELECT IFNULL(category, "_") AS category, COUNT(*) AS tools ' +
    'FROM directory WHERE IFNULL(enabled,1)=1 AND IFNULL(planner_visible,1)=1 ' +
    'GROUP BY category ORDER BY category'
  ).all();
  return new Response(JSON.stringify({ rows: r.results || [] }), {
    headers: { 'content-type': 'application/json' },
  });
}
