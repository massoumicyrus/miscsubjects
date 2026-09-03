// Graph explorer — shared data for /graph and article embeds.
import { parseArticleMeta } from './article_topology.js';

const PEPTIDE_IDS = [
  'bpc-157', 'tb-500', 'ara-290', 'semax', 'selank', 'dsip', 'cjc-1295', 'ghk-cu',
  'pt-141', 'epitalon', 'dihexa', 'cerebrolysin', 'mots-c', 'll-37', 'foxo4-dri',
  'humanin', 'pinealon', 'tesamorelin', 'thymosin-alpha-1', 'snap-8', 'ss-31',
  'matrixyl', 'mk-677', 'melanotan-ii', 'aod-9604', 'retatrutide', 'tirzepatide',
  'semaglutide', 'vip', 'bdnf-explained', 'nad-plus', 'glutathione', 'ipamorelin',
  'kpv', 'what-are-peptides',
];

const PEPTIDE_LABEL = Object.fromEntries(PEPTIDE_IDS.map((id) => [
  id,
  id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace('Bpc', 'BPC').replace('Tb', 'TB').replace('Ara', 'ARA').replace('Ghk', 'GHK').replace('Dsip', 'DSIP').replace('Pt', 'PT').replace('Aod', 'AOD').replace('Glp', 'GLP').replace('Nad', 'NAD'),
]));

const DRUG_LEX = [
  { id: 'metformin', label: 'Metformin', tokens: ['metformin'] },
  { id: 'gabapentin', label: 'Gabapentin', tokens: ['gabapentin'] },
  { id: 'lyrica', label: 'Lyrica / pregabalin', tokens: ['lyrica', 'pregabalin'] },
  { id: 'glp-1', label: 'GLP-1 agonists', tokens: ['glp1', 'glp-1', 'ozempic', 'wegovy', 'mounjaro'] },
  { id: 'nsaids', label: 'NSAIDs', tokens: ['nsaids', 'nsaid', 'ibuprofen', 'naproxen'] },
  { id: 'ppis', label: 'PPIs', tokens: ['ppi', 'ppis', 'omeprazole', 'pantoprazole'] },
  { id: 'stimulants', label: 'Stimulants', tokens: ['adderall', 'stimulant', 'amphetamine'] },
  { id: 'statins', label: 'Statins', tokens: ['statin', 'statins'] },
  { id: 'benzodiazepines', label: 'Benzodiazepines', tokens: ['benzo', 'benzodiazepine', 'benzodiazepines'] },
  { id: 'corticosteroids', label: 'Corticosteroids', tokens: ['corticosteroid', 'corticosteroids', 'prednisone'] },
  { id: 'chemo', label: 'Chemotherapy', tokens: ['chemo', 'chemotherapy'] },
  { id: 'semaglutide', label: 'Semaglutide', tokens: ['semaglutide'] },
  { id: 'tirzepatide', label: 'Tirzepatide', tokens: ['tirzepatide'] },
];

const CONDITION_GROUPS = {
  nerve: 'Nerve & neuropathy',
  musculoskeletal: 'Musculoskeletal',
  gut: 'Gut & GI',
  metabolic: 'Metabolic & weight',
  sleep: 'Sleep & withdrawal',
  skin: 'Skin & aging',
  other: 'Other',
};

