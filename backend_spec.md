# Backend Specification — ScholarMind AI Learning Tutor (FastAPI + Gemini)

> **Implementation Guide & Architecture Document for ScholarMind Backend**  
> Grounded in **UN Sustainable Development Goal 4: Quality Education (SDG 4)**.

---

## 1. Objective

ScholarMind is an adaptive AI educational tutor designed to:
- Act as an empathetic, pedagogical AI tutor grounded in SDG 4 (inclusive, equitable, quality education).
- Provide real-time streaming responses via WebSockets alongside a rapid-response REST endpoint (`POST /chat`) for testing and hackathon evaluation.
- Implement a 3-tier cognitive memory hierarchy (Working Memory, Context Caching, and Episodic Long-Term Vector Memory).
- Execute educational tools (quiz generator, progress assessment, curriculum query) dynamically via Gemini function calling.
- Fall back gracefully during Gemini rate-limiting periods (automatic retries with exponential backoff and model fallbacks).

---

## 2. Tech Stack

- **Framework:** FastAPI + Uvicorn (Asynchronous, WebSocket-native)
- **LLM Engine:** Google Gemini (`gemini-3.1-flash-lite` default, supporting `gemini-3.7-flash` and `gemini-2.5-flash`) via `google-genai` SDK
- **Embeddings:** `gemini-embedding-001`
- **Short-Term Session Memory:** In-memory sliding-window turn history (`WorkingMemory`)
- **Long-Term / Episodic Memory:** ChromaDB vector database with persistent local storage
- **Validation & Schemas:** Pydantic v2 Settings and Data Models
- **Document Chunking:** Heading/paragraph-aware semantic splitter with overlap

---

## 3. Directory Structure

```
backend/
├── app/
│   ├── main.py                # FastAPI app initialization, CORS, routers & SPA static mount
│   ├── config.py              # Settings loaded from environment/.env
│   ├── deps.py                # Shared dependency injection singletons
│   │
│   ├── memory/
│   │   ├── working_memory.py  # In-memory sliding-window turn history per session
│   │   ├── long_term.py       # ChromaDB vector collection read/write & search
│   │   └── context_cache.py   # Gemini explicit TTL context cache manager
│   │
│   ├── chunking/
│   │   └── chunker.py         # Markdown/text semantic chunker & metadata extractor
│   │
│   ├── tools/
│   │   ├── registry.py        # Maps tool names to callable Python async functions
│   │   └── goal_tools.py      # SDG 4 specific tools (quiz generation, skill evaluation)
│   │
│   ├── llm/
│   │   ├── gemini_client.py   # Singleton client with retry logic & stream generator
│   │   └── prompt_builder.py  # Assembles system prompt, cached docs, long-term memory & history
│   │
│   ├── schemas/
│   │   └── chat.py            # Pydantic request/response & WebSocket event models
│   │
│   └── routes/
│       ├── tutor.py           # POST /chat and GET /health (Hackathon judging endpoints)
│       ├── chat.py            # POST /api/chat (REST chat with persistence)
│       ├── chat_ws.py         # WebSocket /ws/chat/{session_id} (Token streaming)
│       ├── ingest.py          # /api/ingest & /api/ingest/goal_materials
│       └── session.py         # Session lifecycle & memory inspection
│
├── data/
│   └── goal_materials/        # Curated SDG 4 educational guides and architecture docs
├── requirements.txt           # Python dependencies
└── .env.example
```

---

## 4. Memory Architecture (3-Tier Hierarchy)

### 4.1 Working Memory (Short-Term Conversational Context)
- **File:** [`backend/app/memory/working_memory.py`](backend/app/memory/working_memory.py)
- Tracks the last $N$ turns (default $N=12$) per `session_id`.
- Automatically enforces a token budget (~3,000 tokens) using a sliding window:
  - When the budget is exceeded, older turns are trimmed first.
  - The most recent user-assistant exchange is always preserved.
- Enables contextual multi-turn tutoring without unbounded token growth.

### 4.2 Context Caching (Static Curriculum Knowledge)
- **File:** [`backend/app/memory/context_cache.py`](backend/app/memory/context_cache.py)
- Uses Gemini's **explicit context caching** (`client.caches.create(...)`) with a 1-hour time-to-live (`TTL=3600s`).
- Ideal for large, static documents (>32k tokens) such as national curriculum frameworks, SDG 4 whitepapers, or institutional rubrics.
- Slashes Time to First Token (TTFT) and significantly reduces compute costs on repetitive queries.

### 4.3 Long-Term / Episodic Memory (Semantic Vector Storage)
- **File:** [`backend/app/memory/long_term.py`](backend/app/memory/long_term.py)
- Backed by **ChromaDB** with persistence in `./chroma_store`.
- Stores two categories of vectors:
  1. **Curriculum & Guide Material:** Chunked text from `data/goal_materials/` tagged with file sources.
  2. **Learned Student Insights:** Key student milestones, learning pace, and preferences recorded during tutoring.
- Retrieval retrieves top-$k$ ($k=4$) semantically similar chunks based on cosine similarity with `gemini-embedding-001`.

---

## 5. Prompt Assembly Pipeline

In [`backend/app/llm/prompt_builder.py`](backend/app/llm/prompt_builder.py), context is assembled in strict hierarchical priority:
1. **System Instruction:** Establishes the ScholarMind persona — encouraging, pedagogical, Socratic, aligned with SDG 4.
2. **Context-Cached Materials:** Pre-loaded large static documents (if active).
3. **Retrieved Long-Term Memory:** Relevant snippets retrieved from ChromaDB labeled `"Reference Knowledge Base"`.
4. **Working Memory History:** Recent dialogue turns formatted as alternating user/model exchanges.
5. **Current User Prompt:** The active student query.

---

## 6. API Reference

### Tutor Judging Endpoints (Direct & Lightweight)
- **`POST /chat`**
  - **Body:** `{"message": "string", "session_id": "optional_string", "model": "optional_string"}`
  - **Response:** `{"response": "string", "session_id": "string", "model": "string"}`
  - **Characteristics:** Intentionally decoupled from heavy vector lookups to provide instant, sub-second responses during judging and automated test suites.
- **`GET /health`**
  - **Response:** `{"status": "ok", "model": "...", "topic": "..."}`
  - **Usage:** Rapid ping for cloud liveness and uptime monitors.

### Full-Stack & Streaming Endpoints
- **`WebSocket /ws/chat/{session_id}`**
  - Streams tokens (`text_delta`), tool execution indicators (`tool_call`), and Generative UI widgets (`ui_card`).
- **`POST /api/chat`**
  - REST endpoint integrating working memory, ChromaDB retrieval, and tool execution.
- **`POST /api/ingest`**
  - Upload raw text or files to be chunked and indexed into ChromaDB.
- **`POST /api/ingest/goal_materials`**
  - Scans `data/goal_materials/` and `backend/data/goal_materials/` to ingest all educational documents automatically.
- **`GET /api/session/{session_id}/memory`**
  - Returns active turns in working memory and count of indexed knowledge chunks.
- **`DELETE /api/session/{session_id}`**
  - Clears conversational context for the given session.

---

## 7. Resilience & Rate-Limit Strategy

In [`backend/app/llm/gemini_client.py`](backend/app/llm/gemini_client.py):
- **Exponential Backoff:** Retries 429 rate-limit responses up to 3 times with jitter.
- **Fallback Models:** If the primary model (`gemini-3.1-flash-lite`) encounters quota exhaustion, requests automatically fall back to alternative available flash models.
- **Graceful Error Bubbling:** Errors emit structured JSON messages without terminating WebSocket connections.
