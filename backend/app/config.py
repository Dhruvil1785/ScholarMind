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
    {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "description": "High-speed reasoning and dialogue"},
    {"id": "gemini-3.7-flash", "name": "Gemini 3.7 Flash", "description": "State-of-the-art multimodal reasoning"},
    {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "description": "Complex analysis and code architecture"},
]

DEFAULT_SYSTEM_PROMPT = """You are NextGen AI, a refined, intelligent assistant built with precision, clarity, and deep technical comprehension.
Follow these core interaction guidelines:
1. Provide concise, direct, and well-structured responses.
2. Use GitHub-flavored Markdown for headings, code blocks, bullet points, and tables.
3. For code blocks, always declare the language specifier.
4. If reference material is provided from the knowledge base, ground your response in it and cite relevant sections.
5. You can call registered tools when live information, structured metrics, calculations, or UI cards are helpful.
6. Avoid buzzwords, clichés, and unnecessary emojis; convey authority through precise language.
"""

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
    goal_topic: str = "NextGen AI Autonomous Assistant"
    goal_system_prompt: str = DEFAULT_SYSTEM_PROMPT


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    # Fallback to os.environ if .env didn't populate google_api_key
    if not settings.google_api_key:
        settings.google_api_key = os.getenv("GOOGLE_API_KEY", "").strip()
    return settings
