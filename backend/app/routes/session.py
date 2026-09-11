"""
backend/app/routes/session.py — Session lifecycle and Memory Inspector endpoints.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.app.deps import dep_working_memory, dep_long_term_memory
from backend.app.memory.working_memory import WorkingMemory
from backend.app.memory.long_term import LongTermMemory
from backend.app.schemas.chat import SessionCreateResponse, SessionDeleteResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["session"])


class ClearSessionBody(BaseModel):
    session_id: str


@router.post("/api/session", response_model=SessionCreateResponse)
async def create_session(
    wm: WorkingMemory = Depends(dep_working_memory),
    ltm: LongTermMemory = Depends(dep_long_term_memory),
) -> SessionCreateResponse:
    """Initialize a new conversation session, working memory window, and vector store collection."""
    session_id = str(uuid.uuid4())
    wm.ensure_session(session_id)
    ltm._get_or_create(ltm._collection_name(session_id))
    logger.info("session.created: %s", session_id)
    return SessionCreateResponse(session_id=session_id, message="Session initialized.")


@router.delete("/api/session/{session_id}", response_model=SessionDeleteResponse)
async def delete_session(
    session_id: str,
    wm: WorkingMemory = Depends(dep_working_memory),
    ltm: LongTermMemory = Depends(dep_long_term_memory),
) -> SessionDeleteResponse:
    """Clear working memory and delete the session's episodic ChromaDB collection."""
    wm.clear(session_id)
    ltm.delete_session(session_id)
    logger.info("session.deleted: %s", session_id)
    return SessionDeleteResponse(session_id=session_id, message="Session cleared.")


@router.post("/api/sessions/clear")
async def clear_session_compat(
    body: ClearSessionBody,
    wm: WorkingMemory = Depends(dep_working_memory),
    ltm: LongTermMemory = Depends(dep_long_term_memory),
):
    """Compatibility endpoint for clearing session via JSON POST."""
    wm.clear(body.session_id)
    ltm.delete_session(body.session_id)
    return {"status": "cleared", "session_id": body.session_id}


@router.get("/api/session/{session_id}/memory")
async def get_session_memory(
    session_id: str,
    wm: WorkingMemory = Depends(dep_working_memory),
    ltm: LongTermMemory = Depends(dep_long_term_memory),
) -> Dict[str, Any]:
    """
    Inspector endpoint for Tier 1 Working Memory and Tier 3 Learned Facts.
    Used by the Memory Modal.
    """
    active_id = session_id
    if not active_id or active_id in ("null", "undefined", ""):
        active_sessions = wm.list_sessions()
        active_id = active_sessions[0] if active_sessions else "default"

    turns = wm.get_turns(active_id)
    total_tokens = sum(t.token_estimate for t in turns)
    facts = ltm.get_session_facts(active_id)

    return {
        "session_id": active_id,
        "turn_count": len(turns),
        "max_turns": wm.max_turns,
        "token_estimate": total_tokens,
        "token_count": total_tokens,
        "token_budget": wm.token_budget,
        "turns": [
            {
                "role": t.role,
                "content": t.content,
                "tokens": t.token_estimate,
                "ts": t.ts,
            }
            for t in turns
        ],
        "learned_facts": facts,
        "facts": facts,
    }


@router.get("/api/sessions")
async def list_sessions(
    wm: WorkingMemory = Depends(dep_working_memory),
) -> Dict[str, List[Dict[str, Any]]]:
    """Overview of all active sessions in working memory."""
    sessions_overview = []
    for sid in wm.list_sessions():
        turns = wm.get_turns(sid)
        preview = "New Thread"
        for t in turns:
            if t.role == "user" and t.content.strip():
                preview = t.content.strip()[:35]
                break
        sessions_overview.append({
            "session_id": sid,
            "turns": len(turns),
            "preview": preview,
        })
    return {"sessions": sessions_overview}
