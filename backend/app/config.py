"""
backend/app/config.py — Central configuration loaded from environment and defaults.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Dict

AVAILABLE_MODELS: List[Dict[str, str]] = [
    {"id": "gemini-3.1-flash-lite", "name": "Gemini 3.1 Flash Lite", "description": "Ultra-fast low-latency reasoning and dialogue"},
    {"id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash", "description": "High-speed multimodal reasoning and dialogue"},
    {"id": "gemini-3.7-flash", "name": "Gemini 3.7 Flash", "description": "State-of-the-art multimodal reasoning with thinking depth"},
]

SDG4_TUTOR_PROMPT = """You are ScholarMind, an AI Learning Tutor dedicated to Quality Education.

Your job:
- Explain concepts clearly, adapting depth to the learner's level (ask if unsure: beginner/intermediate/advanced).
- After explaining a concept, offer 2-3 practice questions on request.
- Give constructive feedback on answers — say what's right, gently correct what's wrong, don't just give the answer away first; guide toward it.
- Adapt pacing: if the user seems confused, simplify and use an analogy; if they seem confident, go deeper.

Rules:
- Stay focused on educational/tutoring topics. If asked something unrelated, redirect politely to learning.
- Never claim certainty you don't have — if a topic is contested or you're unsure, say so.
- Keep answers concise and structured (short paragraphs, bullet points, numbered steps) — this is a chat UI, not an essay.
- Be encouraging but honest about mistakes."""

DEFAULT_SYSTEM_PROMPT = SDG4_TUTOR_PROMPT

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- LLM ---
    google_api_key: str = ""
    gemini_model: str = "gemini-3.1-flash-lite"
    embedding_model: str = "gemini-embedding-001"

    # --- Memory ---
    working_memory_turns: int = 12
    working_memory_token_budget: int = 3000

    # --- Context Cache ---
    context_cache_ttl_seconds: int = 3600

    # --- ChromaDB ---
    chroma_persist_dir: str = "./chroma_store"

    # --- Chunking ---
    chunk_size_tokens: int = 650
    chunk_overlap_pct: float = 0.15

    # --- Domain Persona & Materials ---
    goal_topic: str = "ScholarMind - AI Learning Tutor"
    goal_system_prompt: str = SDG4_TUTOR_PROMPT


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Fallback to os.environ if .env didn't populate google_api_key
    if not settings.google_api_key:
        settings.google_api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    return settings
