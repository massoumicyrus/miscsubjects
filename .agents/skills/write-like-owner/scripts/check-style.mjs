#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const source = process.argv[2]
  ? await readFile(process.argv[2], 'utf8')
  : await new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => { data += chunk; });
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', reject);
    });

const checks = [
  ['obligation', /\b(?:you|we) (?:must|need to|should|have to)\b/gi],
  ['compliance', /\b(?:make sure|ensure that|it is (?:required|important))\b/gi],
  ['prompt-obligation', /\b(?:required (?:answer|output|response)|requirements?|must|should|need to|ensure|do not|don't|never)\b/gi],
  ['permission-seeking', /\b(?:your call|if you want|would you like|want me to|say the word|I can)\b/gi],
  ['assistant-theater', /\b(?:I(?:'|’)ll|I will|let me|going to|happy to|feel free|hope this helps|let me know|got it|any other questions)\b/gi],
  ['absolute-scolding', /\b(?:you always|you never|always ensure|never forget|the only way|exactly one way)\b/gi],
  ['hidden-web-link', /\[[^\]]+\]\(https?:\/\/[^)]+\)/gi],
  ['psychological-substitution', /\b(?:validation[- ]seeking|the loop itself is the problem|accurate answer.*(?:won't|will not|doesn't|does not) stick|stop re-auditing|step(?:ping)? back from the build|talk(?:ing)? this through with a person)\b/gi],
  ['invented-rank', /\btop\s+\d+(?:\.\d+)?%(?!\w)/gi],
  ['decorative-certainty', /\bthis is not (?:a |an )?[a-z][a-z .'’-]*?\. (?:it is|this is) [a-z][a-z .'’-]*?\./gi],
];

const findings = [];
for (const [kind, pattern] of checks) {
  for (const match of source.matchAll(pattern)) {
    const before = source.slice(0, match.index);
    const line = before.split('\n').length;
    findings.push({ kind, line, text: match[0] });
  }
}

if (!findings.length) {
  console.log('style-pass');
  process.exit(0);
}

for (const finding of findings) {
  console.log(`${finding.kind}:${finding.line}: ${finding.text}`);
}
process.exit(1);
