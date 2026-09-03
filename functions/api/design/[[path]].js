// /api/design — the master design tabulation API.
//   GET  /api/design               → { active, profiles[], schema, default }
//   GET  /api/design/<name>        → the full resolved profile JSON for <name> (or active)
//   POST /api/design  {profile:{…}}        → create/update a named profile (owner only)
//   POST /api/design  {activate:"<name>"}  → flip the whole site to that profile (owner only)
//   POST /api/design  {profile:{…}, activate:true} → save AND flip in one call
// A profile is every quantified design value; POST one extracted from another site to clone its look.
import { isBuildAuthed } from "../../_lib/admin_session.js";
import {
  DEFAULT_PROFILE,
  PROFILE_SCHEMA,
  getActiveProfile,
  listProfiles,
  saveProfile,
  setActive,
} from "../../_lib/design/tokens/runtime.js";

const json = (o, status = 200) =>
  new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const parts = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  if (parts[0]) {
    const active = await getActiveProfile(env);
    return json(active.name === parts[0] || parts[0] === "active" ? active : DEFAULT_PROFILE);
  }
  const activeName = (await env.KV?.get("design:active")) || "default";
  return json({
    active: activeName,
    profiles: await listProfiles(env),
    default: DEFAULT_PROFILE,
    schema: PROFILE_SCHEMA,
    how: "POST {activate:'<name>'} to flip the site; POST {profile:{…}} to add a profile; both to do it in one call. Owner token required.",
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!(await isBuildAuthed(request, env))) {
    return json({ error: "unauthorized", note: "owner or admin token required" }, 401);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "invalid json" }, 400); }
  const result = {};
  try {
    if (body.profile && typeof body.profile === "object") {
      const name = body.profile.name || body.name;
      if (!name) return json({ error: "profile.name required" }, 400);
      result.saved = await saveProfile(env, name, body.profile);
    }
    if (body.activate) {
      const target = body.activate === true ? result.saved : body.activate;
      if (!target) return json({ error: "nothing to activate" }, 400);
      result.active = await setActive(env, target);
    }
    if (!result.saved && !result.active) {
      return json({ error: "send {profile:{…}} and/or {activate:'<name>'}" }, 400);
    }
    result.ok = true;
    result.note = "Live. Reload any page — the site is now rendering the " + (result.active || result.saved) + " profile.";
    return json(result);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 400);
  }
}
