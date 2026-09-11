"""
backend/app/llm/prompt_builder.py — Multi-tier prompt assembly.

Assembles prompt layers:
  1. System instruction (persona & behavioral guidelines)
  2. Retrieved reference material (Tier 3 ChromaDB chunks)
  3. Working memory (Tier 1 recent sliding window turns)
  4. Current user turn
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from backend.app.config import get_settings
from backend.app.schemas.chat import MessageRole, Turn

logger = logging.getLogger(__name__)
cfg = get_settings()


def build_system_instruction(
    retrieved_chunks: Optional[List[Dict[str, Any]]] = None,
    custom_system_prompt: Optional[str] = None,
) -> str:
    """
    Construct system instruction containing persona and retrieved reference knowledge.
    """
    base_prompt = (custom_system_prompt or cfg.goal_system_prompt).strip()
    parts: List[str] = [base_prompt]

    if retrieved_chunks:
        ref_blocks: List[str] = []
        for i, chunk in enumerate(retrieved_chunks, start=1):
            source = chunk.get("metadata", {}).get("source", "knowledge_doc")
            heading = chunk.get("metadata", {}).get("heading", "")
            text = chunk.get("text", "")
            label = f"[{i}] {source}" + (f" — {heading}" if heading else "")
            ref_blocks.append(f"{label}\n{text}")

        ref_section = "\n\n---\n".join(ref_blocks)
        parts.append(
            f"\n\n## Reference Material (Retrieved from Knowledge Base)\n"
            f"Ground your answer in the following excerpts where applicable, and cite them appropriately:\n\n"
            f"{ref_section}"
        )

    return "\n".join(parts)


def build_history(turns: List[Turn]) -> List[Dict[str, str]]:
    """
    Format turns for the Gemini contents history list.
    Maps MessageRole.USER -> 'user', MessageRole.ASSISTANT -> 'model'.
    """
    history: List[Dict[str, str]] = []
    for turn in turns:
        role = "model" if turn.role == MessageRole.ASSISTANT else "user"
        history.append({"role": role, "content": turn.content})
    return history


def estimate_prompt_tokens(
    system_instruction: str,
    history: List[Dict[str, str]],
    user_message: str,
) -> int:
    """Approximate token count for telemetry."""
    total_chars = len(system_instruction) + len(user_message)
    total_chars += sum(len(t.get("content", "")) for t in history)
    return max(1, total_chars // 4)
