// The write gate's two public routes. GET a challenge (which returns the whole law),
// POST the answers, receive a token. No token, no article write.
import { issueChallenge, answerChallenge } from "../../_lib/write_gate.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function onRequest({ request, env, params }) {
  const parts = (params.path || []).filter(Boolean);
  const leaf = parts[0] || "";
  const url = new URL(request.url);

  if (request.method === "GET" && (leaf === "" || leaf === "challenge")) {
    return json(await issueChallenge(env, url.searchParams.get("slug") || ""));
  }
  if (request.method === "POST" && leaf === "answer") {
    let payload = {};
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }
    const res = await answerChallenge(env, payload);
    const { status, ...rest } = res;
    return json(rest, status);
  }
  return json(
    {
      error: "unknown_route",
      routes: {
        challenge: "GET /api/write-gate/challenge?slug=<slug>",
        answer: "POST /api/write-gate/answer {challenge_id, law_hash, answers}",
      },
    },
    404,
  );
}
