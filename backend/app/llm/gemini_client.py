"""
backend/app/llm/gemini_client.py — Singleton Gemini client with exponential retry and streaming.
"""
from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Any, AsyncGenerator, Dict, List, Optional

from google import genai
from google.genai import types as genai_types

from backend.app.config import get_settings

logger = logging.getLogger(__name__)
cfg = get_settings()


def _is_rate_limit_or_fallback_error(exc: Exception) -> bool:
    """Detect rate limits (429, quota), resource exhaustion, or model unavailable/not found."""
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if code in (404, 429, 503):
        return True
    err_str = str(exc).lower()
    keywords = [
        "429",
        "rate limit",
        "resource_exhausted",
        "quota",
        "too many requests",
        "exhausted",
        "not found",
        "404",
        "unavailable",
        "not supported",
    ]
    return any(kw in err_str for kw in keywords)


def _is_retryable_error(exc: Exception) -> bool:
    """Determine whether an error is transient (e.g. 503 unavailable, 429 rate limit)."""
    code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    if code in (429, 500, 502, 503, 504):
        return True
    err_str = str(exc).lower()
    keywords = [
        "503",
        "429",
        "unavailable",
        "high demand",
        "rate limit",
        "resource_exhausted",
        "timeout",
        "connection reset",
        "server error",
    ]
    return any(kw in err_str for kw in keywords)


class GeminiClient:
    """Thread-safe singleton wrapping google.genai.Client with retry logic."""

    def __init__(self) -> None:
        self.api_key = cfg.google_api_key
        self._client: Optional[genai.Client] = None
        self._default_model = cfg.gemini_model.strip().lower()
        self._embedding_model = cfg.embedding_model.strip().lower()
        self._init_client()

    def _init_client(self) -> None:
        if self.api_key:
            try:
                self._client = genai.Client(api_key=self.api_key)
                logger.info(
                    "gemini_client.initialized: default_model=%s, embedding_model=%s",
                    self._default_model, self._embedding_model
                )
            except Exception as e:
                logger.error("gemini_client.init_failed: %s", e)
                self._client = None
        else:
            logger.warning("gemini_client: GOOGLE_API_KEY is missing or empty.")

    @property
    def raw_client(self) -> Optional[genai.Client]:
        return self._client

    async def stream_chat(
        self,
        system_instruction: str,
        history: List[Dict[str, str]],
        user_message: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        tools: Optional[List[Dict[str, Any]]] = None,
        cached_content_name: Optional[str] = None,
        max_retries: int = 3,
        base_delay: float = 1.0,
    ) -> AsyncGenerator[genai_types.GenerateContentResponse, None]:
        """
        Yield streaming chunks with exponential backoff retry on transient errors.
        """
        if not self._client:
            raise ValueError("Gemini Client is uninitialized. Configure GOOGLE_API_KEY in .env.")

        selected_model = (model or self._default_model).strip().lower()

        # Build contents array
        contents: List[genai_types.Content] = []
        for turn in history:
            contents.append(
                genai_types.Content(
                    role=turn["role"],
                    parts=[genai_types.Part.from_text(text=turn["content"])],
                )
            )
        contents.append(
            genai_types.Content(
                role="user",
                parts=[genai_types.Part.from_text(text=user_message)],
            )
        )

        gen_config = genai_types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
            max_output_tokens=3072,
        )

        if tools:
            gen_config.tools = [
                genai_types.Tool(function_declarations=tools)
            ]
        if cached_content_name:
            gen_config.cached_content = cached_content_name

        loop = asyncio.get_event_loop()

        FALLBACK_MODEL = "gemini-3.1-flash-lite"
        has_fallen_back = False

        for attempt in range(1, max_retries + 1):
            chunks_yielded = 0
            start_time = time.perf_counter()
            try:
                def make_stream(cur_model):
                    return self._client.models.generate_content_stream(
                        model=cur_model,
                        contents=contents,
                        config=gen_config,
                    )

                stream = await loop.run_in_executor(None, make_stream, selected_model)

                def get_next(iterator):
                    try:
                        return next(iterator), False
                    except StopIteration:
                        return None, True
                    except Exception as ex:
                        raise ex

                while True:
                    chunk, is_done = await loop.run_in_executor(None, get_next, stream)
                    if is_done:
                        break
                    chunks_yielded += 1
                    yield chunk

                latency = time.perf_counter() - start_time
                logger.info("gemini_client.stream_done: model=%s, latency=%.2fs", selected_model, latency)
                return

            except Exception as exc:
                latency = time.perf_counter() - start_time

                # Automatic fallback on rate limit / resource exhaustion / model error before chunks yielded
                if chunks_yielded == 0 and not has_fallen_back and selected_model != FALLBACK_MODEL and _is_rate_limit_or_fallback_error(exc):
                    logger.warning(
                        "gemini_client.rate_limit_fallback: model '%s' encountered rate limit or error (%s). Seamlessly falling back to '%s'.",
                        selected_model, exc, FALLBACK_MODEL
                    )
                    selected_model = FALLBACK_MODEL
                    has_fallen_back = True
                    continue

                if chunks_yielded > 0 or attempt == max_retries or not _is_retryable_error(exc):
                    logger.error(
                        "gemini_client.stream_error (attempt %d/%d, model=%s): %s (latency=%.2fs)",
                        attempt, max_retries, selected_model, exc, latency
                    )
                    raise

                delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0.1, 0.4)
                logger.warning(
                    "gemini_client.transient_error (attempt %d/%d, model=%s) — retry in %.2fs: %s",
                    attempt, max_retries, selected_model, delay, exc
                )
                await asyncio.sleep(delay)

    def embed(self, text: str, max_retries: int = 3, base_delay: float = 1.0) -> List[float]:
        """Generate embedding vector for a string."""
        if not self._client:
            raise ValueError("Gemini Client uninitialized. Check GOOGLE_API_KEY.")

        for attempt in range(1, max_retries + 1):
            try:
                response = self._client.models.embed_content(
                    model=self._embedding_model,
                    contents=text,
                )
                return response.embeddings[0].values
            except Exception as exc:
                if attempt == max_retries or not _is_retryable_error(exc):
                    logger.error("gemini_client.embed_failed: %s", exc)
                    raise
                delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0.1, 0.3)
                time.sleep(delay)
        raise RuntimeError("Embed retries exhausted")

    def embed_batch(self, texts: List[str], max_retries: int = 3, base_delay: float = 1.0) -> List[List[float]]:
        """Batch embedding with fallback to individual calls."""
        if not texts:
            return []
        if not self._client:
            raise ValueError("Gemini Client uninitialized. Check GOOGLE_API_KEY.")

        for attempt in range(1, max_retries + 1):
            try:
                response = self._client.models.embed_content(
                    model=self._embedding_model,
                    contents=texts,
                )
                return [e.values for e in response.embeddings]
            except Exception as exc:
                if attempt == max_retries or not _is_retryable_error(exc):
                    logger.warning("gemini_client.embed_batch fallback to sequential: %s", exc)
                    return [self.embed(t) for t in texts]
                delay = base_delay * (2 ** (attempt - 1)) + random.uniform(0.1, 0.3)
                time.sleep(delay)
        return [self.embed(t) for t in texts]


_gemini_client: Optional[GeminiClient] = None


def get_gemini_client() -> GeminiClient:
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client
