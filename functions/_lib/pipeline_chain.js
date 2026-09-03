// Populate phase ladder — zero-yield passes advance to higher-yield steps.

export const POPULATE_PHASE_ORDER = ["science", "anecdote", "reddit_x", "prose"];

export function newTraceId() {
  return "t_" + Math.random().toString(36).slice(2, 10);
}

/** iMessage line when tokens spent with no material output. */
export function wasteNotifyMessage(parsed, url, postTo) {
  const waste = parsed?.yield?.waste || parsed?.invocation?.waste;
  if (!waste) return "";
  const y = parsed?.yield || parsed?.invocation?.yield || {};
  const cost = Number(y.cost_usd || 0);
  const tok = Number(y.tokens_total || (y.tokens_in || 0) + (y.tokens_out || 0));
  const action = String(postTo || "")
    .split("/")
    .pop() || "protocol";
  const focus = parsed?.focus ? " · " + parsed.focus : "";
  let line =
    "⚠️ waste · " + action + focus + " · " + url + " · $" + cost.toFixed(4);
  if (tok > 0) line += " · " + tok + " tok";
  return line + " · 0 output";
}

export function nextPopulateFocus(currentFocus) {
  const f = String(currentFocus || "science").toLowerCase();
  if (f === "science") return "anecdote";
  if (f === "anecdote") return "reddit_x";
  return null;
}

/** True when this populate tick should close and chain (not repoll same phase). */
export function populatePhaseComplete(parsed) {
  if (!parsed || parsed.ok === false) return false;
  if (parsed.phase_exhausted === true) return true;
  if (parsed.done === true && parsed.more !== true) return true;
  if (Number(parsed.added || 0) === 0 && Number(parsed.rounds || 0) >= 1) return true;
  return false;
}

/** Should cron reopen the same populate task for another round? */
export function populateShouldRepoll(parsed) {
  if (!parsed || parsed.error) return false;
  if (populatePhaseComplete(parsed)) return false;
  return parsed.more === true && Number(parsed.added || 0) > 0;
}

export function followupsAfterPopulate(focus, slug) {
  const f = String(focus || "").toLowerCase();
  const chainSlug = String(slug || "").trim();
  if (!chainSlug) return [];

  const repair = {
    post_to: "/api/protocol/repair",
    slug: chainSlug,
    materialize_orphans: true,
    role: "repair",
  };
  const slots = {
    post_to: "/api/protocol/fill-slots",
    slug: chainSlug,
    role: "fill-slots",
  };

  if (f === "science") {
    return [
      repair,
      slots,
      {
        post_to: "/api/protocol/populate",
        slug: chainSlug,
        focus: "anecdote",
        max_rounds: 6,
        role: "anecdote-hunt",
      },
    ];
  }
  if (f === "anecdote") {
    return [
      repair,
      slots,
      {
        post_to: "/api/protocol/populate",
        slug: chainSlug,
        focus: "reddit_x",
        max_rounds: 4,
        role: "reddit-x-hunt",
      },
    ];
  }
  if (f === "reddit_x" || f === "all" || !f) {
    return [
      repair,
      slots,
      {
        post_to: "/api/protocol/synthesize-body",
        slug: chainSlug,
        model: "grok/grok-4.3",
        role: "prose",
      },
      {
        post_to: "/api/protocol/collaborate",
        slug: chainSlug,
        model: "kimi/moonshot-v1-8k",
        role: "kimi",
      },
      {
        post_to: "/api/protocol/collaborate",
        slug: chainSlug,
        model: "gemini/gemini-2.5-flash",
        role: "gemini",
      },
      { post_to: "/api/protocol/poll", slug: chainSlug, model: "grok/grok-4.3", role: "poll" },
      {
        post_to: "/api/protocol/critique",
        slug: chainSlug,
        model: "grok/grok-4.3",
        role: "adversary",
      },
    ];
  }
  return [repair, slots];
}

function sourceForFollowup(fu) {
  if (fu.post_to?.includes("/write")) return "writer";
  if (fu.post_to?.includes("/populate")) return fu.role || "source-hunt";
  return fu.role || "writer-queue";
}

export async function enqueueFollowups(env, slug, followups, traceId = null) {
  if (!env?.DB || !slug || !followups?.length) return 0;
  let n = 0;
  for (const fu of followups) {
    const job = traceId ? { ...fu, trace_id: traceId } : fu;
    const body = JSON.stringify(job);
    let sql =
      "SELECT id FROM tasks WHERE status IN ('open','running') AND body LIKE ? AND body LIKE ?";
    const binds = ['%"slug":"' + slug + '"%', "%" + fu.post_to + "%"];
    if (fu.focus) {
      sql += " AND body LIKE ?";
      binds.push('%"focus":"' + fu.focus + '"%');
    }
    if (fu.model) {
      sql += " AND body LIKE ?";
      binds.push('%"model":"' + fu.model + '"%');
    }
    sql += " LIMIT 1";
    const exists = await env.DB.prepare(sql)
      .bind(...binds)
      .first()
      .catch(() => null);
    if (exists) continue;
    await env.DB.prepare(
      "INSERT INTO tasks (created_at, status, body, source) VALUES (datetime('now'), 'open', ?, ?)",
    )
      .bind(body, sourceForFollowup(fu))
      .run()
      .catch(() => {});
    n++;
  }
  return n;
}

export function populateNotifyMessage(parsed, url, focus) {
  const phase =
    focus === "science"
      ? "science"
      : focus === "anecdote"
        ? "anecdotes"
        : focus === "reddit_x"
          ? "reddit/X"
          : "evidence";
  if (Number(parsed.added || 0) > 0) {
    return (
      "📚 +" +
      parsed.added +
      " sources · " +
      url +
      " (" +
      (parsed.total_sources || "?") +
      " total" +
      (parsed.more ? ", more remain" : "") +
      ")"
    );
  }
  if (populatePhaseComplete(parsed)) {
    const next = nextPopulateFocus(focus);
    if (next) {
      return "📚 " + phase + " pass empty — advancing to " + next + " · " + url;
    }
    return "📚 " + phase + " pass empty — advancing to prose/collaborate · " + url;
  }
  return "";
}