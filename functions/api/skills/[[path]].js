// Machine plane of the skills front. One identity per skill:
//   GET  /api/skills                       — index (public skills + laws pointers)
//   GET  /api/skills/<name>                — full skill object (+ stored version head when one exists)
//   GET  /api/skills/<name>/skill          — raw SKILL.md (stored current version first, registry fallback)
//   GET  /api/skills/<name>/v/<n>          — one exact stored version, hash-pinned
//   GET  /api/skills/<name>/evidence       — executions/acceptance per version, open comments (computed, never voted)
//   GET  /api/skills/<name>/bundle?format=zip|manifest — the skill as one folder
//   GET  /api/skills/bundle?format=zip|manifest        — every public skill as one folder
//   POST /api/skills/<name>/versions       — append a version (CAS: expected_hash) — owner / act-scope token
//
// STORAGE (spec Phase 1, migration 0357): skills are versioned, hashed D1 objects. The generated
// SKILL_REGISTRY constant remains the read fallback so nothing here breaks before the migration
// lands — but the stored head, when present, is authoritative for what the site serves and cites.
import { SKILL_REGISTRY, skillByName } from "../../_lib/skill_registry.js";
import { getSkillHead, getSkillVersion, listSkillVersions, appendSkillVersion, promoteSkillVersion, skillEvidence } from "../../_lib/skill_store.js";
import { isBuildAuthed, verifyShareToken, verifyShareTokenValue } from "../../_lib/admin_session.js";

function json(o, status = 200) {
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { "content-type": "application/json", "cache-control": "public, max-age=120" },
  });
}

function skillFolderFiles(skill, html) {
  const manifest = {
    law: "One link, one identity, many representations, downloadable as one folder.",
    id: `skill:${skill.name}`,
    name: skill.name,
    family: skill.family,
    description: skill.description,
    canonical_url: `https://miscsubjects.com/skills/${skill.name}`,
    source: skill.source,
    prevents: skill.prevents,
    representations: {
      human: `/skills/${skill.name}`,
      json: `/api/skills/${skill.name}`,
      skill: `/api/skills/${skill.name}/skill`,
      folder_zip: `/api/skills/${skill.name}/bundle?format=zip`,
    },
    governed_by: "/a/skill-law",
  };
  const base = skill.name + "/";
  const files = [
    { path: base + "SKILL.md", text: skill.raw },
    { path: base + "skill.json", text: JSON.stringify(skill, null, 2) },
    { path: base + "manifest.json", text: JSON.stringify(manifest, null, 2) },
  ];
  if (html) files.splice(1, 0, { path: base + "article.html", text: html });
  return files;
}

async function pageHtml(origin, name) {
  try {
    const res = await fetch(new URL(`/skills/${encodeURIComponent(name)}`, origin));
    if (res.ok) return await res.text();
  } catch {}
  return null;
}

