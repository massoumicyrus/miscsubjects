import { execFileSync } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CREDENTIAL_RULES } from './scan-v2-secrets.mjs';

export function redactText(input, { secretValues = [] } = {}) {
  let text = String(input);
  let replacements = 0;
  const rules = {};
  const record = (rule, count) => {
    if (!count) return;
    replacements += count;
    rules[rule] = (rules[rule] || 0) + count;
  };
  for (const secret of secretValues) {
    if (!secret.value || secret.value.length < 16 || !text.includes(secret.value)) continue;
    const parts = text.split(secret.value);
    const count = parts.length - 1;
    const rule = `known_secret:${secret.name}`;
    text = parts.join(`[REDACTED:${rule}]`);
    record(rule, count);
  }
  for (const [rule, pattern] of CREDENTIAL_RULES) {
    pattern.lastIndex = 0;
    let count = 0;
    text = text.replace(pattern, (value) => {
      if (value.includes('<') || value.includes('${')) return value;
      count += 1;
      return `[REDACTED:${rule}]`;
    });
    record(rule, count);
  }
  return { text, replacements, rules };
}

async function redactTrackedRepo(repo, secretValues) {
  const raw = execFileSync('git', ['-C', repo, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const changed = [];
  const rules = {};
  let replacements = 0;
  for (const relative of raw.split('\0').filter(Boolean)) {
    const file = path.join(repo, relative);
    const info = await stat(file);
    if (!info.isFile() || info.size > 10 * 1024 * 1024) continue;
    const bytes = await readFile(file);
    if (bytes.includes(0)) continue;
    const result = redactText(bytes.toString('utf8'), { secretValues });
    if (!result.replacements) continue;
    await writeFile(file, result.text);
    changed.push(relative);
    replacements += result.replacements;
    for (const [rule, count] of Object.entries(result.rules)) rules[rule] = (rules[rule] || 0) + count;
  }
  return { repo, files_changed: changed, replacements, rules };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const [mode, ...targets] = process.argv.slice(2);
  if (!['--git-tracked', '--files'].includes(mode) || !targets.length) {
    process.stderr.write('Usage: node scripts/redact-v2-secrets.mjs --git-tracked <repo> | --files <file...>\n');
    process.exitCode = 2;
  } else {
    const secretValues = Object.entries(process.env)
      .filter(([name, value]) => /(TOKEN|SECRET|API_KEY|PRIVATE_KEY)/i.test(name) && String(value || '').length >= 16)
      .map(([name, value]) => ({ name, value: String(value) }));
    let report;
    if (mode === '--git-tracked') {
      report = await redactTrackedRepo(path.resolve(targets[0]), secretValues);
    } else {
      const filesChanged = [];
      const rules = {};
      let replacements = 0;
      for (const target of targets) {
        const file = path.resolve(target);
        const input = await readFile(file, 'utf8');
        const result = redactText(input, { secretValues });
        if (!result.replacements) continue;
        await writeFile(file, result.text);
        filesChanged.push(file);
        replacements += result.replacements;
        for (const [rule, count] of Object.entries(result.rules)) rules[rule] = (rules[rule] || 0) + count;
      }
      report = { files_changed: filesChanged, replacements, rules };
    }
    process.stdout.write(`${JSON.stringify({ ok: true, ...report }, null, 2)}\n`);
  }
}
