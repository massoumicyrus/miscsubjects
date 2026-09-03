// CharlieOS audit engine — evidence retrieval + prosecutor/critic loop.
// The engine is stateless except for the DB/KV/AI bindings it receives.

import { dispatch } from '../api/dispatch.js';
import { logEvent } from './event_log.js';

const STOP_WORDS = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','shall','can','need','dare','ought','used','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','under','and','but','or','yet','so','if','because','although','though','while','where','when','that','which','who','whom','whose','what','this','these','those','i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their','mine','yours','hers','ours','theirs','all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','than','too','very','just','now','also','get','got','does','did','how','why','where','here','there','then','than']);

function nowIso() { return new Date().toISOString(); }

async function sha256(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function hashKey(key) {
  return sha256(key);
}

export function publicId(claim, ts) {
  const raw = String(ts) + '|' + String(claim).slice(0, 400);
  return sha256(raw).then(h => h.slice(0, 12));
}

function tokenize(text) {
  return String(text || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function uniqueKeywords(text) {
  const arr = tokenize(text);
  return [...new Set(arr)].slice(0, 8);
}

function matchesAny(haystack, keywords) {
  const h = String(haystack || '').toLowerCase();
  return keywords.some(k => h.includes(k));
}

// Pull related articles and their sources from the graph.
async function gatherEvidence(env, claim) {
  const keywords = uniqueKeywords(claim);
  if (!keywords.length) return { articles: [], keywords: [] };

  const like = keywords.map(k => `%${k}%`);
  const conditions = keywords.map(() => '(LOWER(title) LIKE ? OR LOWER(body) LIKE ?)').join(' OR ');
  const binds = [];
  for (const k of keywords) binds.push(`%${k}%`, `%${k}%`);

  const rows = (await env.DB.prepare(
    `SELECT slug, title, body, meta FROM articles WHERE published=1 AND (${conditions}) ORDER BY updated_at DESC LIMIT 6`
  ).bind(...binds).all()).results || [];

  const articles = [];
  for (const r of rows) {
    let meta = {}; try { meta = JSON.parse(r.meta || '{}'); } catch {}
    const sources = (meta.sources || []).filter(s =>
      matchesAny(s.title + ' ' + s.quote + ' ' + s.summary + ' ' + s.url, keywords)
    ).slice(0, 4);
    const claims = (meta.claims || []).filter(c =>
      matchesAny(c.text + ' ' + c.section, keywords)
    ).slice(0, 3).map(c => ({ text: c.text, tier: c.tier, id: c.id }));

    const excerpt = String(r.body || '').replace(/[#*`>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 360);
    if (sources.length || claims.length) {
      articles.push({ slug: r.slug, title: r.title, excerpt, claims, sources });
    }
  }

  return { keywords, articles: articles.slice(0, 5) };
}

// Call an agent via dispatch; returns the raw text.
async function callAgent(env, key, input, traceLabel) {
  try {
    const r = await dispatch(env, key, input, { actor: 'charlie', trace: traceLabel });
    if (r.result && typeof r.result === 'object') return JSON.stringify(r.result);
    return String(r.result || '');
  } catch (e) {
    return 'ERR:agent:' + (e?.message || String(e));
  }
}

function parseVerdict(text) {
  const s = String(text || '').trim();
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const verdict = String(j.verdict || '').toLowerCase();
    if (!['true','misleading','false','insufficient'].includes(verdict)) return null;
    return {
      verdict,
      confidence: Math.max(0, Math.min(100, Number(j.confidence) || 0)),
      reasoning: String(j.reasoning || '').slice(0, 900),
      source_ids: Array.isArray(j.source_ids) ? j.source_ids.map(String) : [],
    };
  } catch { return null; }
}

// Main synchronous audit.
export async function runAudit(env, claim, context) {
  const ts = nowIso();
  const trace = 'charlie_' + (await sha256(ts + claim)).slice(0, 12);

  const evidence = await gatherEvidence(env, claim);

  if (!evidence.articles.length) {
    const out = {
      verdict: 'insufficient',
      confidence: 0,
      reasoning: 'No matching articles or sources were found in the graph for this claim. Charlie needs evidence before it can prosecute.',
      evidence: [],
      source_ids: [],
    };
    out.ledger_hash = (await sha256(JSON.stringify(out))).slice(0, 24);
    await logEvent(env, { ts, source: 'charlie', key: 'AUDIT', action: 'insufficient', trace_id: trace, request: claim, response: JSON.stringify(out) });
    return out;
  }

  const prosecutorInput = JSON.stringify({ claim, context: context || '', evidence });
  const prosecutorRaw = await callAgent(env, 'CHARLIE_PROSECUTOR', prosecutorInput, trace);
  let verdict = parseVerdict(prosecutorRaw);
  if (!verdict) {
    verdict = {
      verdict: 'insufficient',
      confidence: 0,
      reasoning: 'The prosecutor did not return a parseable verdict. Raw output: ' + prosecutorRaw.slice(0, 300),
      source_ids: [],
    };
  }

  const criticInput = JSON.stringify({ claim, prosecutor_verdict: verdict, evidence });
  const criticRaw = await callAgent(env, 'CHARLIE_CRITIC', criticInput, trace + '_critic');
  const critic = parseVerdict(criticRaw);
  if (critic) {
    // Critic can only downgrade or keep the same confidence/verdict.
    const severity = { true: 0, insufficient: 1, misleading: 2, false: 3 };
    if (severity[critic.verdict] > severity[verdict.verdict]) {
      verdict.verdict = critic.verdict;
      verdict.confidence = Math.min(verdict.confidence, critic.confidence);
      verdict.reasoning = critic.reasoning || verdict.reasoning;
      verdict.source_ids = critic.source_ids.length ? critic.source_ids : verdict.source_ids;
    } else if (critic.confidence < verdict.confidence) {
      verdict.confidence = critic.confidence;
    }
  }

  const flatSources = evidence.articles.flatMap(a => a.sources);
  const out = {
    verdict: verdict.verdict,
    confidence: verdict.confidence,
    reasoning: verdict.reasoning,
    evidence: evidence.articles,
    source_ids: verdict.source_ids,
    keywords: evidence.keywords,
  };

  out.ledger_hash = (await sha256(JSON.stringify(out))).slice(0, 24);
  await logEvent(env, { ts, source: 'charlie', key: 'AUDIT', action: 'verdict', trace_id: trace, request: claim, response: JSON.stringify(out) });
  return out;
}

export { sha256, nowIso, gatherEvidence };
