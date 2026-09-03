#!/usr/bin/env node
// Generated projections only: semantic content remains in the canonical object.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { designLawSkillMarkdown } from "../functions/_lib/design_law_object.js";
import { writingLawSkillMarkdown } from "../functions/_lib/writing_law_object.js";
import { skillLawSkillMarkdown } from "../functions/_lib/skill_law_object.js";
import { oipSkillMarkdown } from "../functions/_lib/article_skill.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const projections = [
  {
    object: "kao:design-law",
    target: resolve(root, ".claude/skills/design-law/SKILL.md"),
    render: designLawSkillMarkdown,
  },
  {
    object: "kao:design-law",
    target: resolve(root, ".agents/skills/design-law/SKILL.md"),
    render: designLawSkillMarkdown,
  },
  {
    object: "kao:writing-law",
    target: resolve(root, ".claude/skills/writing-law/SKILL.md"),
    render: writingLawSkillMarkdown,
  },
  {
    object: "kao:writing-law",
    target: resolve(root, ".agents/skills/writing-law/SKILL.md"),
    render: writingLawSkillMarkdown,
  },
  {
    object: "article:oip",
    target: resolve(root, ".claude/skills/oip/SKILL.md"),
    render: oipSkillMarkdown,
  },
  // skill-law projects into BOTH runtime trees (its own S08: both trees or neither).
  {
    object: "kao:skill-law",
    target: resolve(root, ".claude/skills/skill-law/SKILL.md"),
    render: skillLawSkillMarkdown,
  },
  {
    object: "kao:skill-law",
    target: resolve(root, ".agents/skills/skill-law/SKILL.md"),
    render: skillLawSkillMarkdown,
  },
];

for (const projection of projections) {
  const expected = projection.render();
  await mkdir(dirname(projection.target), { recursive: true });
  const current = await readFile(projection.target, "utf8").catch(() => "");
  if (current !== expected)
    await writeFile(projection.target, expected, "utf8");
  const verified = await readFile(projection.target, "utf8");
  if (verified !== expected)
    throw new Error(`projection_drift:${projection.object}`);
  console.log(
    `synced ${projection.object} -> ${projection.target.slice(root.length + 1)}`,
  );
}
