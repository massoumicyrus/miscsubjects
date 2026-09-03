// PLAIN ARGS FOR MCP TOOLS.
//
// Every MCP row in the directory targets mcpToolCall, whose third argument is a JSON object.
// So the tag form a model actually writes —
//
//     [CF_DOCS_SEARCH_CLOUDFLARE_DOCUMENTATION]durable objects alarms[/…]
//
// returned ERR:fn:bad_args_json, while the same call with a hand-written {"query":"…"} worked.
// 192 rows, and the natural invocation failed on all of them. A tool that only answers when the
// model guesses the property name is a tool the model does not have.
//
// The server already publishes what each tool wants: tools/list carries an inputSchema. This
// reads it and fills it from plain arguments — one value into a single-property tool, or
// pipe-separated values positionally, required properties first. The schema is the authority, so
// nothing here hard-codes a property name for any particular tool.

const SCHEMA_TTL = 21600;  // six hours; a tool's shape is not a fast-moving fact

// tools/list per server, cached. Without the cache every call would pay a second round trip
// just to learn the shape of the first.
async function toolSchemas(env, serverUrl, authEnvVar, mcpRpc) {
  const cacheKey = 'mcp_schema:' + serverUrl;
  if (env.KV) {
    try {
      const hit = await env.KV.get(cacheKey, 'json');
      if (hit && hit.tools) return hit.tools;
    } catch {}
  }
  const res = await mcpRpc(env, serverUrl, 'tools/list', {}, authEnvVar);
  const tools = {};
  const list = (res && res.json && res.json.result && res.json.result.tools) || [];
  for (const t of list) {
    if (t && t.name) tools[t.name] = t.inputSchema || t.input_schema || null;
  }
  if (env.KV && Object.keys(tools).length) {
    try { await env.KV.put(cacheKey, JSON.stringify({ tools, _ts: Date.now() }), { expirationTtl: SCHEMA_TTL }); } catch {}
  }
  return tools;
}

function coerceScalar(spec, raw) {
  const v = String(raw == null ? '' : raw).trim();
  const type = spec && (Array.isArray(spec.type) ? spec.type[0] : spec.type);
  if (type === 'number' || type === 'integer') {
    const n = type === 'integer' ? parseInt(v, 10) : parseFloat(v);
    return Number.isFinite(n) ? n : v;
  }
  if (type === 'boolean') return /^(1|true|yes|on)$/i.test(v);
  if (type === 'array') {
    // A JSON array if the caller wrote one; otherwise commas, which is how a person types a list.
    if (v.startsWith('[')) { try { return JSON.parse(v); } catch {} }
    return v ? v.split(',').map((x) => x.trim()).filter(Boolean) : [];
  }
  if (type === 'object' && v.startsWith('{')) { try { return JSON.parse(v); } catch {} }
  return v;
}

// Required properties first, in the order the schema declares them: the first plain argument
// should land on the thing the tool cannot run without.
function propertyOrder(schema) {
  const props = (schema && schema.properties) || {};
  const names = Object.keys(props);
  const required = ((schema && schema.required) || []).filter((r) => names.includes(r));
  const rest = names.filter((n) => !required.includes(n));
  return { order: [...required, ...rest], props, required };
}

export async function coerceMcpArgs(env, serverUrl, toolName, rawArgs, authEnvVar, mcpRpc) {
  const raw = String(rawArgs == null ? '' : rawArgs).trim();
  // Already an object: the caller knew the shape, and their names win over any guess here.
  if (raw.startsWith('{')) {
    try { return { args: JSON.parse(raw), how: 'as_written' }; } catch { /* fall through and try to help */ }
  }
  if (!raw) return { args: {}, how: 'empty' };

  let schema = null;
  try {
    const schemas = await toolSchemas(env, serverUrl, authEnvVar, mcpRpc);
    schema = schemas[String(toolName || '')] || null;
  } catch { /* no schema: fall back below */ }

  if (!schema || !schema.properties || !Object.keys(schema.properties).length) {
    // No published shape to fill. Refusing here would be worse than one honest guess: almost
    // every single-input MCP tool calls it "query", and the error says exactly what happened.
    return { args: { query: raw }, how: 'no_schema_assumed_query' };
  }

  const { order, props } = propertyOrder(schema);
  if (!order.length) return { args: {}, how: 'schema_has_no_properties' };

  if (order.length === 1) {
    return { args: { [order[0]]: coerceScalar(props[order[0]], raw) }, how: 'single:' + order[0] };
  }
  // Pipe is the directory's own argument separator, so a model already writes args this way.
  const parts = raw.split('|');
  const args = {};
  const filled = [];
  for (let i = 0; i < parts.length && i < order.length; i += 1) {
    const name = order[i];
    const val = parts[i].trim();
    if (val === '') continue;
    args[name] = coerceScalar(props[name], val);
    filled.push(name);
  }
  // One value against a multi-property tool: put it on the first required property rather than
  // sending nothing, which is what the caller plainly meant.
  if (!filled.length && parts.length === 1) {
    args[order[0]] = coerceScalar(props[order[0]], parts[0]);
    filled.push(order[0]);
  }
  return { args, how: 'positional:' + filled.join(',') };
}

// The runner the MCP rows point at. Same four arguments as mcpToolCall, so switching a row is a
// one-field change and its content template does not move.
export function makeMcpArgsFnMap({ mcpRpc }) {
  return {
    async mcpCallSmart(env, serverUrl, toolName, argsJson, authEnvVar) {
      const url = String(serverUrl || '');
      const name = String(toolName || '');
      if (!url || !name) return 'ERR:fn:mcp_needs_server_and_tool';
      const { args, how } = await coerceMcpArgs(env, url, name, argsJson, authEnvVar, mcpRpc);
      const res = await mcpRpc(env, url, 'tools/call', { name, arguments: args }, authEnvVar);
      if (res.err) return 'ERR:fn:mcp_rpc:' + res.err + ':' + String(res.raw || '').slice(0, 200);
      if (res.json && res.json.error) {
        // Say what was sent and how it was built. "bad_args_json" told the reader nothing about
        // which property was wrong, and that is the whole reason these rows sat broken.
        return 'ERR:mcp:' + JSON.stringify(res.json.error).slice(0, 260)
             + ' :: sent ' + JSON.stringify(args).slice(0, 200) + ' (' + how + ')';
      }
      const content = res.json && res.json.result && res.json.result.content;
      if (Array.isArray(content)) return content.map((c) => (c.text != null ? c.text : JSON.stringify(c))).join('\n');
      return JSON.stringify(res.json && res.json.result != null ? res.json.result : res.json);
    },
    // What a tool actually accepts, straight from the server. So a model can ask instead of guess.
    async mcpToolSchema(env, serverUrl, toolName, authEnvVar) {
      const schemas = await toolSchemas(env, String(serverUrl || ''), authEnvVar, mcpRpc);
      const name = String(toolName || '').trim();
      if (!name) return JSON.stringify({ server: serverUrl, tools: Object.keys(schemas) });
      return JSON.stringify({ tool: name, input_schema: schemas[name] || null }, null, 2);
    },
  };
}
