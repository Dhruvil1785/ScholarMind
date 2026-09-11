# Architecture Specification: NextGen Multimodal AI Agent

> **Document Purpose:** Complete architectural context, implementation patterns, memory hierarchies, and operational rules for building a next-generation real-time multimodal conversational agent using Google Gemini, FastAPI, and React.

---

## 1. System High-Level Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                          React Frontend Client                         │
│  - AudioWorklet (16kHz PCM Micro-streamer)                             │
│  - Web Audio API (24kHz Raw PCM Audio Stream Player)                  │
│  - Streaming Markdown + Generative UI Component Renderer               │
│  - Agent State & Latency Telemetry Widget                              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Bidirectional Full-Duplex WebSocket
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FastAPI Gateway / Orchestrator                  │
│  - WebSocket Connection & Session State Manager                        │
│  - Real-time Audio/Text Stream Multiplexer                             │
│  - Tool Interceptor & Asynchronous Execution Engine                    │
│  - Local Sliding Memory & Ephemeral Buffer                             │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌───────────────────────────────────────┐ ┌──────────────────────────────┐
│       Google Gemini 2.0 Flash         │ │   Memory & State Backplane   │
│  - Multimodal Live API (Bidirectional)│ │  - Redis (Ephemeral/Session) │
│  - Explicit Context Caching (TTL-based│ │  - ChromaDB / SQLite Vector   │
│  - Native Function / Tool Calling     │ │    (Long-Term Episodic)      │
│  - In-Band Interruption / Barge-in    │ └──────────────────────────────┘
└───────────────────────────────────────┘
```

---

## 2. Core Architectural Pillars

### 2.1 LLM Engine & Multimodal Voice Layer
* **Model Choice:** Google Gemini 2.0 Flash via the **Multimodal Live API** (`google-genai` SDK).
* **Audio Protocol:**
  * **Input:** Raw 16kHz linear PCM (Little-Endian, single channel / mono), chunked and streamed every 100ms–200ms over WebSocket frames.
  * **Output:** Streamed 24kHz raw PCM audio paired with synchronized text delta tokens.
* **Barge-in / Interruption Handling:**
  * Native capability. When user audio energy crosses the voice activity threshold during agent playback, Gemini immediately halts its generation pipeline.
  * The frontend audio queue must clear pending playback buffers upon receipt of an `interrupted` event to eliminate voice overlap.

### 2.2 Memory Hierarchy & Context Caching
The agent must implement a three-tiered memory architecture:

1. **Working Memory (In-Band Sliding Window):**
   * Manages current session turns (up to $N$ recent interactions).
   * Maintained in FastAPI session state or Redis.
2. **Context Caching (Gemini Explicit Cache):**
   * Used for static domain materials, hackathon problem rules, API documentation, or heavy operational manuals ($>32	ext{k}$ tokens).
   * Instantiated via `client.caches.create(model=..., config=..., ttl=...)`.
   * Drastically lowers latency (Time to First Token) and optimizes compute cost.
3. **Episodic Long-Term Memory (Semantic Retrieval):**
   * Stores profile attributes, verified user facts, and cross-session preferences.
   * Backed by lightweight vector storage (ChromaDB / Qdrant) using `text-embedding-004`.

### 2.3 Tool Calling & Autonomous Execution
* Tools are registered using strict Python type annotations and Pydantic schemas.
* **Execution Flow:**
  1. Gemini recognizes user intent requiring operational data $
ightarrow$ emits a structured `ToolCall`.
  2. FastAPI interceptor isolates the call, displays an `"Executing Tool: [tool_name]"` state to the client, and evaluates the routine asynchronously.
  3. Formatted JSON results return to Gemini as a `ToolResponse`.
  4. Gemini completes the generation loop, grounding its voice and textual response in the tool's output.

---

## 3. Implementation Blueprints

### 3.1 FastAPI WebSocket Gateway Blueprint

```python
import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

app = FastAPI(title="NextGen Agent Core")
client = genai.Client()

# Tool Definitions
def get_system_status(service_name: str) -> dict:
    """Checks operational health and metrics for a given service."""
    return {"service": service_name, "status": "healthy", "latency_ms": 28}

tools_list = [get_system_status]

@app.websocket("/ws/agent")
async def agent_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    # Establish Gemini Live Bidirectional Session
    config = types.LiveConnectConfig(
        response_modalities=[types.LiveModality.AUDIO, types.LiveModality.TEXT],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
            )
        ),
        tools=[{"function_declarations": tools_list}]
    )

    async with client.aio.live.connect(model="gemini-2.0-flash-exp", config=config) as session:
        async def client_to_gemini():
            try:
                while True:
                    data = await websocket.receive_text()
                    payload = json.loads(data)
                    
                    if payload.get("type") == "audio_pcm":
                        # Send 16kHz PCM chunk
                        await session.send(
                            input={"data": payload["data"], "mime_type": "audio/pcm;rate=16000"},
                            end_of_turn=False
                        )
                    elif payload.get("type") == "text":
                        await session.send(input=payload["text"], end_of_turn=True)
            except WebSocketDisconnect:
                pass

        async def gemini_to_client():
            try:
                async for response in session.receive():
                    server_content = response.server_content
                    if server_content is None:
                        continue
                    
                    # Interruption signal
                    if server_content.interrupted:
                        await websocket.send_json({"type": "interrupted"})
                        continue
                    
                    # Audio and Text chunks
                    model_turn = server_content.model_turn
                    if model_turn:
                        for part in model_turn.parts:
                            if part.inline_data:
                                await websocket.send_json({
                                    "type": "audio",
                                    "data": part.inline_data.data
                                })
                            if part.text:
                                await websocket.send_json({
                                    "type": "text_delta",
                                    "text": part.text
                                })
                                
                    # Tool call triggers
                    if response.tool_call:
                        for call in response.tool_call.function_calls:
                            # Execute mapped function asynchronously
                            # Send tool_response back to Gemini session
                            pass
            except Exception as e:
                await websocket.send_json({"type": "error", "message": str(e)})

        await asyncio.gather(client_to_gemini(), gemini_to_client())
