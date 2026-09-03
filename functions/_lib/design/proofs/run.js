#!/usr/bin/env node
// Run all design proofs. Exit non-zero on violation.

import fs from "node:fs";
import path from "node:path";
import { tokenConformance } from "./token-conformance.js";
import { assertDependencyDirection } from "./dependency-direction.js";

const root = path.resolve(process.cwd(), "functions/_lib/design");
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith(".js")) files.push(p);
  }
}
walk(root);

let errors = 0;
for (const f of files) {
  const code = fs.readFileSync(f, "utf8");
  const imports = [];
  const importRe = /import\s+.*?\s+from\s+["']([^"']+)["']/g;
  let m;
  while ((m = importRe.exec(code)) !== null) imports.push(m[1]);
  const relative = path.relative(process.cwd(), f);
  try {
    assertDependencyDirection(relative, imports);
  } catch (e) {
    console.error(e.message);
    errors++;
  }
}

if (errors) {
  console.error(`\n${errors} dependency direction violation(s)`);
  process.exit(1);
}
console.log("✓ dependency-direction");

try {
  tokenConformance(`${process.cwd()}/public/assets/design-system.css`);
  console.log("✓ token-conformance");
} catch (e) {
  console.error("✗ token-conformance:", e.message);
  process.exit(1);
}

console.log("All design proofs passed.");
