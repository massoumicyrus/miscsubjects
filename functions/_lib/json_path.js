// One JSON-path reader for the build: "$PREV.body.messages[0].content", "meta.hero.url",
// "[2].id". Dots walk objects, [n] walks arrays. A missing step is '' (never a throw), so a
// flow step or a sheet column reading inside a payload degrades to blank, not to a crash.
export function getPath(value, path) {
  let v = value;
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^[\[{]/.test(t)) { try { v = JSON.parse(t); } catch { return ''; } }
  }
  const steps = String(path || '').replace(/^\$\.?/, '').match(/[^.\[\]]+|\[\d+\]/g) || [];
  for (const raw of steps) {
    const step = raw.startsWith('[') ? Number(raw.slice(1, -1)) : raw;
    if (v == null) return '';
    v = v[step];
  }
  if (v == null) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}
