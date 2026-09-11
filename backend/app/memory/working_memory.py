"""
backend/app/memory/working_memory.py — Per-session sliding-window short-term memory.

Tier 1 Working Memory:
  - Preserves last N turns (default 12) per session_id.
  - Automatically trims oldest turns when exceeding the token budget (~3000 tokens),
    guaranteeing that the last 2 turns are always preserved.
"""
from __future__ import annotations

import logging
from collections import defaultdict
from threading import Lock
from typing import Dict, List

from backend.app.config import get_settings
from backend.app.schemas.chat import MessageRole, Turn

logger = logging.getLogger(__name__)


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token."""
    return max(1, len(text) // 4)


class WorkingMemory:
    """Thread-safe, in-process working memory for all active conversational sessions."""

    def __init__(self) -> None:
        self._sessions: Dict[str, List[Turn]] = defaultdict(list)
        self._lock = Lock()
        cfg = get_settings()
        self.max_turns: int = cfg.working_memory_turns
        self.token_budget: int = cfg.working_memory_token_budget

    def add_turn(self, session_id: str, role: MessageRole, content: str) -> None:
        """Append a turn and auto-trim if exceeding turn or token limits."""
        turn = Turn(
            role=role,
            content=content,
            token_estimate=_estimate_tokens(content),
        )
        with self._lock:
            turns = self._sessions[session_id]
            turns.append(turn)
            self._trim(session_id)
        logger.debug(
            "working_memory.add_turn: session_id=%s, role=%s, tokens=%d",
            session_id, role, turn.token_estimate
        )

    def get_turns(self, session_id: str) -> List[Turn]:
        """Return a copy of the current sliding window turns for a session."""
        with self._lock:
            return list(self._sessions[session_id])

    def clear(self, session_id: str) -> None:
        """Wipe all turns for a session."""
        with self._lock:
            self._sessions.pop(session_id, None)
        logger.info("working_memory.cleared: session_id=%s", session_id)

    def session_exists(self, session_id: str) -> bool:
        with self._lock:
            return session_id in self._sessions

    def ensure_session(self, session_id: str) -> None:
        """Initialize session slot if absent."""
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = []

    def list_sessions(self) -> List[str]:
        with self._lock:
            return list(self._sessions.keys())

    def _trim(self, session_id: str) -> None:
        """
        Drop oldest turns when over the turn limit or token budget.
        Always preserves the last 2 turns.
        """
        turns = self._sessions[session_id]

        # 1. Hard cap on number of turns
        while len(turns) > self.max_turns and len(turns) > 2:
            turns.pop(0)

        # 2. Token budget trim
        total = sum(t.token_estimate for t in turns)
        while total > self.token_budget and len(turns) > 2:
            dropped = turns.pop(0)
            total -= dropped.token_estimate
            logger.debug(
                "working_memory.trimmed_turn: session_id=%s, remaining_turns=%d",
                session_id, len(turns)
            )


_working_memory = WorkingMemory()


def get_working_memory() -> WorkingMemory:
    return _working_memory
