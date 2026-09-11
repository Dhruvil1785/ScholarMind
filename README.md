# 🎓 ScholarMind — Full-Stack AI Learning Tutor

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Google Gemini](https://img.shields.io/badge/AI-Google_Gemini_3.1-4285F4?style=flat&logo=google&logoColor=white)](https://aistudio.google.com)
[![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **ScholarMind** is an adaptive, goal-aware AI Learning Tutor designed to champion **UN Sustainable Development Goal 4: Quality Education (SDG 4)**. Powered by Google Gemini, FastAPI, React 18, and ChromaDB, ScholarMind delivers personalized learning pacing, structured assessments, generative visual feedback, and a state-of-the-art 3-tier memory hierarchy.

---

## 🌟 Key Capabilities

- **🎯 UN SDG 4 Grounding:** Tailored educational assistance that guides students step-by-step rather than just giving answers, supporting lifelong learning and inclusive education.
- **🧠 3-Tier Cognitive Memory:**
  1. **Working Memory (Sliding Window):** Tracks active multi-turn conversation context up to 12 turns with token-budget management.
  2. **Context Caching (Gemini Explicit Cache):** Pre-caches extensive educational curriculum and guides for zero-latency retrieval.
  3. **Long-Term Episodic Memory (ChromaDB):** Semantic vector search across ingested study materials and user learning progress via `gemini-embedding-001`.
- **⚡ Dual-Engine Transport:**
  - **Hackathon REST API (`POST /chat`):** Instant, reliable request/response endpoint for automated evaluation and quick queries.
  - **Full-Duplex WebSocket (`/ws/chat/{session_id}`):** Real-time progressive token streaming, tool call execution events, and interruption management.
- **🎨 Interactive Generative UI:** Renders rich React widgets dynamically from JSON payloads (`StatCard`, `TableCard`, `BadgeList`) for quizzes, timelines, and progress metrics.
- **🔍 Built-in Memory & Ingestion Inspector:** Embedded modal allowing students and evaluators to inspect memory tiers, run semantic search tests, and upload custom study materials on the fly.
- **🌗 Utilitarian Editorial UI:** Minimalist aesthetic with a 3-way theme toggle (Light / Dark / System), model selector popover, and temperature controls.
- **🚀 100% Free Production Deployment:** Zero-cost deployment blueprints for Render.com and Docker with unified frontend and backend serving.

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                     React 18 Frontend Client (Vite)                    │
│  - Dual-Mode: REST (/chat) + Full-Duplex WebSockets (/ws/chat)         │
│  - Markdown delta streaming + Generative UI Component Widgets          │
│  - 3-Tier Memory & Knowledge Ingestion Modal                           │
│  - Model Popover (Gemini 3.1 Flash-Lite / 2.5 Flash) & Theme Switcher   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Single-Origin HTTP/REST & WSS
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FastAPI Application Gateway                     │
│  - POST /chat             -> Direct judge/tutor endpoint               │
│  - GET /health            -> Rapid liveness probe                      │
│  - /ws/chat/{session_id}  -> Real-time token streamer & tool dispatcher │
│  - /api/ingest            -> Document chunking & vector indexing       │
│  - Static Mount           -> Serves compiled React app from frontend/dist│
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌───────────────────────────────────────┐ ┌──────────────────────────────┐
│          Google Gemini API            │ │      Local Storage Layer     │
│  - gemini-3.1-flash-lite / 2.5 flash  │ │  - Working Memory (In-RAM)   │
│  - Automatic rate-limit retry         │ │  - ChromaDB Vector Store     │
│  - Explicit TTL Context Caching       │ │    (data/goal_materials/)    │
└───────────────────────────────────────┘ └──────────────────────────────┘
```

---

## 📁 Repository Structure

```
ScholarMind/
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI app entry point & static SPA mount
│   │   ├── config.py              # Pydantic Settings & environment configuration
│   │   ├── deps.py                # Dependency injection singletons
│   │   ├── llm/
│   │   │   ├── gemini_client.py   # Gemini client, streaming, & retry handler
│   │   │   └── prompt_builder.py  # System instructions & context assembler
│   │   ├── memory/
│   │   │   ├── working_memory.py  # Sliding-window short-term memory
│   │   │   ├── long_term.py       # ChromaDB vector store & semantic search
│   │   │   └── context_cache.py   # Gemini explicit TTL context caching
│   │   ├── chunking/
│   │   │   └── chunker.py         # Document chunking & metadata tagging
│   │   ├── routes/
│   │   │   ├── tutor.py           # POST /chat & GET /health (Tutor endpoints)
│   │   │   ├── chat.py            # POST /api/chat (REST chat)
│   │   │   ├── chat_ws.py         # WebSocket /ws/chat/{session_id}
│   │   │   ├── ingest.py          # /api/ingest & /api/ingest/goal_materials
│   │   │   └── session.py         # Session management & memory inspection
│   │   ├── schemas/
│   │   │   └── chat.py            # Pydantic request/response/event models
│   │   └── tools/
│   │       ├── registry.py        # Tool calling registry
│   │       └── goal_tools.py      # SDG 4 educational action tools
│   ├── data/
│   │   └── goal_materials/        # Curated SDG 4 study materials (.md, .txt)
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Layout & dual transport orchestration
│   │   ├── components/
│   │   │   ├── ChatSidebar.jsx    # Session history & temperature controls
│   │   │   ├── SessionHeader.jsx  # ScholarMind header & 3-way theme toggle
│   │   │   ├── MessageList.jsx    # Markdown stream & Generative UI list
│   │   │   ├── MessageBubble.jsx  # Formatted chat bubble with source tags
│   │   │   ├── InputBar.jsx       # Input field & model selector popover
│   │   │   ├── MemoryModal.jsx    # 3-tier memory inspector & document ingestor
│   │   │   └── ScholarMindLogo.jsx# Animated SVG logo
│   │   ├── context/
│   │   │   └── ChatContext.jsx    # Global chat state & reducer
│   │   └── hooks/
│   │       └── useChatSocket.js   # WebSocket streaming hook
│   ├── package.json               # Frontend dependencies (React 18, Tailwind, Lucide)
│   └── vite.config.js             # Vite proxy & build configuration
├── guide.md                       # Comprehensive beginner-friendly project guide
├── DEPLOYMENT.md                  # Step-by-step cloud deployment manual (Render, Docker)
├── backend_spec.md                # Detailed backend architectural specification
├── frontend_ui_spec.md            # Frontend design system & component spec
├── Dockerfile                     # Multi-stage production container build
├── render.yaml                    # Render.com Blueprint configuration
├── build.sh                       # Production build automation script
└── run.py                         # Single-command development runner
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & `npm`
- A **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/)

### 2. Clone & Configure Environment
```bash
git clone https://github.com/Dhruvil1785/ScholarMind.git
cd ScholarMind

# Create your .env file
cp .env.example .env   # or create .env in project root
```

Add your Gemini API key to `.env`:
```env
GOOGLE_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
EMBEDDING_MODEL=gemini-embedding-001
WORKING_MEMORY_TURNS=12
CONTEXT_CACHE_TTL_SECONDS=3600
CHROMA_PERSIST_DIR=./chroma_store
```

### 3. One-Command Dev Launcher
Launch both backend and frontend concurrently with live reloading:
```bash
python run.py
```
- **Frontend:** [http://localhost:5173](http://localhost:5173) (proxies to backend)
- **Backend API:** [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 📡 API Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/chat` | **Tutor Chat Endpoint:** Send `{"message": "..."}`, returns `{"response": "..."}`. |
| `GET` | `/health` | **Fast Health Probe:** Liveness check for warming up free instances. |
| `WS` | `/ws/chat/{session_id}` | **WebSocket Stream:** Bidirectional streaming with token deltas & Generative UI. |
| `POST` | `/api/chat` | Full-stack REST chat with session persistence. |
| `POST` | `/api/ingest` | Ingest raw text/files into ChromaDB. |
| `POST` | `/api/ingest/goal_materials` | Auto-indexes all documents in `data/goal_materials/`. |
| `GET` | `/api/session/{session_id}/memory`| Inspect working and long-term memory for a session. |
| `DELETE`| `/api/session/{session_id}` | Reset session history and working memory. |

---

## 🚀 Free Deployment Guide

Deploy ScholarMind 100% free on **Render.com**:
1. Push this repository to GitHub.
2. Log into [Render.com](https://render.com) and click **New +** → **Blueprint**.
3. Select this repository. Render automatically reads `render.yaml`.
4. Enter your `GOOGLE_API_KEY` when prompted and click **Apply**.
5. Once built, your app is live on HTTPS with native WSS support!

For full container instructions and manual setup, read [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 📚 Complete Project Guide

Looking for an in-depth explanation written in plain, friendly English? Check out:
👉 **[guide.md](guide.md)** — Includes full architectural explanations, memory walkthroughs, how to use the UI, and troubleshooting steps.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).