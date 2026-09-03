
/** Technical term -> the plain words that carry the same meaning. */
export const JARGON = {
  resorption: 'the bulge shrinking on its own',
  resorb: 'shrink on its own',
  preclinical: 'animal',
  corticosteroid: 'steroid',
  fibrocartilage: 'the gristly pad that anchors tendon to bone',
  enthesis: 'the join where tendon meets bone',
  'number-needed-to-treat': 'how many people you treat for one to be helped',
  'number needed to treat': 'how many people you treat for one to be helped',
  'cox-2': 'the newer type of anti-inflammatory',
  'vascular events': 'heart attacks and strokes',
  'gastrointestinal': 'stomach and gut',
  systemic: 'whole-body',
  'adverse event': 'reported harm',
  contraindicated: 'must not be taken',
  'placebo-controlled': 'against a dummy treatment',
  'primary endpoint': 'the main thing the trial measured',
  'effect size': 'how big the difference was',
  'meta-analysis': 'a study that pools other studies',
  'systematic review': 'a review that searched for every study',
  // ── the original map, kept whole ──
  angiogenesis: 'new blood vessel growth',
  angiogenic: 'blood-vessel-growing',
  desiccation: 'drying out',
  desiccated: 'dried out',
  'fibroblast migration': 'tissue-building cells moving to the injury',
  proliferation: 'cells multiplying',
  'extracellular matrix': 'the scaffold between cells',
  'nucleus pulposus': 'the soft centre of the disc',
  'annulus fibrosus': 'the tough outer ring of the disc',
  radiculopathy: 'a pinched nerve root',
  radiculitis: 'an inflamed nerve root',
  'anti-fibrotic': 'reduces scarring',
  fibrosis: 'scarring',
  upregulate: 'increase',
  downregulate: 'reduce',
  modulate: 'change',
  attenuate: 'reduce',
  ameliorate: 'improve',
  efficacy: 'whether it works',
  administration: 'taking it',
  utilise: 'use',
  utilize: 'use',
  elucidate: 'explain',
  facilitate: 'help',
  'mediated by': 'happens through',
  'in vivo': 'in a living animal',
  'in vitro': 'in a dish',
  nociceptive: 'pain-signalling',
  catabolic: 'tissue-breaking-down',
  anabolic: 'tissue-building',
  pharmacokinetic: 'how the body absorbs and clears it',
  bioavailability: 'how much reaches the blood',
  immunogenicity: 'whether the immune system reacts to it',
  epithelial: 'lining',
  hematopoietic: 'blood-cell-making',
  haematopoietic: 'blood-cell-making',
};

// A term is glossed when the plain words, or a recognisable part of them, sit within this many
// characters of it. Quoting a source verbatim is not a violation, so quoted spans are stripped
// before the search — the law governs the page's own sentences.
const GLOSS_WINDOW = 200;

function stripQuotes(text) {
  return String(text || '')
    .replace(/[“”][^“”]{0,2000}[”“]/g, ' ')
    .replace(/"[^"\n]{0,2000}"/g, ' ')
    .replace(/^>.*$/gm, ' ');
}

/** Every technical word used without its plain words nearby. */
export function unglossedJargon(body) {
  const text = stripQuotes(body);
  const lower = text.toLowerCase();
  const out = [];
  for (const [term, plain] of Object.entries(JARGON)) {
    const re = new RegExp('\\b' + term.replace(/[-\s]/g, '[-\\s]') + '\\w*', 'gi');
    for (const m of text.matchAll(re)) {
      const from = Math.max(0, m.index - GLOSS_WINDOW);
      const near = lower.slice(from, m.index + m[0].length + GLOSS_WINDOW);
      // The gloss counts if the longest content word of the plain phrase is nearby.
      const key = plain.split(/\s+/).filter((w) => w.length > 4).sort((a, b) => b.length - a.length)[0]
        || plain.split(/\s+/)[0];
      if (!near.includes(key.toLowerCase())) {
        out.push({ term: m[0], plain, at: m.index });
        break;   // one report per term; the fix is the same everywhere it appears
      }
    }
  }
  return out;
}

/**
 * W21 — the opening tells a reader with no context what the page's subjects ARE.
 * The binding half: the first sentence names at least one subject the slug names. "These two do
 * opposite things to a healing tissue" names neither, which is the sentence that produced this.
 */
export function openingNamesNoSubject(slug, body) {
  const text = String(body || '');
  const first = text.replace(/^#.*$/gm, ' ').replace(/\[\[[^\]]*\]\]/g, ' ').trim()
    .split(/(?<=[.!?])\s/)[0] || '';
  if (!first) return null;
  const tokens = String(slug || '').toLowerCase().split('-').filter((t) => t.length > 2 && !/^\d+$/.test(t));
  if (!tokens.length) return null;
  const hay = first.toLowerCase();
  // A token counts as named by its stem, so "An NSAID is the painkiller…" satisfies the slug token
  // "nsaids". Without the stem the check refused a correct opening — the defect was in the check.
  const named = tokens.some((t) => hay.includes(t) || (t.endsWith('s') && hay.includes(t.slice(0, -1))));
  if (named) return null;
  return { first: first.slice(0, 200), tokens };
}
