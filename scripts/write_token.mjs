// Obtain a write token by fetching the live writing law and answering its challenge.
// Any publishing script imports this; there is no other way to get an article body accepted.
import { createHash } from "crypto";

const BASE = process.env.MISC_BASE || "https://miscsubjects.com";

export async function getWriteToken(slug) {
  const ch = await (await fetch(`${BASE}/api/write-gate/challenge?slug=${encodeURIComponent(slug)}`)).json();
  const lawHash = createHash("sha256")
    .update(ch.clauses.map((c) => c.id + c.title + c.law).join("\n"))
    .digest("hex");
  const answers = {};
  for (const q of ch.questions) {
    const clause = ch.clauses.find((c) => c.id === q.clause_id);
    answers[q.clause_id] = clause.title;
  }
  const res = await (
    await fetch(`${BASE}/api/write-gate/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challenge_id: ch.challenge_id, law_hash: lawHash, answers }),
    })
  ).json();
  if (!res.write_token) throw new Error("write gate refused: " + JSON.stringify(res));
  return { token: res.write_token, clauses: ch.clauses, law_version: ch.law_version };
}