const CONDITION_LEX = [
  { id: 'neuropathy', label: 'Neuropathy (general)', group: 'nerve', tokens: ['neuropathy'], nerve: true },
  { id: 'diabetic-neuropathy', label: 'Diabetic neuropathy', group: 'nerve', tokens: ['diabetic-neuropathy', 'diabetic neuropathy'], nerve: true },
  { id: 'chemo-neuropathy', label: 'Chemo neuropathy', group: 'nerve', tokens: ['chemo-neuropathy', 'chemo neuropathy'], nerve: true },
  { id: 'carpal-tunnel', label: 'Carpal tunnel', group: 'nerve', tokens: ['carpal-tunnel', 'carpal tunnel'], nerve: true },
  { id: 'sciatica', label: 'Sciatica', group: 'nerve', tokens: ['sciatica'], nerve: true },
  { id: 'nerve-damage', label: 'Nerve damage / repair', group: 'nerve', tokens: ['nerve-damage', 'nerve damage', 'post-surgical-nerve', 'nerve repair', 'nerve symptoms'], nerve: true },
  { id: 'trigeminal', label: 'Trigeminal neuralgia', group: 'nerve', tokens: ['trigeminal'], nerve: true },
  { id: 'postherpetic', label: 'Postherpetic neuralgia', group: 'nerve', tokens: ['postherpetic', 'shingles'], nerve: true },
  { id: 'herniated-disc', label: 'Herniated disc', group: 'musculoskeletal', tokens: ['herniated-disc', 'herniated disc', 'degenerative-disc', 'degenerative disc'] },
  { id: 'frozen-shoulder', label: 'Frozen shoulder', group: 'musculoskeletal', tokens: ['frozen-shoulder', 'frozen shoulder'] },
  { id: 'plantar-fasciitis', label: 'Plantar fasciitis', group: 'musculoskeletal', tokens: ['plantar'] },
  { id: 'tendon', label: 'Tendon / ligament', group: 'musculoskeletal', tokens: ['tendon', 'ligament', 'achilles', 'rotator'] },
  { id: 'gut', label: 'Gut lining / GI', group: 'gut', tokens: ['gut-health', 'gut-lining', 'gut damage', 'gastro', 'gi-'] },
  { id: 'ibd', label: 'IBD / Crohn / colitis', group: 'gut', tokens: ['ibd', 'crohn', 'colitis'] },
  { id: 'glp1-gut', label: 'GLP-1 gut effects', group: 'gut', tokens: ['glp1-gut', 'glp-1-gut'] },
  { id: 'muscle-loss', label: 'Muscle loss / sarcopenia', group: 'metabolic', tokens: ['muscle-loss', 'muscle loss', 'sarcopenia'] },
  { id: 'ozempic-face', label: 'Ozempic face', group: 'metabolic', tokens: ['ozempic-face', 'ozempic face'] },
  { id: 'insomnia', label: 'Insomnia', group: 'sleep', tokens: ['insomnia'] },
  { id: 'benzo-withdrawal', label: 'Benzo withdrawal', group: 'sleep', tokens: ['benzo-withdrawal', 'benzo withdrawal'] },
  { id: 'brain-fog', label: 'Brain fog', group: 'nerve', tokens: ['brain-fog', 'brain fog'], nerve: true },
  { id: 'cognition', label: 'Cognition / focus', group: 'nerve', tokens: ['cognitive', 'cognition', 'focus'] },
  { id: 'skin', label: 'Skin / collagen', group: 'skin', tokens: ['skin', 'collagen', 'ghk'] },
  { id: 'post-surgery', label: 'Post-surgery recovery', group: 'musculoskeletal', tokens: ['post-surgery', 'post surgery', 'surgical'] },
];

const TIER_ORDER = ['human', 'preclinical', 'mechanistic', 'anecdotal', 'speculative', 'system'];
const TIER_LABEL = {
  human: 'Human trials',
  preclinical: 'Preclinical',
  mechanistic: 'Mechanistic',
  anecdotal: 'Anecdotal',
  speculative: 'Speculative',
  system: 'System',
};
const TIER_COLOR = {
  human: '#2e9e5b',
  preclinical: '#c9a227',
  mechanistic: '#6a5acd',
  anecdotal: '#8a7f72',
  speculative: '#9a7ab0',
  system: '#4a6fa5',
};

// AI / governance content families — the analog of peptide/condition lenses for
// the protocol corpus (oip-*, nogo-*, udst-*, paper-*, governance, philosophy).
const AI_FAMILIES = [
  { id: 'oip', label: 'OIP protocol', test: (s) => s.startsWith('oip-') || s === 'oip' || s.includes('object-invocation') || s.includes('compliance-oracle') },
  { id: 'nogo', label: 'NO-GO constraints', test: (s) => s.startsWith('nogo-') || s.includes('-nogo-') },
  { id: 'udst', label: 'UDST doctrine', test: (s) => s.startsWith('udst-') },
  { id: 'paper', label: 'Source papers', test: (s) => s.startsWith('paper-') },
  { id: 'governance', label: 'Governance & assurance', test: (s) => s.includes('governance') || s.includes('assurance') || s.includes('killbox') || s.includes('ledger') },
  { id: 'philosophy', label: 'Philosophy', test: (s, subj) => /philosoph|grain|convergence|unified|civilization|automata|von-neumann/i.test(`${s} ${subj}`) },
];
function aiFamiliesFor(slug, subject) {
  const s = String(slug || '').toLowerCase();
  const out = [];
  for (const f of AI_FAMILIES) { try { if (f.test(s, subject || '')) out.push(f.id); } catch { /* skip */ } }
  return [...new Set(out)];
}

