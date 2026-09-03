# Actor comparison board

Eight steps under comparison:
1. A message arrives.
2. It is recorded in a ledger.
3. A capability is resolved from plain English.
4. Its contract is read.
5. It is invoked.
6. A receipt is written.
7. The result is published at a permanent address.
8. Another model reads that address and its review is recorded.

## Anthropic MCP

- **claim**: "The Model Context Protocol (MCP) is an open standard for connecting AI assistants to the systems where data lives, including content repositories, business tools, and development environments."
- **source**: https://www.anthropic.com/news/model-context-protocol (meta description, page last-modified 2026-07-26; original publication 2024-11-25)
- **missing**: 1, 2, 3, 6, 7, 8. MCP is a specification for client-server JSON-RPC connections. Step 4 (tool schema) and step 5 (invocation) are in scope via `tools/list` and `tools/call`. The spec does not define message arrival (host responsibility), a ledger, plain-English resolution, receipts, result publication, or cross-model review.
- **evidence**: Architecture specification at https://modelcontextprotocol.io/specification/2025-11-25/architecture/index.md describes client-host-server with capability negotiation. No ledger, receipt, address publication, or review primitive appears in the spec index at https://modelcontextprotocol.io/llms.txt (563 pages indexed, none covering those concepts).

## OpenAI Agents/Assistants

- **claim**: "The OpenAI Agents SDK is a lightweight yet powerful framework for building multi-agent workflows."
- **source**: https://raw.githubusercontent.com/openai/openai-agents-python/main/README.md (fetched 2026-07-26)
- **missing**: 2, 6, 7, 8. The SDK provides message handling via `Runner.run()` (step 1), plain-English resolution via function-calling models (step 3), tool schema via Python function signatures (step 4), and invocation (step 5). Sessions store conversation history. Tracing records agent runs. No canonical event ledger, per-invocation receipt, result publishing at a permanent address, or cross-model review loop exists in the SDK.
- **evidence**: The tools documentation at https://openai.github.io/openai-agents-python/tools/ catalogs five tool categories (hosted, local runtime, function, agent-as-tool, Codex). The README lists sessions and tracing but no ledger, receipt, or address-publishing API. The Agents SDK guide at https://platform.openai.com/docs/guides/agents references the Python SDK; neither page describes an event ledger or cross-model review.

## LangChain

- **claim**: "LangChain provides create_agent: a minimal, highly configurable harness. Compose exactly the agent your use case needs from model, tools, prompt, and middleware."
- **source**: https://raw.githubusercontent.com/langchain-ai/docs/main/src/oss/langchain/overview.mdx (fetched 2026-07-26)
- **missing**: 2, 3, 6, 7, 8. LangChain handles message input (step 1), tool schema via function definitions (step 4), and invocation (step 5). LangSmith provides tracing. Tool schema is defined in Python/JS code, not read from an external contract at invocation time. Plain-English resolution (step 3) is delegated to the model's function-calling, not a framework mechanism. No built-in ledger, receipt primitive, permanent result address, or cross-model review.
- **evidence**: The overview page at https://docs.langchain.com/oss/python/langchain/overview shows `create_agent(model=..., tools=[...], system_prompt=...)` where tools are defined in code. LangSmith docs at https://docs.langchain.com/langsmith/observability describe tracing but not an event ledger or receipt store. The llms.txt index at https://docs.langchain.com/llms.txt spans 550+ pages with no entry for ledger, receipt, or address-publishing primitives.

## LlamaIndex

- **claim**: "LlamaIndex is the leading document agent and OCR platform"
- **source**: https://api.github.com/repos/run-llama/llama_index (description field, fetched 2026-07-26)
- **missing**: 2, 3, 6, 7, 8. LlamaIndex provides document ingestion, indexing, query engines, and agent wrappers that call tools (steps 4-5). Agent input arrives via `query()` (step 1). No built-in event ledger, plain-English capability resolution, receipts, permanent address publication, or cross-model review mechanism.
- **evidence**: The GitHub README at https://raw.githubusercontent.com/run-llama/llama_index/main/README.md describes `VectorStoreIndex`, `query_engine.query()`, and agent tools. The agent docs at https://docs.llamaindex.ai/en/stable/understanding/agent/ describe OpenAI function-calling agents but no ledger or receipt system.

