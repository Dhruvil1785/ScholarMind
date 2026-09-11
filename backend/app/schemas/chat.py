"""
backend/app/schemas/chat.py — Pydantic request/response and data models.
"""
from __future__ import annotations

import time
import uuid
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    TOOL = "tool"


class Turn(BaseModel):
    role: MessageRole
    content: str
    token_estimate: int = 0
    ts: float = Field(default_factory=time.time)


class ChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="The user prompt text")
    session_id: Optional[str] = Field(default=None, description="Optional conversation session ID")
    model: Optional[str] = Field(default=None, description="Gemini inference model identifier")
    temperature: Optional[float] = Field(default=0.7, ge=0.0, le=2.0)


class SessionCreateResponse(BaseModel):
    session_id: str
    message: str = "Session created."


class SessionDeleteResponse(BaseModel):
    session_id: str
    message: str = "Session cleared."


class IngestResponse(BaseModel):
    chunks_ingested: int
    message: str
    chunks: Optional[int] = None
    chunk_count: Optional[int] = None
    total_chunks: Optional[int] = None
    chunks_indexed: Optional[int] = None