export async function onRequestGet(context) {
  const { request, params } = context;
  const url = new URL(request.url);
  const parts = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  const name = (parts[0] || "").toLowerCase();
  const leaf = (parts[1] || "").toLowerCase();
  const fmt = String(url.searchParams.get("format") || "").toLowerCase();

  // Collection folder: every public skill as one downloadable folder.
  if (name === "bundle" || (name === "" && (fmt === "zip" || fmt === "manifest"))) {
    if (fmt === "manifest" || !fmt) {
      return json({
        law: "One link, one identity, many representations, downloadable as one folder.",
        scope: "collection:skills",
        skills: SKILL_REGISTRY.skills.length,
        private_unlisted: SKILL_REGISTRY.private_count,
        members: SKILL_REGISTRY.skills.map((s) => ({
          name: s.name,
          human: `/skills/${s.name}`,
          skill: `/api/skills/${s.name}/skill`,
          folder_zip: `/api/skills/${s.name}/bundle?format=zip`,
        })),
        folder_zip: "/api/skills/bundle?format=zip",
        parent: "/api/articles/bundle?format=manifest",
      });
    }
    const { zipBytes } = await import("../../_lib/object_folder.js");
    const files = [];
    files.push({
      path: "skills/manifest.json",
      text: JSON.stringify(
        {
          law: "One link, one identity, many representations, downloadable as one folder.",
          scope: "collection:skills",
          skills: SKILL_REGISTRY.skills.length,
          governed_by: "/a/skill-law",
        },
        null,
        2,
      ),
    });
    for (const s of SKILL_REGISTRY.skills)
      for (const f of skillFolderFiles(s, null)) files.push({ path: "skills/" + f.path, text: f.text });
    return new Response(zipBytes(files), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": 'attachment; filename="skills.zip"',
        "cache-control": "public, max-age=60",
        "x-object-scope": "collection:skills",
      },
    });
  }

  if (!name) {
    return json({
      _self: {
        what: "Public skill registry of miscsubjects.com — the loop that stops repeated failures, machine-readable.",
        human_index: "/skills",
        governed_by: "/a/skill-law",
        how_to_use:
          "GET /api/skills/<name> for the object, /api/skills/<name>/skill for raw SKILL.md, /api/skills/<name>/bundle?format=zip for the folder.",
      },
      generated_at: SKILL_REGISTRY.generated_at,
      count: SKILL_REGISTRY.skills.length,
      private_unlisted: SKILL_REGISTRY.private_count,
      laws: ["design-law", "writing-law", "skill-law"].map((slug) => ({
        slug,
        human: `/a/${slug}`,
        json: `/api/articles/${slug}`,
        skill: `/api/articles/${slug}/skill`,
      })),
      skills: SKILL_REGISTRY.skills.map((s) => ({
        name: s.name,
        family: s.family,
        description: s.description,
        // A skill written here has no external source; see sourcePills() in functions/skills.js
        // for the same repair on the human page. Null is the honest value, not an invented licence.
        license: s.source?.license || null,
        source: s.source?.repo || null,
        prevents: s.prevents,
        human: `/skills/${s.name}`,
        json: `/api/skills/${s.name}`,
        skill: `/api/skills/${s.name}/skill`,
        folder_zip: `/api/skills/${s.name}/bundle?format=zip`,
      })),
      folder_zip: "/api/skills/bundle?format=zip",
    });
  }

  const { env } = context;
  const skill = skillByName(name);
  const head = await getSkillHead(env, name);
  if (!skill && !head) return json({ error: "unknown skill: " + name, index: "/api/skills" }, 404);

  // One exact stored version, hash-pinned — what a receipt or a work action cites.
  if (leaf === "v" && parts[2]) {
    const v = await getSkillVersion(env, name, parts[2]);
    if (!v) return json({ error: "no stored version " + parts[2] + " of " + name, versions: `/api/skills/${name}` }, 404);
    return json({
      name, version: v.version, content_hash: v.content_hash, parent_version: v.parent_version,
      change_reason: v.change_reason, formation: v.formation_json ? JSON.parse(v.formation_json) : null,
      actor: v.actor, ts: v.ts, content: v.content,
    });
  }

  if (leaf === "evidence") {
    return json(await skillEvidence(env, name));
  }

  if (leaf === "skill") {
    // Stored current version first: it is the citable text. Registry raw is the pre-migration fallback.
    const text = head?.version?.content || skill?.raw || "";
    return new Response(text, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": 'inline; filename="SKILL.md"',
        "cache-control": "public, max-age=300",
        ...(head?.version ? { "x-skill-version": String(head.version.version), "x-skill-hash": head.version.content_hash } : {}),
      },
    });
  }

  if (leaf === "bundle") {
    if (!skill) return json({ error: "no registry bundle for " + name + " (stored-only skill)", json: `/api/skills/${name}` }, 404);
    const mode = fmt === "manifest" ? "manifest" : "zip";
    const html = mode === "zip" ? await pageHtml(url.origin, skill.name) : null;
    const files = skillFolderFiles(skill, html);
    if (mode === "manifest") return json(JSON.parse(files.find((f) => f.path.endsWith("manifest.json")).text));
    const { zipBytes } = await import("../../_lib/object_folder.js");
    return new Response(zipBytes(files), {
      status: 200,
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${skill.name}.zip"`,
        "cache-control": "public, max-age=60",
        "x-object-id": `skill:${skill.name}`,
      },
    });
  }

  // The skill object: registry fields when present, plus the stored version head — which is what
  // makes a skill citable (current_version + content_hash) and criticizable per version.
  const stored = head ? {
    current_version: head.object.current_version,
    content_hash: head.version?.content_hash || null,
    retired_at: head.object.retired_at || null,
    versions: await listSkillVersions(env, name),
    version_url: `/api/skills/${name}/v/${head.object.current_version}`,
    evidence: `/api/skills/${name}/evidence`,
    append_version: `POST /api/skills/${name}/versions {content, expected_hash, change_reason, formation?}`,
  } : {
    stored: false,
    note: "No D1 version record yet — this skill exists only as the generated registry constant. First POST /api/skills/" + name + "/versions creates version 1.",
  };
  if (!skill) return json({ name, ...stored, content: head.version?.content || null });
  return json({ ...skill, ...stored });
}

// Append a version. The ONLY write path for skill_versions (a governed table). CAS via
// expected_hash — the article write path's 428/409 discipline applied to methods.
export async function onRequestPost(context) {
  const { request, env, params } = context;
  const parts = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  const name = (parts[0] || "").toLowerCase();
  const leaf = (parts[1] || "").toLowerCase();
  if (!name || (leaf !== "versions" && leaf !== "promote")) {
    return json({ error: "no_such_route", how: "POST /api/skills/<name>/versions | POST /api/skills/<name>/promote" }, 404);
  }
  let authed = await isBuildAuthed(request, env);
  let identity = authed ? "owner-key" : null;
  if (!authed) {
    const tok = (await verifyShareToken(request, env))
      || (request.headers.get("x-work-token") ? await verifyShareTokenValue(env, request.headers.get("x-work-token")) : null);
    if (tok && /^(act|row:|rows:|pfx:)/.test(String(tok.scope || ""))) {
      authed = true;
      identity = "share:" + tok.scope + ":" + String(tok.nonce || "").slice(0, 8);
    }
  }
  if (!authed) {
    return json({ error: "capability_required", how_to_fix: "Present the terminal key, an admin cookie, or an act-scope share token (?share= or x-work-token). Reads are public; a method revision is not." }, 401);
  }
  let b;
  try { b = await request.json(); } catch { return json({ error: "invalid json" }, 400); }
  // Promotion (spec Phase 4): moving the pointer agents are handed is earned by evidence —
  // two accepted runs under the candidate, one a reproduction — or forced with a recorded reason.
  if (leaf === "promote") {
    const r = await promoteSkillVersion(env, name, b.version, {
      actor: b.agent || identity, force: b.force === true, force_reason: b.force_reason,
    });
    return json(r, r.ok ? 200 : (r.status || 400));
  }
  const r = await appendSkillVersion(env, name, {
    content: b.content, expected_hash: b.expected_hash, change_reason: b.change_reason,
    formation: b.formation, actor: b.agent || identity, fingerprint: null,
    family: b.family, license: b.license, source: b.source,
    promote: b.promote !== false,
  });
  return json(r, r.ok ? 201 : (r.status || 400));
}
