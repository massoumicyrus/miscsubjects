import { createHash } from 'node:crypto';
import { opendir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.wrangler', '.cache', '.venv', '.venv-browser-use']);
const SKIP_FILES = new Set(['package-lock.json', 'npm-shrinkwrap.json']);
const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const CREDENTIAL_RULES = [
  ['anthropic_api_key', /sk-ant-(?:api\d+-)?[A-Za-z0-9_-]{20,}/g],
  ['openai_api_key', /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g],
  ['github_token', /(?:github_pat_[A-Za-z0-9_]{20,}|gh[oprsu]_[A-Za-z0-9]{30,})/g],
  ['aws_access_key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['google_api_key', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ['slack_token', /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/g],
  ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];

function fingerprint(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function lineNumber(text, offset) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) if (text.charCodeAt(index) === 10) line += 1;
  return line;
}

async function filesUnder(target) {
  const info = await stat(target);
  if (info.isFile()) return [target];
  if (!info.isDirectory()) return [];
  const files = [];
  const directory = await opendir(target);
  for await (const entry of directory) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(child));
    else if (entry.isFile() && !SKIP_FILES.has(entry.name)) files.push(child);
  }
  return files;
}

function findingsInText(text, file, secretValues) {
  const findings = [];
  for (const [rule, pattern] of CREDENTIAL_RULES) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = match[0];
      if (value.includes('<') || value.includes('${')) continue;
      findings.push({
        file,
        line: lineNumber(text, match.index),
        rule,
        fingerprint: fingerprint(value),
      });
    }
  }
  for (const secret of secretValues) {
    if (!secret.value || secret.value.length < 16) continue;
    let offset = text.indexOf(secret.value);
    while (offset >= 0) {
      findings.push({
        file,
        line: lineNumber(text, offset),
        rule: `known_secret:${secret.name}`,
        fingerprint: fingerprint(secret.value),
      });
      offset = text.indexOf(secret.value, offset + secret.value.length);
    }
  }
  return findings;
}

export async function scanPaths(paths, { secretValues = [] } = {}) {
  const findings = [];
  let filesScanned = 0;
  let bytesScanned = 0;
  for (const target of paths) {
    for (const file of await filesUnder(path.resolve(target))) {
      const info = await stat(file);
      if (info.size > MAX_FILE_BYTES) continue;
      const bytes = await readFile(file);
      if (bytes.includes(0)) continue;
      const text = bytes.toString('utf8');
      filesScanned += 1;
      bytesScanned += bytes.length;
      findings.push(...findingsInText(text, file, secretValues));
    }
  }
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    pass: findings.length === 0,
    files_scanned: filesScanned,
    bytes_scanned: bytesScanned,
    findings,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const targets = process.argv.slice(2);
  if (!targets.length) {
    process.stderr.write('Usage: node scripts/scan-v2-secrets.mjs <path...>\n');
    process.exitCode = 2;
  } else {
    const secretValues = Object.entries(process.env)
      .filter(([name, value]) => /(TOKEN|SECRET|API_KEY|PRIVATE_KEY)/i.test(name) && String(value || '').length >= 16)
      .map(([name, value]) => ({ name, value: String(value) }));
    const report = await scanPaths(targets, { secretValues });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.pass) process.exitCode = 1;
  }
}
