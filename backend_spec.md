# Backend Spec — Goal-Aware Chatbot (FastAPI + Gemini)

> Fill in `{{GOAL_TOPIC}}` and `{{GOAL_MATERIALS}}` once the event topic is announced. Everything else is ready to build tonight.

## 1. Objective

A production-shaped chatbot backend that:
- Answers questions grounded in a specific goal/domain (`{{GOAL_TOPIC}}`) given at the event.
- Streams responses to the frontend in real time.
- Has a real memory hierarchy (not just "stuff the whole history in the prompt").
- Can call tools/functions when the goal requires live data or actions.

## 2. Tech Stack

- **Framework:** FastAPI + Uvicorn (ASGI, WebSocket-native)
- **LLM:** Google Gemini (via `google-genai` SDK) — text model for chat, `text-embedding-004` for retrieval
- **Session memory:** In-process dict for hackathon speed (Redis if time allows)
- **Long-term / episodic memory:** ChromaDB (local, zero-infra, perfect for a hackathon)
- **Validation:** Pydantic v2
- **Package manager:** `uv` or `pip` + `venv`

## 3. Directory Structure

```
backend/
├── app/
│   ├── main.py                # FastAPI app, routes, WS endpoint
│   ├── config.py              # env vars, model names, constants
│   ├── deps.py                # shared dependencies (clients, singletons)
│   │
│   ├── memory/
│   │   ├── working_memory.py  # sliding window, per-session, in-RAM/Redis
│   │   ├── long_term.py       # Chroma read/write, embedding calls
│   │   └── context_cache.py   # Gemini explicit cache create/refresh
│   │
│   ├── chunking/
│   │   └── chunker.py         # splits GOAL_MATERIALS into chunks + embeds
│   │
│   ├── tools/
│   │   ├── registry.py        # tool_name -> python fn map
│   │   └── goal_tools.py      # {{GOAL_TOPIC}}-specific tools (fill tomorrow)
│   │
│   ├── llm/
│   │   ├── gemini_client.py   # single genai.Client() singleton
│   │   └── prompt_builder.py  # assembles system+context+working memory
│   │
│   ├── schemas/
│   │   └── chat.py            # Pydantic request/response/event models
│   │
│   └── routes/
│       ├── chat_ws.py         # /ws/chat streaming endpoint
│       ├── session.py         # /api/session create/reset
│       └── ingest.py          # /api/ingest — upload goal docs → chunk → embed
│
├── data/
│   └── goal_materials/        # drop {{GOAL_MATERIALS}} files here
├── .env.example
├── requirements.txt
└── run.sh
```

## 4. Memory Architecture (the part that impresses judges)

Three tiers, each with a distinct job — don't collapse them into one prompt blob.

### 4.1 Working Memory (session, short-term)
- Last N turns (default N=12) kept per `session_id`.
- Stored as a simple list of `{role, content, ts}` in a dict (swap for Redis if scaling).
- Auto-trimmed: when token estimate exceeds a budget (~3000 tokens), drop oldest turns first, keep the last 2 turns always.

### 4.2 Context Cache (static domain knowledge)
- For `{{GOAL_TOPIC}}` rules/docs/spec sheets that are large and static for the whole event.
- Use Gemini's **explicit context caching** (`client.caches.create(...)`) with a TTL (e.g. 1 hour, refreshed on use).
- This is NOT retrieval — it's the *whole* static doc, cached so you don't pay prompt-processing cost/latency every turn.
- Rule of thumb: use this tier when the material is <~50k tokens and always relevant. Use retrieval (4.3) when it's larger or only sometimes relevant.

### 4.3 Long-Term / Episodic Memory (retrieval, grows over the conversation)
- ChromaDB collection per session (or per user if there's login).
- Two kinds of entries:
  - **Ingested knowledge**: chunks of `{{GOAL_MATERIALS}}` (see chunking strategy below).
  - **Learned facts**: things the user tells the bot that should persist ("my team is building X", preferences, decisions) — write these opportunistically after each turn via a lightweight "is this worth remembering?" check (can be a cheap heuristic first, LLM classifier if time allows).
- Retrieval: embed the current user turn, cosine-similarity top-k (k=4–6) from Chroma, inject as "Relevant context" block in the prompt — not the raw chat history.

### 4.4 Chunking Strategy (for `{{GOAL_MATERIALS}}`)
- Chunk size: **500–800 tokens**, **~15% overlap** between chunks (preserves cross-boundary meaning).
- Split on semantic boundaries first (headings/paragraphs), fall back to fixed-size sliding window if the doc has no structure.
- Store metadata per chunk: `{source, chunk_index, heading}` — lets you cite sources in answers.
- Embed with `text-embedding-004`, store vectors + metadata + raw text in Chroma.
- Re-run ingestion whenever a new goal doc is dropped in `data/goal_materials/` (expose `/api/ingest` for this — trigger it manually or on file-watch).

### 4.5 Prompt Assembly Order (in `prompt_builder.py`)
1. System instruction (persona + rules for `{{GOAL_TOPIC}}`)
2. Cached static context (if using 4.2)
3. Retrieved chunks from long-term memory (if using 4.3), labeled "Reference material"
4. Working memory (recent turns)
5. Current user message

## 5. API Surface

| Endpoint | Method | Purpose |
|---|---|---|
| `/ws/chat` | WebSocket | Bidirectional streaming chat. Client sends `{type:"text", session_id, text}`; server streams `{type:"text_delta"}`, `{type:"tool_call"}`, `{type:"done"}`. |
| `/api/session` | POST | Create a new session_id, initialize working memory + Chroma collection. |
| `/api/session/{id}` | DELETE | Reset/clear a session's memory. |
| `/api/ingest` | POST | Upload/point to goal docs → chunk → embed → store in Chroma. |
| `/api/health` | GET | Liveness check. |

## 6. Tool Calling Skeleton

- Tools are plain Python functions with type hints + docstring (Gemini native function calling reads these).
- `tools/registry.py` maps `tool_name -> callable`.
- Flow: Gemini emits `ToolCall` → FastAPI looks up function → executes async → sends `ToolResponse` back into the same Gemini session → Gemini grounds final answer in the result.
- Leave `tools/goal_tools.py` as a stub file with one example tool — tomorrow you just add real `{{GOAL_TOPIC}}` tools (e.g. a lookup, a calculator, a status checker) following the same pattern.

## 7. Config (`.env.example`)

```
GOOGLE_API_KEY=
GEMINI_MODEL=gemini-2.0-flash-exp
EMBEDDING_MODEL=text-embedding-004
WORKING_MEMORY_TURNS=12
CONTEXT_CACHE_TTL_SECONDS=3600
CHROMA_PERSIST_DIR=./chroma_store
```

## 8. Error Handling & Logging

- Wrap every Gemini call in try/except; on failure, degrade gracefully (return a canned "having trouble reaching the model" message, don't crash the WS).
- Structured logging (`logging` module, JSON formatter) — log session_id, latency, token estimate per turn. Useful for the "telemetry" demo point.

## 9. What's Left to Fill In Tomorrow

- `{{GOAL_TOPIC}}` system prompt / persona text.
- `{{GOAL_MATERIALS}}` files dropped into `data/goal_materials/`, then call `/api/ingest`.
- Real functions in `tools/goal_tools.py`.
- Anything else is already wired.