## CrewAI

- **claim**: "Framework for orchestrating role-playing, autonomous AI agents. By fostering collaborative intelligence, CrewAI empowers agents to work together seamlessly, tackling complex tasks."
- **source**: https://api.github.com/repos/crewAIInc/crewAI (description field, fetched 2026-07-26)
- **missing**: 2, 6, 7, 8. CrewAI handles task assignment via `Crew` and `Task` objects (step 1), tool execution (steps 4-5). Tools are defined as Python classes or via `@tool` decorator. The framework does not include an event ledger, per-invocation receipts, result publishing at permanent addresses, or a cross-model review loop.
- **evidence**: The tools documentation at https://docs.crewai.com/v1.15.7/en/concepts/tools describes custom tool creation with `BaseTool` subclassing and `@tool` decorator. The introduction at https://docs.crewai.com/v1.15.7/en/introduction describes agents, tasks, crews, and processes but not ledgers or receipts.

## AutoGen (Microsoft)

- **claim**: "AutoGen is a framework for creating multi-agent AI applications that can act autonomously or work alongside humans."
- **source**: https://raw.githubusercontent.com/microsoft/autogen/main/README.md (fetched 2026-07-26)
- **missing**: 2, 6, 7, 8. AutoGen handles agent messaging (step 1), tool registration via `AssistantAgent` with function tools (steps 4-5). The framework is in maintenance mode. No event ledger, receipt system, permanent result address, or cross-model review loop.
- **evidence**: The README states "AutoGen is now in maintenance mode. It will not receive new features or enhancements." The quickstart at https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/quickstart.html shows `AssistantAgent` with tool registration but no ledger or receipt mechanism.

## Pinecone (vector database)

- **claim**: "Official Python SDK for the Pinecone vector database"
- **source**: https://api.github.com/repos/pinecone-io/pinecone-python-client (description field, fetched 2026-07-26)
- **missing**: 1, 2, 3, 4, 5, 6, 7, 8. Pinecone is a vector database. It stores and retrieves embeddings. It is not an agent framework. The SDK provides index CRUD, upsert, and query. No message arrival, event ledger, capability resolution, contract system, invocation harness, receipt, address publication, or review loop exists.
- **evidence**: The quickstart at https://raw.githubusercontent.com/pinecone-io/pinecone-python-client/main/README.md shows `pc.indexes.create()`, `index.upsert()`, and `index.query()`. The agent-specific page at https://docs.pinecone.io/guides/agents/overview failed to fetch; the SDK README contains no agent or capability-loop primitives.

---

## Part counts

### Stack: MCP server + host + a database + a queue + a vector store

**Count: 5 named pieces** (plus the LLM provider, which none of the three stacks counts because all three require one).

List: MCP server, MCP host/client, database, queue, vector store.

Quickstart sources:
- MCP server: https://modelcontextprotocol.io/docs/develop/build-server — `uv add mcp`, server code (1 piece)
- MCP client/host: https://modelcontextprotocol.io/docs/develop/build-client — `uv add mcp anthropic`, client code (1 piece)
- Database, queue, vector store: not part of the MCP quickstart; external dependencies the developer must provision separately (3 pieces)

### Stack: LangChain + LangSmith + a vector store + a task queue

**Count: 4 named pieces** (plus the LLM provider).

List: LangChain SDK, LangSmith, vector store, task queue.

Quickstart sources:
- LangChain: https://docs.langchain.com/oss/python/langchain/quickstart — `pip install langchain`, `create_agent()` (1 piece)
- LangSmith: https://docs.langchain.com/langsmith/observability — `LANGSMITH_TRACING=true`, API key (1 piece)
- Vector store, task queue: external dependencies not included in the quickstart (2 pieces)

