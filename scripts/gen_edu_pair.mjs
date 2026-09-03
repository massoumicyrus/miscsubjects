#!/usr/bin/env node
/** Generate topic-illustrating edu viral meme pair (content-first, NOT product ads). */
import {
  illustrationBriefFromProse,
  topicMemePair,
} from '../functions/_lib/article_visual.js';

const TERMINAL_KEY = process.env.TERMINAL_KEY;
const BASE = process.env.BASE || 'https://miscsubjects.com';

if (!TERMINAL_KEY) {
  console.error('Set TERMINAL_KEY');
  process.exit(1);
}

const slug = process.argv[2] || 'cognitive-stack-adderall-insomnia';

async function fetchArticle(slug) {
  const r = await fetch(`${BASE}/api/articles/${slug}`, {
    headers: { 'x-terminal-key': TERMINAL_KEY },
  });
  if (!r.ok) throw new Error(`article ${slug}: ${r.status}`);
  return r.json();
}

async function gen(label, prompt) {
  console.log(`\n--- ${label} ---`);
  const r = await fetch(`${BASE}/api/dispatch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-terminal-key': TERMINAL_KEY },
    body: JSON.stringify({ key: 'GROK_IMAGE_R2', body: prompt }),
  });
  const j = await r.json();
  let parsed;
  try { parsed = JSON.parse(j.result); } catch { parsed = { raw: j.result }; }
  console.log(parsed.url || parsed);
  return parsed;
}

const art = await fetchArticle(slug);
let meta = {};
try { meta = JSON.parse(art.meta || '{}'); } catch {}
const brief = illustrationBriefFromProse(slug, art.title, meta.claims, meta.sources);
const pair = topicMemePair(brief);
if (!pair) throw new Error('no illustration brief');

console.log('Brief:', JSON.stringify(brief.sections, null, 2));

const a = await gen('meme-a (topic hook)', pair.slide_a);
const b = pair.slide_b ? await gen('meme-b (topic deepen)', pair.slide_b) : null;

console.log('\n=== TOPIC MEME PAIR ===');
console.log(JSON.stringify({ slug, meme_a: a?.url, meme_b: b?.url }, null, 2));