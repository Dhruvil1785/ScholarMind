"""
backend/app/routes/tutor.py

SDG 4 AI Learning Tutor — mandatory hackathon REST endpoint.

POST /chat
  Request body:  {"message": "..."}
  Response body: {"response": "..."}

Design choices:
 - Intentionally avoids Chroma / context_cache to reduce startup risk.
 - Uses WorkingMemory with a fixed session key ("default") so the tutor
   maintains a short-term conversation history across calls in the same
   server process.
 - GOOGLE_API_KEY is read entirely server-side from .env (never exposed
   to the client).
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.app.config import get_settings
from backend.app.deps import dep_gemini, dep_working_memory
from backend.app.llm.gemini_client import GeminiClient
from backend.app.llm.prompt_builder import build_history, build_system_instruction
from backend.app.memory.working_memory import WorkingMemory
from backend.app.schemas.chat import MessageRole

logger = logging.getLogger(__name__)
router = APIRouter(tags=["tutor"])
cfg = get_settings()

# ── Pydantic schemas for the hackathon contract ───────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="The user's message")
    session_id: Optional[str] = Field(
        default=None,
        description="Optional session ID; omit to get a new session each call or pass one to maintain history",
    )
    model: Optional[str] = Field(
        default=None,
        description="Optional model identifier, e.g. gemini-3.5-flash or gemini-3.7-flash",
    )


class ChatResponse(BaseModel):
    response: str
    session_id: str
    model: Optional[str] = None


# ── Helper: collect streaming chunks into a single string ────────────────────

async def _collect_stream(
    gemini: GeminiClient,
    system_instruction: str,
    history: List[Dict[str, Any]],
    user_message: str,
    model: Optional[str] = None,
) -> str:
    """Calls stream_chat and concatenates all text chunks into a single string."""
    parts: List[str] = []
    async for chunk in gemini.stream_chat(
        system_instruction=system_instruction,
        history=history,
        user_message=user_message,
        model=model,
        temperature=0.7,
    ):
        if chunk.text:
            parts.append(chunk.text)
    return "".join(parts)


# ── POST /chat ────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    gemini: GeminiClient = Depends(dep_gemini),
    wm: WorkingMemory = Depends(dep_working_memory),
) -> ChatResponse:
    """
    SDG 4 tutor endpoint — the mandatory judging interface.

    • No Chroma, no context cache, no auth.
    • Maintains short-term conversation history via WorkingMemory if
      the caller passes a session_id across requests.
    • Uses the client's chosen model with automatic fallback to gemini-3.1-flash-lite on rate limits.
    """
    if not gemini.raw_client:
        raise HTTPException(
            status_code=503,
            detail="GOOGLE_API_KEY is not configured on the server.",
        )

    # Use caller-supplied session or create a single-call ephemeral one
    sid = body.session_id or str(uuid.uuid4())
    wm.ensure_session(sid)

    selected_model = (body.model or cfg.gemini_model).strip()
    system_instruction = build_system_instruction(
        custom_system_prompt=cfg.goal_system_prompt,
    )
    history = build_history(wm.get_turns(sid))

    logger.info("tutor.chat: session=%s, model=%s, msg_len=%d", sid, selected_model, len(body.message))

    try:
        reply = await _collect_stream(
            gemini=gemini,
            system_instruction=system_instruction,
            history=history,
            user_message=body.message,
            model=selected_model,
        )
    except Exception as exc:
        logger.exception("tutor.chat.error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Model error: {exc}")

    # Persist both turns in working memory for multi-turn context
    wm.add_turn(sid, MessageRole.USER, body.message)
    wm.add_turn(sid, MessageRole.ASSISTANT, reply)

    return ChatResponse(response=reply, session_id=sid, model=selected_model)


# ── GET /health ───────────────────────────────────────────────────────────────

@router.get("/health")
async def health() -> Dict[str, str]:
    """Fast liveness probe — used to warm the free Render instance before demos."""
    return {"status": "ok", "model": cfg.gemini_model, "topic": cfg.goal_topic}
