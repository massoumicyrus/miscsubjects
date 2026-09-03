export async function invalidateDirSnapshot(env) {
  if (!env.KV) return;
  try { await env.KV.delete('directory:snapshot'); } catch {}
}
