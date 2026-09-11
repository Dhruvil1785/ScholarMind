"""
backend/app/deps.py — Shared FastAPI dependencies (singletons injected via Depends).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from backend.app.config import Settings, get_settings
from backend.app.llm.gemini_client import GeminiClient, get_gemini_client
from backend.app.memory.working_memory import WorkingMemory, get_working_memory
from backend.app.memory.long_term import LongTermMemory, get_long_term_memory
from backend.app.memory.context_cache import ContextCache, init_context_cache


def dep_settings() -> Settings:
    return get_settings()


def dep_gemini() -> GeminiClient:
    return get_gemini_client()


def dep_working_memory() -> WorkingMemory:
    return get_working_memory()


def dep_long_term_memory() -> LongTermMemory:
    return get_long_term_memory()


@lru_cache
def dep_context_cache() -> Optional[ContextCache]:
    cfg = get_settings()
    client = get_gemini_client().raw_client
    if client:
        return init_context_cache(client, ttl_seconds=cfg.context_cache_ttl_seconds)
    return None