```

### 3.2 Frontend (React) Audio Pipeline Specification

1. **Input AudioWorklet:**
   * Downsamples browser microphone stream to `16000 Hz` mono.
   * Converts Float32 arrays to Int16 Little-Endian PCM buffers.
   * Dispatches chunks over the WebSocket every $120	ext{ms}$.
2. **Output Playback Engine:**
   * Maintains an internal jitter buffer using the Web Audio API `AudioContext` (`sampleRate: 24000`).
   * Decodes Base64 PCM data to audio buffers and queues playback with precise sample-offset scheduling.
   * When an `interrupted` packet arrives from the server, immediately triggers `audioContext.suspend()`, drains the playback queue, and restarts the context.

---

## 4. Competitive Hackathon Differentiators

| Feature | Technical Focus | Impact on Scoring |
| :--- | :--- | :--- |
| **Generative UI Cards** | Structured JSON events rendered as React widgets (tables, charts, badges) | Replaces flat text with rich visual feedback |
| **Barge-in Voice UX** | Real-time interruption without audio echo or buffer lag | Validates natural, human-like voice interaction |
| **Explicit Context Caching** | Token pre-compilation via `client.caches` | Sub-500ms TTFT; zero latency overhead on heavy knowledge bases |
| **Realtime Vision Ingestion** | Canvas webcam/screen frame capture sent alongside voice | Unlocks live visual QA, debugging, and document analysis |
| **Telemetry & Latency Counter** | Header HUD displaying TTFT and frame roundtrip latency | Demonstrates production readiness and performance engineering |

---

## 5. Pre-Flight Checklist for Build Day

- [ ] **API Keys & Quotas:** Google AI Studio Gemini API key active with access to Gemini 2.0 Live features.
- [ ] **Environment Setup:** Python 3.11+, Node 20+, `uv` or `poetry` package manager configured.
- [ ] **Core Dependencies:**
  - Backend: `fastapi`, `uvicorn[standard]`, `google-genai`, `pydantic`, `chromadb`.
  - Frontend: `vite`, `react`, `lucide-react`, `tailwindcss`, `eventsource` / native WebSockets.
- [ ] **Tool Skeleton Ready:** Generic async tool templates pre-written for HTTP fetch, local SQLite query, and structured schema responses.
- [ ] **Zero-CSS Template:** Tailwind typography and clean dark-mode shell ready for dynamic generative UI elements.