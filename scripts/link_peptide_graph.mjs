#!/usr/bin/env node
// Wire cross-links between peptide articles: meta.embeds + [[embed:slug]] + markdown links.
// Run: node scripts/link_peptide_graph.mjs

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

const PEPTIDE_SLUGS = {
  'bpc-157': 'BPC-157',
  'tb-500': 'TB-500',
  'ara-290': 'ARA-290',
  'semax': 'Semax',
  'selank': 'Selank',
  'pt-141': 'PT-141',
  'dsip': 'DSIP',
  'kpv': 'KPV',
  'ghk-cu': 'GHK-Cu',
  'thymosin-alpha-1': 'Thymosin Alpha-1',
};

const STACK_LINKS = {
  'wolverine-stack-glp1': ['bpc-157', 'tb-500'],
  'recovery-stack-intro': ['bpc-157', 'tb-500', 'ara-290'],
  'recovery-stack-herniated-disc': ['bpc-157', 'tb-500', 'ara-290', 'recovery-stack-intro'],
  'recovery-stack-sciatica': ['recovery-stack-herniated-disc', 'ara-290-sciatica'],
  'recovery-stack-back-pain': ['recovery-stack-intro'],
  'recovery-stack-gabapentin': ['recovery-stack-intro', 'ara-vs-gabapentin-comparison'],
  'recovery-stack-opioid-taper': ['recovery-stack-intro'],
  'recovery-stack-diabetic-neuropathy': ['recovery-stack-intro', 'ara-290-diabetic-neuropathy'],
  'aging-stack-intro': ['bpc-157', 'tb-500', 'ghk-cu'],
  'aging-stack-joint-degeneration': ['aging-stack-intro'],
  'adderall-stack-intro': ['semax', 'selank', 'bpc-157'],
  'cognitive-stack-intro': ['semax', 'dsip', 'selank'],
  'cognitive-stack-adderall-insomnia': ['cognitive-stack-intro', 'dsip-adderall-insomnia'],
  'semax-selank-adderall': ['semax', 'selank'],
  'pt-141-selank-ssri': ['pt-141', 'selank'],
  'bpc-ara-herniated-disc': ['bpc-157', 'ara-290', 'ara-290-herniated-disc'],
  'bpc-ara-post-surgical-nerve': ['bpc-157', 'ara-290'],
  'bpc-ara-corticosteroid': ['bpc-157', 'ara-290'],
  'bpc-kpv-gut-repair': ['bpc-157', 'kpv'],
  'bpc-kpv-ibd-crohns-colitis': ['bpc-kpv-gut-repair', 'bpc-157-ibd-crohns-colitis'],
  'bpc-kpv-ppi': ['bpc-kpv-gut-repair', 'bpc-157-ppi'],
};

function peptidesInSlug(slug) {
  const found = [];
  for (const ps of Object.keys(PEPTIDE_SLUGS)) {
    if (slug === ps || slug.startsWith(ps + '-') || slug.includes(ps.replace('-', ''))) found.push(ps);
    if (slug.includes(ps)) found.push(ps);
  }
  if (slug.includes('bpc')) found.push('bpc-157');
  if (slug.includes('tb-500') || slug.includes('tb500') || slug.includes('wolverine')) found.push('tb-500');
  if (slug.includes('ara')) found.push('ara-290');
  if (slug.includes('semax')) found.push('semax');
  if (slug.includes('selank')) found.push('selank');
  if (slug.includes('pt-141') || slug.includes('pt141')) found.push('pt-141');
  if (slug.includes('dsip')) found.push('dsip');
  if (slug.includes('kpv')) found.push('kpv');
  if (slug.includes('ghk')) found.push('ghk-cu');
  if (slug.includes('thymosin')) found.push('thymosin-alpha-1');
  return [...new Set(found)];
}

function relatedSlugs(slug) {
  const set = new Set(peptidesInSlug(slug));
  for (const ps of peptidesInSlug(slug)) set.add(ps);
  for (const s of STACK_LINKS[slug] || []) set.add(s);
  set.delete(slug);
  return [...set].slice(0, 6);
}

function sqlEsc(s) {
  return String(s || '').replace(/'/g, "''");
}

function linkBlock(slugs) {
  if (!slugs.length) return '';
  const lines = slugs.map((s) => {
    const label = PEPTIDE_SLUGS[s] || s.replace(/-/g, ' ');
    return `[${label}](/a/${s})`;
  });
  const embeds = slugs.map((s) => `[[embed:${s}]]`).join('\n\n');
  return `\n\n---\n\nRelated:\n${lines.join(' · ')}\n\n${embeds}`;
}

function d1Exec(sql) {
  const tmp = join(__dir, '.link_graph.sql');
  writeFileSync(tmp, sql);
  try {
    execSync('npx wrangler d1 execute loop-content-spine --remote --file=' + tmp, {
      cwd: join(__dir, '..'),
      stdio: 'pipe',
      env: { ...process.env, CLOUDFLARE_API_TOKEN: '' },
    });
    return true;
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

function main() {
  const map = JSON.parse(readFileSync(join(__dir, 'content_map_57.json'), 'utf8'));
  const allSlugs = [...Object.keys(PEPTIDE_SLUGS), ...map.map((x) => x.slug)];
  const stmts = [];

  for (const slug of allSlugs) {
    const related = relatedSlugs(slug);
    if (!related.length) continue;
    const block = linkBlock(related);
    const metaPatch = JSON.stringify({ embeds: related });
    stmts.push(
      `UPDATE articles SET body = CASE WHEN body LIKE '%[[embed:${sqlEsc(related[0])}]]%' THEN body ELSE body || '${sqlEsc(block)}' END, meta = json_patch(COALESCE(meta,'{}'), '${sqlEsc(metaPatch)}'), updated_at = datetime('now') WHERE slug = '${sqlEsc(slug)}';`,
    );
  }

  d1Exec(stmts.join('\n'));
  console.log('Linked ' + stmts.length + ' articles with peptide cross-references.');
}

main();