function hay(slug, title, subject) {
  return `${slug} ${title} ${subject}`.toLowerCase().replace(/[×]/g, ' ');
}

function peptidesIn(text, slug) {
  const found = [];
  for (const id of PEPTIDE_IDS) {
    if (slug === id || slug.startsWith(`${id}-`) || slug.includes(`-${id}-`) || slug.endsWith(`-${id}`)) {
      found.push(id);
    }
  }
  if (slug.includes('stack')) {
    for (const id of PEPTIDE_IDS) {
      const parts = id.split('-');
      if (parts.every((p) => text.includes(p)) && !found.includes(id)) found.push(id);
    }
  }
  return [...new Set(found)];
}

function matchLex(lex, text, slug) {
  const hits = [];
  for (const item of lex) {
    if (item.tokens.some((t) => text.includes(t.replace(/-/g, ' ')) || slug.includes(t))) hits.push(item.id);
  }
  return [...new Set(hits)];
}

function conditionFromSlug(slug, peptides) {
  let rest = slug;
  for (const p of [...peptides].sort((a, b) => b.length - a.length)) {
    if (rest.startsWith(`${p}-`)) rest = rest.slice(p.length + 1);
    else if (rest === p) rest = '';
  }
  if (!rest || rest === 'stack' || rest.includes('stack')) return null;
  return rest.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function countTiers(claims) {
  const tiers = { human: 0, preclinical: 0, mechanistic: 0, anecdotal: 0, speculative: 0, system: 0 };
  for (const c of claims || []) {
    const t = String(c.tier || '').toLowerCase();
    if (tiers[t] !== undefined) tiers[t]++;
  }
  return tiers;
}

function evidenceScore(tiers, sources) {
  return (tiers.human || 0) * 10 + (tiers.preclinical || 0) * 4 + (tiers.mechanistic || 0) * 2
    + (tiers.anecdotal || 0) + (sources || 0) * 0.5;
}

function indexBucket(map, id, label, extra, slug) {
  if (!map.has(id)) {
    map.set(id, { id, label, ...extra, articles: [], peptides: new Set(), drugs: new Set(), tiers: { human: 0, preclinical: 0, mechanistic: 0, anecdotal: 0, speculative: 0, system: 0 }, sources: 0 });
  }
  const b = map.get(id);
  if (!b.articles.includes(slug)) b.articles.push(slug);
  return b;
}

export async function buildExplorerData(env) {
  const rows = await env.DB.prepare(
    "SELECT slug, title, COALESCE(subject, '') AS subject, meta FROM articles WHERE published = 1 ORDER BY slug ASC",
  ).all();

  const articles = [];
  const peptideMap = new Map();
  const conditionMap = new Map();
  const drugMap = new Map();
  const governanceMap = new Map();
  const corpusTiers = { human: 0, preclinical: 0, mechanistic: 0, anecdotal: 0, speculative: 0, system: 0 };
  let totalSources = 0;

  for (const row of rows.results || []) {
    const text = hay(row.slug, row.title, row.subject);
    const meta = parseArticleMeta(row.meta);
    const claims = (meta.claims || []).filter((c) => !c.status || c.status === 'active' || c.status === 'downweighted');
    const tiers = countTiers(claims);
    const sources = (meta.sources || []).length;
    totalSources += sources;

    for (const k of Object.keys(corpusTiers)) corpusTiers[k] += tiers[k] || 0;

    const peptides = peptidesIn(text, row.slug);
    const drugs = matchLex(DRUG_LEX, text, row.slug);
    const aiFamilies = peptides.length ? [] : aiFamiliesFor(row.slug, row.subject);
    let conditions = matchLex(CONDITION_LEX, text, row.slug);
    const derived = conditionFromSlug(row.slug, peptides);
    if (derived && !conditions.length) {
      const id = derived.toLowerCase().replace(/\s+/g, '-').slice(0, 48);
      conditions = [id];
      indexBucket(conditionMap, id, derived, { group: 'other', nerve: /nerve|neuropathy|carpal|sciatica|trigeminal/i.test(derived) }, row.slug);
    }

    const art = {
      slug: row.slug,
      title: row.title || row.slug,
      subject: row.subject || '',
      peptides,
      conditions,
      drugs,
      governance: aiFamilies,
      tiers,
      sources,
      claims: claims.length,
      score: evidenceScore(tiers, sources),
      nerve: conditions.some((c) => {
        const lex = CONDITION_LEX.find((x) => x.id === c);
        return lex?.nerve || /nerve|neuropathy|carpal|sciatica|trigeminal|postherpetic/i.test(text);
      }),
    };
    articles.push(art);

    for (const p of peptides) {
      const b = indexBucket(peptideMap, p, PEPTIDE_LABEL[p] || p, { kind: 'peptide' }, row.slug);
      for (const k of Object.keys(b.tiers)) b.tiers[k] += tiers[k] || 0;
      b.sources += sources;
    }
    for (const c of conditions) {
      const lex = CONDITION_LEX.find((x) => x.id === c);
      const b = indexBucket(conditionMap, c, lex?.label || c.replace(/-/g, ' '), { group: lex?.group || 'other', nerve: !!lex?.nerve }, row.slug);
      for (const k of Object.keys(b.tiers)) b.tiers[k] += tiers[k] || 0;
      b.sources += sources;
      peptides.forEach((p) => b.peptides.add(p));
      drugs.forEach((d) => b.drugs.add(d));
    }
    for (const d of drugs) {
      const lex = DRUG_LEX.find((x) => x.id === d);
      const b = indexBucket(drugMap, d, lex?.label || d, { kind: 'drug' }, row.slug);
      for (const k of Object.keys(b.tiers)) b.tiers[k] += tiers[k] || 0;
      b.sources += sources;
      peptides.forEach((p) => b.peptides.add(p));
    }
    for (const f of aiFamilies) {
      const lex = AI_FAMILIES.find((x) => x.id === f);
      const b = indexBucket(governanceMap, f, lex?.label || f, { kind: 'governance' }, row.slug);
      for (const k of Object.keys(b.tiers)) b.tiers[k] += tiers[k] || 0;
      b.sources += sources;
    }
  }

  const serialize = (map) => [...map.values()].map((b) => ({
    id: b.id,
    label: b.label,
    group: b.group,
    nerve: b.nerve,
    kind: b.kind,
    articles: b.articles,
    peptides: [...b.peptides],
    drugs: [...(b.drugs || [])],
    tiers: b.tiers,
    sources: b.sources,
    human: b.tiers.human || 0,
    score: evidenceScore(b.tiers, b.sources),
  })).sort((a, b) => b.human - a.human || b.articles.length - a.articles.length);

  return {
    stats: {
      articles: articles.length,
      peptides: peptideMap.size,
      conditions: conditionMap.size,
      drugs: drugMap.size,
      claims: articles.reduce((s, a) => s + a.claims, 0),
      sources: totalSources,
      nerve_articles: articles.filter((a) => a.nerve).length,
      ai_articles: articles.filter((a) => (a.governance || []).length).length,
      ai_families: governanceMap.size,
      ...corpusTiers,
    },
    articles,
    peptides: serialize(peptideMap),
    conditions: serialize(conditionMap),
    drugs: serialize(drugMap),
    governance: serialize(governanceMap),
    evidence: {
      tiers: corpusTiers,
      leaderboard: [...articles].sort((a, b) => b.tiers.human - a.tiers.human || b.score - a.score).slice(0, 80),
    },
    groups: CONDITION_GROUPS,
    tierMeta: { order: TIER_ORDER, label: TIER_LABEL, color: TIER_COLOR },
  };
}



const ACRONYMS = new Set([
  'ara', 'bpc', 'tb', 'ghk', 'dsip', 'pt', 'aod', 'glp', 'nad', 'vip', 'ss', 'mk',
]);

export function slugDisplayTitle(slug, title) {
  const s = String(slug || '').toLowerCase();
  const t = String(title || '').trim();
  const looksRaw =
    !t ||
    t.toLowerCase() === s ||
    (t.length < 48 && /^[a-z0-9][a-z0-9\s.\-–—×x]+$/i.test(t) && !/[A-Z]{2,}/.test(t));
  if (!looksRaw) return t.length > 72 ? t.slice(0, 70).trimEnd() + '…' : t;

  let stem = s;
  for (const p of PEPTIDE_IDS) {
    if (stem === p) {
      return PEPTIDE_LABEL[p] || p.replace(/-/g, ' ').toUpperCase();
    }
    if (stem.startsWith(`${p}-`)) {
      stem = stem.slice(p.length + 1);
      break;
    }
  }
  if (!stem) return t || s;
  return stem
    .split('-')
    .filter(Boolean)
    .map((w) =>
      ACRONYMS.has(w)
        ? w.toUpperCase()
        : w.replace(/\d+/g, (n) => n)
            .replace(/^./, (c) => c.toUpperCase()),
    )
    .join(' ')
    .replace(/\bGlp\b/g, 'GLP')
    .replace(/\bNsaid\b/g, 'NSAID')
    .replace(/\bVs\b/g, 'vs');
}

export function forwardMapLabel(ctx) {
  if (!ctx?.show) return '';
  if (ctx.mode === 'peptide' && ctx.peptides?.length) {
    const p = ctx.peptides[0];
    return `${PEPTIDE_LABEL[p] || p} · peptide map`;
  }
  if (ctx.mode === 'condition' && ctx.selected) {
    const c = CONDITION_LEX.find((x) => x.id === ctx.selected);
    return `${c?.label || ctx.selected} · condition map`;
  }
  if (ctx.mode === 'drug' && ctx.selected) {
    const d = DRUG_LEX.find((x) => x.id === ctx.selected);
    return `${d?.label || ctx.selected} · drug map`;
  }
  return 'Evidence map';
}

export function graphFocusForArticle(data, slug) {
  const art = data.articles.find((a) => a.slug === slug);
  if (!art) return { show: false };
  if (slug.startsWith('protocol')) return { show: false };
  let mode = 'peptide';
  let selected = null;
  if (art.peptides.length === 1 && slug === art.peptides[0]) {
    mode = 'peptide';
    selected = art.peptides[0];
  } else if (art.drugs.length && /vs|comparison|metformin|gabapentin|glp|nsaid|ppi|statin|benzo/i.test(slug + art.title)) {
    mode = 'drug';
    selected = art.drugs[0];
  } else if (art.conditions.length) {
    mode = 'condition';
    selected = art.conditions[0];
  } else if (art.peptides.length) {
    mode = 'peptide';
    selected = art.peptides[0];
  }
  return {
    show: true,
    slug,
    mode,
    selected,
    nerve: art.nerve,
    human: art.tiers.human || 0,
    peptides: art.peptides,
  };
}

export function graphForwardLinks(data, slug, limit = 12) {
  const art = data.articles.find((a) => a.slug === slug);
  if (!art) return [];
  const seen = new Set([slug]);
  const out = [];
  const push = (s, reason) => {
    if (!s || seen.has(s)) return;
    const a = data.articles.find((x) => x.slug === s);
    if (!a) return;
    seen.add(s);
    out.push({
      slug: s,
      title: slugDisplayTitle(s, a.title),
      reason,
      human: a.tiers.human || 0,
    });
  };
  for (const p of art.peptides) {
    const hub = data.peptides.find((x) => x.id === p);
    if (hub) {
      for (const s of hub.articles) {
        if (s !== slug) push(s, 'same peptide map');
        if (out.length >= limit) return out;
      }
    }
    if (slug !== p) push(p, 'root primer');
  }
  for (const c of art.conditions) {
    const hub = data.conditions.find((x) => x.id === c);
    if (hub) {
      for (const s of hub.articles) {
        if (s !== slug) push(s, 'same condition map');
        if (out.length >= limit) return out;
      }
    }
  }
  for (const d of art.drugs) {
    const hub = data.drugs.find((x) => x.id === d);
    if (hub) {
      for (const s of hub.articles) {
        if (s !== slug) push(s, 'crosses ' + (hub.label || d));
        if (out.length >= limit) return out;
      }
    }
  }
  for (const c of art.conditions) {
    const hub = data.conditions.find((x) => x.id === c);
    if (!hub) continue;
    for (const d of hub.drugs || []) {
      const drugHub = data.drugs.find((x) => x.id === d);
      if (!drugHub) continue;
      for (const s of drugHub.articles.slice(0, 3)) {
        push(s, 'drug map · ' + (drugHub.label || d));
        if (out.length >= limit) return out;
      }
    }
  }
  data.articles
    .filter((a) => a.slug !== slug && a.peptides.some((p) => art.peptides.includes(p)))
    .sort((a, b) => (b.tiers.human || 0) - (a.tiers.human || 0))
    .slice(0, 4)
    .forEach((a) => push(a.slug, 'high human evidence'));
  if (out.length < limit && art.conditions.length) {
    data.evidence.leaderboard
      .filter((a) => a.slug !== slug && a.conditions.some((c) => art.conditions.includes(c)))
      .slice(0, 4)
      .forEach((a) => push(a.slug, 'top evidence · shared condition'));
  }
  return out.slice(0, limit);
}

export async function buildArticleGraphContext(env, slug) {
  const data = await buildExplorerData(env);
  const focus = graphFocusForArticle(data, slug);
  const forward = graphForwardLinks(data, slug);
  return { ...focus, forward, stats: data.stats };
}
