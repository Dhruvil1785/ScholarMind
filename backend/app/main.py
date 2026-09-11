"""
backend/app/main.py — FastAPI application entry point.

Registers all API routes, CORS middleware, static frontend mounting,
and lifespan startup/shutdown for memory and Gemini singletons.
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# Ensure both 'backend.app' and 'app' resolve regardless of working directory
_backend_dir = Path(__file__).resolve().parent.parent
_root_dir = _backend_dir.parent
for _p in (str(_root_dir), str(_backend_dir)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from backend.app.config import AVAILABLE_MODELS, get_settings
from backend.app.deps import (
    dep_context_cache,
    dep_gemini,
    dep_long_term_memory,
    dep_working_memory,
)
from backend.app.routes import chat, chat_ws, ingest, session, tutor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

cfg = get_settings()
BASE_DIR = Path(__file__).resolve().parent.parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Lifespan startup: initializing core singletons...")
    gemini = dep_gemini()
    wm = dep_working_memory()
    ltm = dep_long_term_memory()
    dep_context_cache()
    logger.info(
        "Lifespan startup complete: model=%s, sessions=%d, knowledge_chunks=%d",
        cfg.gemini_model, len(wm.list_sessions()), ltm.count_knowledge_chunks()
    )
    yield
    logger.info("Lifespan shutdown complete.")


app = FastAPI(
    title="ScholarMind — AI Learning Tutor",
    description="Adaptive AI Learning Tutor supporting Quality Education with personalized pacing and assessment",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(tutor.router)          # POST /chat  (hackathon judging endpoint)
app.include_router(chat.router)
app.include_router(chat_ws.router)
app.include_router(session.router)
app.include_router(ingest.router)


@app.get("/api/status")
async def get_status():
    """System operational telemetry and metadata."""
    gemini = dep_gemini()
    wm = dep_working_memory()
    ltm = dep_long_term_memory()
    has_key = bool(gemini.api_key)

    return {
        "status": "operational" if (has_key and gemini.raw_client) else "configuration_required",
        "has_api_key": has_key,
        "default_model": cfg.gemini_model,
        "available_models": AVAILABLE_MODELS,
        "active_sessions": len(wm.list_sessions()),
        "knowledge_chunks": ltm.count_knowledge_chunks(),
        "topic": cfg.goal_topic,
    }


@app.get("/api/health")
async def health_api():
    return {
        "status": "ok",
        "model": cfg.gemini_model,
        "topic": cfg.goal_topic,
    }


# Mount static frontend directory (compiled React SPA)
dist_dir = FRONTEND_DIR / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="frontend")
else:
    @app.get("/")
    async def index():
        return HTMLResponse(
            "<h1>Frontend build not found. Please run <code>npm run build</code> inside frontend/ directory.</h1>",
            status_code=404,
        )
