// Self-description for the directory REST surface. Embedded in /api/directory responses
// so any client (or LLM) can GET the directory and learn how to add / edit / delete /
// invoke any entry without prior knowledge. Grounded in the actual columns + verbs in
// functions/api/directory/index.js and [key].js — keep in sync if those change.

export const DIR_SCHEMA = {
  store: 'D1 table `directory` (one row = one invocable build capability)',
  fields: {
    key: 'string · primary key · the invocation name',
    type: 'fn | http | agent | flow',
    target: 'fn: FN_MAP name · http: "METHOD url" (e.g. "GET https://…/$1") · agent: model id · flow: "" (content holds the DSL)',
    auth: 'http only: "bearer:ENV_VAR" | "headers:{...}" | "query:k=$ENV" | ""',
    content: 'fn/http: "# docs\\n<arg template>" · agent: the system prompt body · flow: the DSL',
    includes: 'agent only: comma-separated prompt_block keys (e.g. BLOCK_VOICE,BLOCK_ROUTING) composed before content at runtime',
    category: 'string tag', allowed_categories: 'csv of categories, or "*"',
    seq: 'int (sort)', enabled: '1|0', planner_visible: '1|0', planner_rank: 'int',
    input_schema: 'optional JSON string', examples: 'optional JSON string',
    row_num: 'int · computed · 1-based position in the canonical directory list (stable for a given ordering)',
  },
  rest: {
    list: 'GET /api/directory[?type=agent|http|fn|flow][&row_num=N][&format=widgets] -> {count, rows[]}; format=widgets returns HTML cards; row_num returns the Nth row',
    read: 'GET /api/directory/<key>[?format=widgets] -> the row with row_num; format=widgets returns an HTML card',
    create: 'POST /api/directory {key,type,...} (key+type required) -> 201',
    update: 'PUT /api/directory/<key> {type,...} (full upsert)',
    patch: 'PATCH /api/directory/<key> {field:value,...} (partial; e.g. {"content":"..."})',
    delete: 'DELETE /api/directory/<key>',
  },
  invoke: 'POST /api/dispatch {key, body, actor?} -> runs the row and returns its result',
  model_call: 'POST /api/invoke {key, input|inputs|messages, model?, system?, memory?, includes?, vars?, temperature?, max_tokens?, n?} -> one model call, or up to 200 in parallel in one round trip. No agent loop, no tools, hard timeout. This is the only sanctioned way to call a model; a prompt never lives in code (see law MODEL_CALL_LAW).',
};

// Per-entry REST block: the exact calls for one key.
export function restFor(key) {
  const k = encodeURIComponent(key);
  return {
    read: `GET /api/directory/${k}`,
    update: `PUT /api/directory/${k}`,
    patch: `PATCH /api/directory/${k}`,
    delete: `DELETE /api/directory/${k}`,
    invoke: `POST /api/dispatch {"key":"${key}","body":"<args>"}`,
    model_call: `POST /api/invoke {"key":"${key}","input":"<message>"}  ·  batch: {"key":"${key}","inputs":["a","b","c"]}`,
    lab: `/admin/prompts/${k}`,
  };
}
