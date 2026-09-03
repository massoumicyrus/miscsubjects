// PRIMITIVE: mark — brand mark and identity icons.

export function brandMark({ size = 22 } = {}) {
  return `<span class="ds-mark" aria-hidden="true"><svg viewBox="0 0 100 100" width="${size}" height="${size}"><path d="M50 50 m0 -45 a45 45 0 0 1 45 45 a45 45 0 0 1 -45 45 a28 28 0 0 1 -28 -28 a17 17 0 0 1 17 -17 a10 10 0 0 1 10 10" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg></span>`;
}
