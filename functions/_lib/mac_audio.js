/** Mac speaker playback for ara voice notes. afplay only — never open mp3 in browser. */
export function buildAraAfplayCmd(url) {
  const u = String(url || '').trim();
  if (!u.startsWith('http')) return null;
  const q = u.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  // Double quotes only — single quotes break LOCAL_EXEC JSON body embedding.
  return `pkill -f "afplay /tmp/ara-whore.mp3" 2>/dev/null; curl -fsSL "${q}" -o /tmp/ara-whore.mp3 && afplay /tmp/ara-whore.mp3 || true`;
}