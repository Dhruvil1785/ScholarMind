"""
backend/app/routes/chat.py — Streaming chat endpoint with 3-tier memory and tool execution.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from google.genai import types as genai_types

from backend.app.config import get_settings
from backend.app.deps import (
    dep_gemini,
    dep_working_memory,
    dep_long_term_memory,
    dep_context_cache,
)
from backend.app.llm.gemini_client import GeminiClient
from backend.app.llm.prompt_builder import (
    build_history,
    build_system_instruction,
    estimate_prompt_tokens,
)
from backend.app.memory.working_memory import WorkingMemory
from backend.app.memory.long_term import LongTermMemory
from backend.app.memory.context_cache import ContextCache
from backend.app.schemas.chat import ChatRequest, MessageRole
from backend.app.tools.registry import execute_tool, get_gemini_tool_declarations

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])
cfg = get_settings()

KNOWLEDGE_COLLECTION = "goal_knowledge"


def _maybe_store_fact(
    user_text: str,
    session_id: str,
    gemini: GeminiClient,
    ltm: LongTermMemory,
) -> Optional[str]:
    """Extract and opportunistically store factual knowledge about the user or project."""
    KEYWORDS = [
        "my team", "we are", "our project", "i am", "i'm", "my name",
        "call me", "we're building", "our team", "project is",
        "my goal", "i prefer", "i work on", "our stack"
    ]
    lower = user_text.lower()
    if any(kw in lower for kw in KEYWORDS):
        try:
            emb = gemini.embed(user_text)
            ltm.store_learned_fact(session_id, user_text, emb)
            logger.info("chat.stored_learned_fact: session=%s", session_id)
            return user_text
        except Exception as e:
            logger.debug("chat.store_fact_failed: %s", e)
    return None


@router.post("/api/chat/stream")
async def chat_stream(
    req: ChatRequest,
    gemini: GeminiClient = Depends(dep_gemini),
    wm: WorkingMemory = Depends(dep_working_memory),
    ltm: LongTermMemory = Depends(dep_long_term_memory),
    cache: Optional[ContextCache] = Depends(dep_context_cache),
):
    """
    Server-Sent Events (SSE) chat stream incorporating:
    - Tier 1 Working Memory (sliding window context)
    - Tier 3 Long-Term Memory (vector search retrieval)
    - Native Tool Calling & Generative UI widgets
    - Live execution telemetry
    """
    prompt = req.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt must not be empty.")

    session_id = req.session_id or str(uuid.uuid4())
    model = req.model or cfg.gemini_model
    temperature = req.temperature if req.temperature is not None else 0.7

    wm.ensure_session(session_id)

    async def event_generator():
        start_time = time.perf_counter()
        ttft_recorded = False
        ttft_ms = 0.0
        full_response_parts: List[str] = []

        # 1. Retrieve knowledge from Tier 3 Long-Term Memory
        retrieved_chunks: List[Dict[str, Any]] = []
        try:
            query_emb = gemini.embed(prompt)
            # Shared knowledge docs
            docs = ltm.retrieve(KNOWLEDGE_COLLECTION, query_emb, k=4)
            # Session-specific learned facts
            facts = ltm.retrieve_session_facts(session_id, query_emb, k=3)
            retrieved_chunks = docs + facts
        except Exception as emb_err:
            logger.warning("chat.embedding_retrieval_failed: %s", emb_err)

        # 2. Build multi-tier prompt
        system_instruction = build_system_instruction(retrieved_chunks or None)
        turns = wm.get_turns(session_id)
        history = build_history(turns)
        token_est = estimate_prompt_tokens(system_instruction, history, prompt)

        yield f"data: {json.dumps({'type': 'telemetry_start', 'session_id': session_id, 'model': model, 'token_est': token_est, 'retrieved_count': len(retrieved_chunks)})}\n\n"

        # 3. Add user turn to Tier 1 Working Memory
        wm.add_turn(session_id, MessageRole.USER, prompt)

        # 4. Stream response from Gemini
        tool_declarations = get_gemini_tool_declarations()
        cached_name = cache.get_cache_name() if cache else None

        try:
            executed_tools = []
            async for chunk in gemini.stream_chat(
                system_instruction=system_instruction,
                history=history,
                user_message=prompt,
                model=model,
                temperature=temperature,
                tools=tool_declarations or None,
                cached_content_name=cached_name,
            ):
                if not ttft_recorded:
                    ttft_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    ttft_recorded = True

                # Handle text streaming
                if chunk.text:
                    full_response_parts.append(chunk.text)
                    yield f"data: {json.dumps({'type': 'text_delta', 'delta': chunk.text})}\n\n"

                # Handle tool / function calls
                if hasattr(chunk, "function_calls") and chunk.function_calls:
                    for fc in chunk.function_calls:
                        tool_id = f"{fc.name}_{int(time.time() * 1000)}"
                        yield f"data: {json.dumps({'type': 'tool_call', 'tool_name': fc.name, 'tool_id': tool_id, 'status': 'running'})}\n\n"

                        # Execute tool
                        args = dict(fc.args) if fc.args else {}
                        result = await execute_tool(fc.name, args)

                        # Check for Generative UI Card payload
                        if isinstance(result, dict) and "_ui_card" in result:
                            ui_card = result["_ui_card"]
                            yield f"data: {json.dumps({'type': 'ui_card', 'card_type': ui_card.get('type'), 'data': ui_card.get('data')})}\n\n"

                        yield f"data: {json.dumps({'type': 'tool_call', 'tool_name': fc.name, 'tool_id': tool_id, 'status': 'done', 'result': result})}\n\n"
                        executed_tools.append({"name": fc.name, "result": result})

            total_duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            accumulated_text = "".join(full_response_parts)

            # Store assistant turn in Working Memory
            if accumulated_text:
                wm.add_turn(session_id, MessageRole.ASSISTANT, accumulated_text)

            # Opportunistically store facts in Tier 3 Long-Term Memory
            stored_fact = _maybe_store_fact(prompt, session_id, gemini, ltm)
            if stored_fact:
                yield f"data: {json.dumps({'type': 'memory_fact', 'fact': stored_fact})}\n\n"

            token_count = max(1, len(accumulated_text) // 4)
            tps = round(token_count / (total_duration_ms / 1000), 1) if total_duration_ms > 0 else 0.0

            yield f"data: {json.dumps({'type': 'telemetry_done', 'ttft_ms': ttft_ms, 'total_duration_ms': total_duration_ms, 'tokens': token_count, 'tokens_per_second': tps, 'retrieved_count': len(retrieved_chunks)})}\n\n"

        except Exception as gen_err:
            err_str = str(gen_err)
            if "503" in err_str or "unavailable" in err_str.lower() or "high demand" in err_str.lower():
                user_msg = "The model is currently experiencing high demand. Please try again in a moment."
            elif "429" in err_str or "quota" in err_str.lower() or "resource_exhausted" in err_str.lower():
                user_msg = "Rate limit reached. Please wait a few seconds before retrying."
            else:
                user_msg = f"Inference exception: {gen_err}"

            yield f"data: {json.dumps({'type': 'error', 'message': user_msg})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