### Stack: OpenAI Assistants/Agents SDK + a store + a webhook receiver

**Count: 3 named pieces** (plus the OpenAI API).

List: OpenAI Agents SDK, a store (Vector Store or external database), a webhook receiver.

Quickstart sources:
- Agents SDK: https://openai.github.io/openai-agents-python/quickstart/ — `pip install openai-agents`, `Agent` + `Runner` (1 piece)
- Store: the SDK supports hosted vector stores via `FileSearchTool`; the quickstart does not provision one. External database or Vector Store is a separate piece (1 piece)
- Webhook receiver: the SDK has no built-in HTTP webhook receiver; a developer must provide a web framework (Flask, FastAPI, Cloudflare Worker) to receive messages (1 piece)

---

ACTORS_DONE: 7 of 7 with a verified verbatim quote

FETCH_FAILURES:
- https://spec.modelcontextprotocol.io/specification/2025-03-26/ (fetch failed)
- https://spec.modelcontextprotocol.io/specification/2025-11-25/ (fetch failed)
- https://spec.modelcontextprotocol.io/specification/2025-11-25/server/tools/ (fetch failed)
- https://raw.githubusercontent.com/modelcontextprotocol/specification/main/docs/specification/2025-03-26/index.md (returned error)
- https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/heads/main/docs/specification/2025-11-25/index.md (returned error)
- https://raw.githubusercontent.com/modelcontextprotocol/specification/refs/heads/main/docs/specification/2025-11-25/server/tools.md (returned error)
- https://docs.llamaindex.ai/en/stable/understanding/agent/basic_agent/ (fetch failed)
- https://docs.llamaindex.ai/en/stable/examples/agent/openai_agent/ (fetch failed)
- https://docs.llamaindex.ai/en/stable/module_guides/deploying/agents/usage_pattern/ (fetch failed)
- https://docs.llamaindex.ai/en/stable/llms.txt (fetch failed)
- https://raw.githubusercontent.com/run-llama/llama_index/main/docs/docs/understanding/agent/index.md (returned error)
- https://raw.githubusercontent.com/run-llama/llama_index/main/docs/docs/module_guides/deploying/agents/index.md (returned error)
- https://docs.pinecone.io/guides/agents/overview (fetch failed)
- https://docs.pinecone.io/guides/agents/get-started (fetch failed)
- https://docs.pinecone.io/guides/agents/quickstart (fetch failed)
- https://openai.com/index/introducing-the-agents-sdk/ (fetch failed)
- https://www.llamaindex.ai/blog/introducing-llama-agents-a-new-architecture-for-agentic-ai-systems-as-microservices-dc958d52bec3 (fetch failed)
- https://raw.githubusercontent.com/langchain-ai/langchain/master/libs/langchain/langchain/agents/README.md (returned error)
- https://raw.githubusercontent.com/langchain-ai/langchain/master/docs/docs/how_to/custom_tools.ipynb (returned error)
- https://raw.githubusercontent.com/crewAIInc/crewAI/main/docs/source/tools.mdx (returned error)
- https://raw.githubusercontent.com/crewAIInc/crewAI/main/docs/source/concepts/tools.mdx (returned error)

UNVERIFIED:
- Pinecone agents/agent-specific page — all three URLs (overview, get-started, quickstart) under https://docs.pinecone.io/guides/agents/ failed to fetch. The Pinecone claim is sourced from the Python SDK README and GitHub repo description, which do not describe agent functionality. Whether Pinecone has a separate agent product could not be confirmed.
- LlamaIndex agent module docs at https://docs.llamaindex.ai/en/stable/module_guides/deploying/agents/ — the page body returned HTML with title "Agents - LlamaIndex" but the content was not extractable as plain text. The claim and assessment rely on the GitHub README and the top-level agent page body.
