# NextGen AI Chatbot — Free Deployment Guide

> **Production Deployment Handbook for Full-Stack FastAPI + React 18 + Gemini Multimodal Agent**  
> Complete step-by-step instructions to host your chatbot **100% free** without requiring paid cloud subscriptions or upfront credit cards.

---

## 1. Architecture & Deployment Strategy

Before deploying, it is crucial to understand how this application communicates:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Browser (HTTPS / WSS)                      │
│   - React 18 SPA (Compiled Vite Bundle in /frontend/dist)              │
│   - WebAudio streaming, Generative UI widgets, Session switcher        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Single Domain (Same Origin)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Unified FastAPI Web Service (Container)              │
│   - Port: $PORT (Dynamic port assigned by host: 8000 / 10000 / 7860)   │
│   - Static Mount: /           -> Serves frontend/dist/index.html       │
│   - REST API:     /api/*      -> Sessions, memory inspection, health   │
│   - WebSocket:    /ws/chat    -> Real-time token deltas & tool events  │
│   - Vector Store: ChromaDB    -> Persistent local embeddings           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS API Calls
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 Google Gemini 2.5/3.1 API (Google AI Studio)           │
└────────────────────────────────────────────────────────────────────────┘
```

### Why Unified Full-Stack Deployment is Recommended
In this repository, FastAPI is already configured in [`backend/app/main.py`](file:///c:/Users/Dhruvil/Downloads/Nextgenchatbot/backend/app/main.py) to mount and serve the compiled React SPA directly from `frontend/dist`. 

This provides three massive advantages on free hosting:
1. **Zero CORS Issues:** REST requests (`/api/*`) and WebSockets (`/ws/chat`) run on the exact same host and protocol (`wss://`).
2. **Single Free Tier Slot:** Free cloud platforms limit users to 1 or 2 free instances. A unified service requires only **one** instance for both frontend and backend.
3. **Automatic SSL & Secure WebSockets:** Modern browsers block unencrypted `ws://` connections when visiting HTTPS sites. Serving both from one HTTPS domain automatically enables secure `wss://`.

---

## 2. Where to Deploy for Free: Platform Comparison

| Platform | Free Tier Specs | WebSocket Support | Credit Card Required? | Cold Start Behavior | Verdict |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **Render.com** *(Recommended)* | 512 MB RAM, 750 free hrs/mo, free SSL | ✅ Native (`wss://`) | ❌ No | Sleeps after 15 min idle; ~40s wake-up | **Best overall choice:** Easiest Git deploy, custom domains, rock-solid WebSockets. |
| **Hugging Face Spaces** | **16 GB RAM**, 2 vCPU, 50 GB storage | ✅ Native (`wss://`) | ❌ No | Stays active while public or receiving traffic | **Best for heavy AI/ML:** Massive free RAM for ChromaDB, free forever. |
| **Koyeb** | 512 MB RAM, 0.1 vCPU, 1 Web Service | ✅ Native (`wss://`) | ❌ No | Minimal latency edge deployments | Great alternative to Render. |
| **Vercel + Render** *(Decoupled)* | Vercel (Static CDN) + Render (FastAPI) | ✅ (via backend URL) | ❌ No | Backend sleeps; frontend stays fast | Good if you want instant landing page loads. |

---

## 3. Pre-Deployment Checklist

### Step 1: Obtain a Free Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **"Get API key"** and create a new key.
4. Copy your key (starts with `AIzaSy...`). *The free tier provides generous rate limits suitable for development and production demos.*

### Step 2: Push Your Project to GitHub
Make sure your code is committed to a GitHub repository:
```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit of NextGen Chatbot"

# Link to your remote GitHub repo and push
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

---

## 4. Deployment Option A: Render.com (Recommended)

Render offers free web services that automatically connect to your GitHub repository and build on every push.

### Method 1: Using the Pre-configured Blueprint (`render.yaml`)
We have created a [`render.yaml`](file:///c:/Users/Dhruvil/Downloads/Nextgenchatbot/render.yaml) file in the repository root.

1. Sign up or log in to [Render.com](https://render.com/).
2. In the Render Dashboard, click **New +** → **Blueprint**.
3. Select your GitHub repository (`Nextgenchatbot`).
4. Render will detect [`render.yaml`](file:///c:/Users/Dhruvil/Downloads/Nextgenchatbot/render.yaml) and automatically configure the service.
5. In the environment variables prompt, enter your `GOOGLE_API_KEY`.
6. Click **Apply**. Render will build the Docker container and provide a live URL (e.g. `https://nextgen-ai-chatbot.onrender.com`).

---

### Method 2: Manual Web Service with Docker (Most Reliable)
If you prefer manual setup via Render's Web UI:

1. In Render Dashboard, click **New +** → **Web Service**.
2. Select **"Build and deploy from a Git repository"** and choose your repository.
3. Set the following settings:
   - **Name:** `nextgen-ai-chatbot` (or your choice)
   - **Region:** Choose the region closest to you (e.g., Oregon, Frankfurt, Singapore)
   - **Branch:** `main`
   - **Language / Runtime:** **Docker**
   - **Dockerfile Path:** `./Dockerfile`
   - **Instance Type:** **Free**
4. Expand **Environment Variables** and add:
   | Key | Value |
   | :--- | :--- |
   | `GOOGLE_API_KEY` | `AIzaSy...` (your key from Google AI Studio) |
   | `GEMINI_MODEL` | `gemini-3.1-flash-lite` |
   | `EMBEDDING_MODEL` | `gemini-embedding-001` |
   | `WORKING_MEMORY_TURNS` | `12` |
   | `CHROMA_PERSIST_DIR` | `/app/chroma_store` |
5. Click **Create Web Service**.
6. Render will automatically execute the multi-stage [`Dockerfile`](file:///c:/Users/Dhruvil/Downloads/Nextgenchatbot/Dockerfile):
   - Stage 1 compiles the React frontend assets with Node 20.
   - Stage 2 installs Python dependencies and sets up Uvicorn.
7. Once deployed, open your `https://<service-name>.onrender.com` URL.

---

### Method 3: Manual Web Service with Native Python (No Docker)
If you prefer using Render's native Python runtime instead of Docker:

1. Click **New +** → **Web Service** → Select your repository.
2. Configure:
   - **Language:** **Python 3**
   - **Build Command:**
     ```bash
     npm --prefix frontend install && npm --prefix frontend run build && pip install -r backend/requirements.txt
     ```
     *(Or simply `./build.sh` using the provided build script)*
   - **Start Command:**
     ```bash
     uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
     ```
3. Add the `GOOGLE_API_KEY` environment variable.
4. Click **Create Web Service**.

---

## 5. Deployment Option B: Hugging Face Spaces (Best for AI & 16 GB RAM)

Hugging Face Spaces provides **16 GB of RAM and 2 vCPUs completely free**, which is ideal for running vector databases like ChromaDB alongside FastAPI.

1. Create a free account at [huggingface.co](https://huggingface.co).
2. Go to [Hugging Face Spaces](https://huggingface.co/spaces) and click **"Create new Space"**.
3. Fill in the Space details:
   - **Space name:** `nextgen-ai-chatbot`
   - **License:** `mit` or `apache-2.0`
   - **Select the Space SDK:** **Docker**
   - **Docker template:** **Blank**
   - **Space hardware:** **CPU basic • 2 vCPU • 16GB RAM (Free)**
4. Click **Create Space**.
5. In your Space's **Settings** tab:
   - Scroll to **Variables and secrets**.
   - Click **New secret**.
   - Name: `GOOGLE_API_KEY`, Value: your Gemini API Key.
6. Push your repository to the Hugging Face Space repository:
   ```bash
   # Add Hugging Face Space as a second git remote
   git remote add space https://huggingface.co/spaces/<your-username>/<your-space-name>
   git push space main --force
   ```
7. Hugging Face Spaces will build using the root [`Dockerfile`](file:///c:/Users/Dhruvil/Downloads/Nextgenchatbot/Dockerfile). 
8. Once built, your chatbot is live at `https://<your-username>-<your-space-name>.hf.space` with 16 GB free RAM!

---

## 6. Deployment Option C: Koyeb (Free Edge Cloud)

Koyeb offers high-performance free micro instances with instant GitHub deployment:

1. Sign up for free at [koyeb.com](https://www.koyeb.com/).
2. Click **Create App**.
3. Choose **GitHub** as the deployment method and select your repository.
4. Set **Builder** to **Dockerfile** (path: `Dockerfile`).
5. Set the Port to `8000`.
6. Add Environment Variable `GOOGLE_API_KEY`.
7. Choose the **Free Eco** instance tier.
8. Click **Deploy**.

---

## 7. Deployment Option D: Decoupled (Vercel Frontend + Render Backend)

If you prefer hosting the React frontend on **Vercel** and the FastAPI backend on **Render**:

### Step 1: Deploy Backend to Render
Deploy following Section 4 (Render) so you have a live backend URL (e.g. `https://my-backend.onrender.com`).

### Step 2: Configure Frontend for Decoupled Mode
When decoupled, the frontend must connect to the external backend instead of relative `/api` paths:
1. In `frontend/.env.production`, specify your backend URL:
   ```env
   VITE_BACKEND_URL=https://my-backend.onrender.com
   ```
2. In `frontend/vite.config.js` or `frontend/src/hooks/useChatSocket.js`, update the WebSocket target:
   ```javascript
   const BACKEND_HOST = import.meta.env.VITE_BACKEND_URL 
     ? new URL(import.meta.env.VITE_BACKEND_URL).host 
     : location.host;
   const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
   const ws = new WebSocket(`${wsProtocol}://${BACKEND_HOST}/ws/chat`);
   ```
3. Push to GitHub and import the `frontend/` folder on [Vercel](https://vercel.com).
4. Set Build Command: `npm run build`, Output Directory: `dist`.

> **Note:** Unified deployment (Section 4 & 5) is far simpler and avoids having to configure cross-origin WebSocket endpoints.

---

## 8. Complete Environment Variables Reference

| Variable | Description | Required? | Default / Example |
| :--- | :--- | :---: | :--- |
| `GOOGLE_API_KEY` | Gemini API Key from Google AI Studio | **Yes** | `AIzaSy...` |
| `GEMINI_MODEL` | Default Gemini model used for inference | No | `gemini-3.1-flash-lite` |
| `EMBEDDING_MODEL` | Embedding model for ChromaDB vectors | No | `gemini-embedding-001` |
| `WORKING_MEMORY_TURNS` | Number of chat turns preserved in sliding window | No | `12` |
| `WORKING_MEMORY_TOKEN_BUDGET` | Max token budget for working memory | No | `3000` |
| `CONTEXT_CACHE_TTL_SECONDS` | Time-to-live for Gemini Context Cache | No | `3600` |
| `CHROMA_PERSIST_DIR` | Directory for vector store persistence | No | `./chroma_store` (or `/app/chroma_store`) |
| `GOAL_TOPIC` | Assistant persona/domain focus | No | `NextGen AI Autonomous Assistant` |
| `PORT` | Web server port (automatically injected by cloud platforms) | Auto | `8000` / `10000` / `7860` |

---

## 9. Verification & Health Monitoring

Once your deployment is running, verify all subsystems:

### 1. Basic Health Check
Open in your browser or run:
```bash
curl https://<your-app-url>/api/health
```
Expected response:
```json
{
  "status": "ok",
  "model": "gemini-3.1-flash-lite",
  "topic": "NextGen AI Autonomous Assistant"
}
```

### 2. Operational Telemetry Check
```bash
curl https://<your-app-url>/api/status
```
Expected response:
```json
{
  "status": "operational",
  "has_api_key": true,
  "default_model": "gemini-3.1-flash-lite",
  "active_sessions": 0,
  "knowledge_chunks": 0
}
```
*If `status` is `"configuration_required"`, verify that `GOOGLE_API_KEY` is set properly in your cloud dashboard.*

### 3. Full UI and Streaming Test
1. Visit `https://<your-app-url>/` in your browser.
2. Verify the top connection indicator shows **"Connected"** (green indicator).
3. Send a test message like:
   ```text
   Hello! Explain quantum computing in 2 sentences.
   ```
4. Confirm that tokens stream smoothly via WebSockets.
5. Click the **Memory (⌘M)** button in the sidebar to inspect the 3-Tier memory state.

---

## 10. Troubleshooting & FAQs

### Q: Why did `uvicorn app.main:app` fail with `ModuleNotFoundError: No module named 'app'` locally?
**Cause:** Python's module import search path (`sys.path`) depends on where you run the command:
- **If running from the root directory (`Nextgenchatbot/`):**
  ```bash
  uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
  # or simply:
  python run.py
  ```
- **If running from inside the `backend/` directory:**
  ```bash
  cd backend
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
  ```

### Q: Render free tier goes to sleep after 15 minutes. How can I keep it warm?
**Solution:** Render spins down free web services after 15 minutes of inactivity. The first request after spin-down takes ~30–45 seconds.  
To prevent spin-down for critical demos:
1. Sign up for a free account at [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com/).
2. Create an HTTP monitor that pings your `/api/health` URL every 10–12 minutes.
3. This keeps the instance warm during your active hours without incurring any costs.

### Q: Does ChromaDB data persist after server restart on free tiers?
**Answer:**
- On Render and Koyeb free tiers, the local filesystem is ephemeral (it resets on new deployments or service restarts).
- In-memory working sessions and sliding memory will re-initialize cleanly.
- If you need persistent document uploads across restarts on the free tier:
  1. Use **Hugging Face Spaces**, which provides persistent local disk.
  2. Or connect a cloud vector database (such as free tiers of **Pinecone**, **Qdrant Cloud**, or **Supabase pgvector**).

### Q: Why do I see a WebSocket connection error?
**Check:**
1. Ensure your browser URL is loaded over `https://`.
2. Inspect browser DevTools (F12) → **Console** and **Network** → **WS**.
3. Verify that the WebSocket URL matches `wss://<your-domain>/ws/chat`.
4. Ensure your cloud provider supports WebSockets (Render, Hugging Face Spaces, and Koyeb support them natively).
