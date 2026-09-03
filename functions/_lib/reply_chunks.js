// iMessage: Blooio text may be string[] for multiple bubbles.
// Default = one bubble. Split ONLY when the model marks distinct ideas with --- or ///.

export function formatForIMessage(text) {
  let s = String(text || '').trim();
  if (!s) return '';
  // Preserve newlines; collapse horizontal whitespace only (not one-line R2-D2 dumps).
  s = s.replace(/[^\S\n]+/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Split only on explicit model markers between distinct ideas. */
export function splitOnMarkers(text, maxParts = 3) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  if (/\n---+\n/.test(raw)) {
    return raw.split(/\n---+\n/).map((p) => formatForIMessage(p)).filter(Boolean).slice(0, maxParts);
  }
  if (/\n\/\/\/+\n/.test(raw)) {
    return raw.split(/\n\/\/\/+\n/).map((p) => formatForIMessage(p)).filter(Boolean).slice(0, maxParts);
  }
  const one = formatForIMessage(raw);
  return one ? [one] : [];
}

export function blooioTextField(text, opts = {}) {
  if (opts.split === false) {
    const s = formatForIMessage(text);
    return s || '';
  }
  const parts = splitOnMarkers(text, opts.maxParts || 3);
  if (parts.length <= 1) return parts[0] || '';
  return parts;
}

export function joinBubbles(field) {
  if (Array.isArray(field)) return field.join('\n\n');
  return String(field || '');
}