"""
backend/app/memory/context_cache.py — Explicit Gemini context caching manager.

Tier 2 Context Cache:
  - Facilitates Gemini's explicit context caching (client.caches.create) with a defined TTL.
  - Used for static reference documentation to reduce latency and token costs.
  - Degrades gracefully if the model or tier does not support server-side caching.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class CachedContext:
    cache_name: str
    content_hash: str
    created_at: float = field(default_factory=time.time)
    expires_at: float = 0.0


class ContextCache:
    """Manages Gemini explicit context cache for static domain documentation."""

    def __init__(self, genai_client, ttl_seconds: int = 3600) -> None:
        self._client = genai_client
        self._ttl = ttl_seconds
        self._cache: Optional[CachedContext] = None

    def get_cache_name(self) -> Optional[str]:
        if self._cache is None:
            return None
        if time.time() >= self._cache.expires_at:
            logger.info("context_cache.expired — resetting cache state")
            self._cache = None
            return None
        return self._cache.cache_name

    async def create_or_refresh(
        self,
        model: str,
        system_instruction: str,
        static_content: str,
        content_hash: str,
    ) -> Optional[str]:
        existing = self.get_cache_name()
        if existing and self._cache and self._cache.content_hash == content_hash:
            return existing

        try:
            from google.genai import types as genai_types

            cache = self._client.caches.create(
                model=model,
                config=genai_types.CreateCachedContentConfig(
                    system_instruction=system_instruction,
                    contents=[
                        genai_types.Content(
                            role="user",
                            parts=[genai_types.Part(text=static_content)],
                        )
                    ],
                    ttl=f"{self._ttl}s",
                    display_name="goal_context_cache",
                ),
            )
            self._cache = CachedContext(
                cache_name=cache.name,
                content_hash=content_hash,
                expires_at=time.time() + self._ttl - 60,
            )
            logger.info("context_cache.created: cache_name=%s", cache.name)
            return cache.name

        except Exception as exc:
            logger.warning("context_cache.create_failed (degrading gracefully): %s", exc)
            return None

    def invalidate(self) -> None:
        self._cache = None


_context_cache: Optional[ContextCache] = None


def get_context_cache() -> Optional[ContextCache]:
    return _context_cache


def init_context_cache(genai_client, ttl_seconds: int = 3600) -> ContextCache:
    global _context_cache
    _context_cache = ContextCache(genai_client, ttl_seconds)
    return _context_cache
