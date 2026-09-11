# 📖 The Ultimate Guide to ScholarMind (In Plain English!)

Welcome to the **ScholarMind** project guide! This guide explains what the project is, how it works, how to use it, and how to run or deploy it — all in **simple, friendly, non-intimidating language**.

---

## 🌟 Table of Contents
1. [What is ScholarMind?](#1-what-is-scholarmind)
2. [Why UN SDG 4 (Quality Education)?](#2-why-un-sdg-4-quality-education)
3. [How Does It Work? (The Big Picture)](#3-how-does-it-work-the-big-picture)
4. [The 3-Tier Memory Explained Simply](#4-the-3-tier-memory-explained-simply)
5. [Cool Features You Can Try](#5-cool-features-you-can-try)
6. [How to Run ScholarMind on Your Machine](#6-how-to-run-scholarmind-on-your-machine)
7. [Testing the APIs (Easy Examples)](#7-testing-the-apis-easy-examples)
8. [Deploying Online for Free (Zero Cost)](#8-deploying-online-for-free-zero-cost)
9. [Project Folder Tour: Where Everything Lives](#9-project-folder-tour-where-everything-lives)
10. [Troubleshooting & Common Questions](#10-troubleshooting--common-questions)

---

## 1. What is ScholarMind?

**ScholarMind** is an intelligent, personalized **AI Learning Tutor**.

Think of it like having a patient, friendly, private teacher sitting right next to you:
- It doesn't just hand you answers to copy — it **explains concepts step-by-step**.
- It asks you questions to make sure you actually understand.
- It remembers what you discussed earlier in the lesson.
- It can read your textbooks or study notes and quiz you on them.
- It can display interactive charts, quizzes, and achievement badges right in the chat!

---

## 2. Why UN SDG 4 (Quality Education)?

The **United Nations Sustainable Development Goal 4 (SDG 4)** aims to ensure **inclusive, equitable, quality education and promote lifelong learning opportunities for all**.

ScholarMind was built specifically around this goal:
- **No Cost Barrier:** It runs on free models and free hosting so anyone with an internet connection can learn.
- **Adaptive Pacing:** Fast learners can dive deeper; struggling students get gentle hints and encouragement.
- **Socratic Pedagogy:** It fosters critical thinking instead of rote memorization.

---

## 3. How Does It Work? (The Big Picture)

ScholarMind has three main parts working together harmoniously:

```
┌─────────────────────────┐          ┌─────────────────────────┐          ┌─────────────────────────┐
│     The Student UI      │  ──────► │     The Server Brain    │  ──────► │      The AI Engine      │
│       (React 18)        │  ◄────── │        (FastAPI)        │  ◄────── │     (Google Gemini)     │
│  The website you see    │          │  Orchestrates memory,   │          │  Generates explanations │
│  and type into.         │          │  tools & documents.     │          │  and answers.           │
└─────────────────────────┘          └─────────────────────────┘          └─────────────────────────┘
```

1. **Frontend (React 18 + Vite + Tailwind CSS):** The clean, dark-or-light web interface where you chat with the tutor.
2. **Backend (Python + FastAPI):** The traffic controller that handles your messages, checks memory, searches your study notes, and talks to Gemini.
3. **AI Engine (Google Gemini 3.1 Flash-Lite):** Google's cutting-edge AI model that reads and crafts helpful, encouraging responses.

---

## 4. The 3-Tier Memory Explained Simply

Most chatbots forget what you said 5 minutes ago or become painfully slow as the conversation grows. ScholarMind solves this using a **3-tier memory system**, just like a human brain:

| Memory Tier | Human Brain Analogy | What It Actually Does | Where It Lives |
| :--- | :--- | :--- | :--- |
| **Tier 1: Working Memory** | **The Notepad on Your Desk** | Remembers the last 12 messages of your current lesson so you can have a natural conversation back and forth. | Server RAM (In-Memory) |
| **Tier 2: Context Cache** | **The Open Textbook** | Loads large educational guidebooks into Gemini's memory once so they are instantly ready without re-uploading every time. | Google Gemini Cache (TTL 1hr) |
| **Tier 3: Long-Term Memory** | **The Filing Cabinet** | Breaks your study notes into bite-sized chunks, converts them to mathematical vectors, and searches for exact relevant paragraphs when you ask a question. | ChromaDB Vector Store (`./chroma_store`) |

---

## 5. Cool Features You Can Try

### 💬 Dual Chat Engines
- **Instant REST Chat (`/chat`):** Super-fast, lightweight single-turn or multi-turn requests (built especially for quick evaluations and hackathon judging).
- **Real-Time Streaming WebSocket (`/ws/chat/{session_id}`):** Watch the AI type out words live, letter by letter.

### 🎨 Generative UI Cards
The bot doesn't just reply with boring plain text. It can dynamically render interactive cards:
- **StatCard:** Shows progress or quiz score cards.
- **TableCard:** Shows structured comparison tables and timelines.
- **BadgeList:** Shows topic tags and achievements.

### 🧠 The Memory & Ingestion Modal (Click "Memory" in Sidebar)
Want to see what the bot is thinking? Open the Memory modal to:
1. **Inspect Working Memory:** View the raw sliding history of your chat.
2. **Search Long-Term Memory:** Type a query (like *"inclusive education"*) and see which textbook chunks match!
3. **Ingest Documents:** Click the button to automatically index new files from `data/goal_materials/`.

### 🎛️ Model Popover & Temperature Slider
- Pick between **Gemini 3.1 Flash-Lite** (fastest), **Gemini 3.7 Flash** (deep reasoning), or **Gemini 2.5 Flash**.
- Move the **Temperature** slider from $0.0$ (strictly factual) to $1.0$ (creative & exploratory).

### 🌗 3-Way Theme Switcher
Toggle between **Dark Mode**, **Light Mode**, or match your **System Setting** with one click in the top right.

---

## 6. How to Run ScholarMind on Your Machine

### Step 1: Check Your Prerequisites
Make sure you have installed:
- **Python** (version 3.10 or newer)
- **Node.js** (version 18 or newer) with `npm`

### Step 2: Get a Free Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your normal Google account.
3. Click **"Get API key"** and create a key (it's completely free).
4. Copy the key (it starts with `AIzaSy...`).

### Step 3: Set Up Your Secret File (`.env`)
In the root folder of the project (`ScholarMind`), create a file named `.env` and paste:
```env
GOOGLE_API_KEY=your_copied_api_key_here
GEMINI_MODEL=gemini-3.1-flash-lite
EMBEDDING_MODEL=gemini-embedding-001
WORKING_MEMORY_TURNS=12
CONTEXT_CACHE_TTL_SECONDS=3600
CHROMA_PERSIST_DIR=./chroma_store
```

### Step 4: Install Dependencies

**For Backend:**
```bash
pip install -r backend/requirements.txt
```

**For Frontend:**
```bash
cd frontend
npm install
cd ..
```

### Step 5: Start the App!

#### Option A: One-Command Launcher (Easiest!)
Run this single command from the project root:
```bash
python run.py
```
This automatically launches both the backend and the frontend together!

#### Option B: Separate Terminals (If you prefer)
- **Terminal 1 (Backend):**
  ```bash
  uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
  ```
- **Terminal 2 (Frontend):**
  ```bash
  cd frontend
  npm run dev
  ```

Now open your web browser and go to:
👉 **[http://localhost:5173](http://localhost:5173)** (or `http://localhost:8000`)

---

## 7. Testing the APIs (Easy Examples)

You can test ScholarMind using simple `curl` commands in your terminal or via tools like Postman:

### 1. Test If the Server is Awake
```bash
curl http://localhost:8000/health
```
**Output:**
```json
{"status": "ok", "model": "gemini-3.1-flash-lite", "topic": "ScholarMind — SDG 4 Quality Education AI Tutor"}
```

### 2. Send a Message to the Tutor
```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello! What is SDG 4?"}'
```
**Output:**
```json
{
  "response": "Hello! SDG 4 is the United Nations Sustainable Development Goal for Quality Education...",
  "session_id": "c928b12a-...",
  "model": "gemini-3.1-flash-lite"
}
```

### 3. Automatically Ingest Study Materials
```bash
curl -X POST http://localhost:8000/api/ingest/goal_materials
```
**Output:**
```json
{
  "chunks_ingested": 18,
  "message": "Ingested 18 semantic chunks from goal materials."
}
```

---

## 8. Deploying Online for Free (Zero Cost)

You can put ScholarMind live on the web so anyone in the world can use it without paying a single dollar!

### Free Deployment on Render.com (Recommended)
1. Fork or push this repository to your GitHub account.
2. Sign up for free at [Render.com](https://render.com).
3. Click **New +** → **Blueprint**.
4. Select your `ScholarMind` repository.
5. Render detects the included [`render.yaml`](render.yaml) file automatically!
6. Enter your `GOOGLE_API_KEY` when prompted.
7. Click **Apply**.

Render will automatically build the React frontend and Python backend inside a unified Docker container and give you a public HTTPS URL (like `https://scholarmind.onrender.com`).

*(For more cloud choices like Hugging Face Spaces or Koyeb, see [DEPLOYMENT.md](DEPLOYMENT.md))*

---

## 9. Project Folder Tour: Where Everything Lives

Here is a map of the project files and what each one does:

```
ScholarMind/
│
├── backend/                    # The server-side Python code
│   ├── app/
│   │   ├── main.py             # Main entry point; starts FastAPI and hosts the website
│   │   ├── config.py           # Reads settings and API keys from .env
│   │   ├── routes/
│   │   │   ├── tutor.py        # POST /chat and GET /health (the core tutor endpoints)
│   │   │   ├── chat_ws.py      # Real-time WebSocket streaming
│   │   │   ├── ingest.py       # Ingests and indexes documents into ChromaDB
│   │   │   └── session.py      # Manages user chat sessions and history
│   │   ├── memory/
│   │   │   ├── working_memory.py # Keeps track of the last 12 messages
│   │   │   ├── long_term.py    # ChromaDB vector store
│   │   │   └── context_cache.py# Gemini TTL cache
│   │   └── llm/
│   │       ├── gemini_client.py# Talks to Google Gemini with automatic retries
│   │       └── prompt_builder.py# Stitches together prompts, history & study notes
│   └── data/goal_materials/    # Put your markdown (.md) or text (.txt) study notes here!
│
├── frontend/                   # The client-side React code
│   ├── src/
│   │   ├── App.jsx             # The main layout putting all parts together
│   │   ├── components/
│   │   │   ├── SessionHeader.jsx # Top bar with ScholarMind logo and theme switcher
│   │   │   ├── ChatSidebar.jsx # Sidebar showing past chats and temperature slider
│   │   │   ├── MessageList.jsx # Shows the list of messages & Generative UI cards
│   │   │   ├── InputBar.jsx    # The text input box and model selector popover
│   │   │   └── MemoryModal.jsx # The popup to inspect memory and ingest notes
│   │   └── context/ChatContext.jsx # Manages active messages and state
│   └── package.json            # Frontend dependencies
│
├── guide.md                    # THIS FILE: Easy-language documentation
├── README.md                   # Technical project summary and badges
├── DEPLOYMENT.md               # Cloud hosting walkthrough
├── Dockerfile                  # Production container recipe
├── render.yaml                 # 1-click cloud configuration
└── run.py                      # Single command to run the whole app locally
```

---

## 10. Troubleshooting & Common Questions

### ❓ "Vite is not recognized as an internal or external command"
- **Reason:** Frontend packages have not been downloaded yet.
- **Fix:** Open your terminal, run `cd frontend`, then run `npm install`. Once it completes, try again.

### ❓ "ModuleNotFoundError: No module named 'app'"
- **Reason:** You ran `uvicorn` from the root directory instead of using `backend.app.main:app`.
- **Fix:** Either run `python run.py` from the root, OR run:
  ```bash
  uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
  ```

### ❓ "503 Service Unavailable: GOOGLE_API_KEY is not configured"
- **Reason:** The backend cannot find your Gemini key.
- **Fix:** Make sure you created a `.env` file in the project root containing `GOOGLE_API_KEY=AIzaSy...`.

### ❓ "What happens if Gemini hits a rate limit (HTTP 429)?"
- **Answer:** ScholarMind has built-in resilience! It automatically waits a few moments with exponential backoff and retries, and can fall back to `gemini-3.1-flash-lite` so your chat session is never interrupted.

### ❓ "How do I add my own study notes?"
- **Answer:** It's super simple:
  1. Drop any `.md` or `.txt` file into `data/goal_materials/`.
  2. In the web interface, click **Memory** in the sidebar → go to **Document Ingestion** → click **Ingest Goal Materials**.
  3. That's it! The AI tutor will now use your notes when answering questions.

---

**Happy Learning with ScholarMind! 🎓**
