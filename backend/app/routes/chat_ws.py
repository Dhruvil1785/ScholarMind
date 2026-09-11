"""
app/routes/chat_ws.py — /ws/chat WebSocket streaming endpoint.

Spec §5:
  Client sends: {type:"text", session_id, text}
               or {type:"init", session_id}
  Server streams: text_delta | tool_call | ui_card | done | error
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends

from backend.app.deps import dep_gemini, dep_working_memory, dep_long_term_memory
from backend.app.llm.gemini_client import GeminiClient
from backend.app.llm.prompt_builder import build_system_instruction, build_history, estimate_prompt_tokens
from backend.app.memory.working_memory import WorkingMemory
from backend.app.memory.long_term import LongTermMemory
from backend.app.schemas.chat import MessageRole
from backend.app.tools.registry import execute_tool, get_gemini_tool_declarations

logger = logging.getLogger(__name__)
router = APIRouter()

# Shared knowledge collection name for ingested goal materials
KNOWLEDGE_COLLECTION = "goal_knowledge"


async def _send(ws: WebSocket, payload: dict[str, Any]) -> None:
    await ws.send_text(json.dumps(payload))


@router.websocket("/ws/chat")
async def chat_ws(
    websocket: WebSocket,
    gemini: GeminiClient = Depends(dep_gemini),
    wm: WorkingMemory = Depends(dep_working_memory),
    ltm: LongTermMemory = Depends(dep_long_term_memory),
) -> None:
    await websocket.accept()
    logger.info("ws.connected")
    session_id: str | None = None

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send(websocket, {"type": "error", "message": "Invalid JSON", "session_id": session_id})
                continue

            msg_type = msg.get("type")
            session_id = msg.get("session_id", session_id)

            # ── init ──────────────────────────────────────────────────────
            if msg_type == "init":
                wm.ensure_session(session_id)
                await _send(websocket, {
                    "type": "init_ack",
                    "session_id": session_id,
                    "message": "Session ready.",
                })
                continue

            # ── text ──────────────────────────────────────────────────────
            if msg_type == "text":
                user_text = msg.get("text", "").strip()
                if not user_text:
                    continue

                if not session_id:
                    await _send(websocket, {
                        "type": "error",
                        "message": "No session_id. Send {type:'init', session_id} first.",
                        "session_id": None,
                    })
                    continue

                wm.ensure_session(session_id)

                # 1. Retrieve relevant chunks from long-term memory
                retrieved_chunks: list[dict] = []
                try:
                    query_embedding = gemini.embed(user_text)
                    # Retrieve from shared knowledge base
                    retrieved_chunks = ltm.retrieve(
                        KNOWLEDGE_COLLECTION, query_embedding, k=5
                    )
                    # Also retrieve session-specific learned facts
                    facts = ltm.retrieve_session_facts(session_id, query_embedding, k=3)
                    retrieved_chunks = retrieved_chunks + facts
                except Exception as emb_err:
                    logger.warning("ws.embedding_failed: %s", emb_err)

                # 2. Build prompt
                system_instruction = build_system_instruction(retrieved_chunks or None)
                turns = wm.get_turns(session_id)
                history = build_history(turns)

                token_est = estimate_prompt_tokens(system_instruction, history, user_text)
                logger.info(
                    "ws.chat_turn",
                    extra={
                        "session_id": session_id,
                        "token_estimate": token_est,
                        "retrieved_chunks": len(retrieved_chunks),
                    },
                )

                # 3. Store user turn in working memory
                wm.add_turn(session_id, MessageRole.USER, user_text)

                # 4. Stream from Gemini
                assistant_content = ""
                tool_declarations = get_gemini_tool_declarations()
                client_model = msg.get("model") or cfg.gemini_model
                client_temp = float(msg.get("temperature", 0.7))

                try:
                    async for chunk in gemini.stream_chat(
                        system_instruction=system_instruction,
                        history=history,
                        user_message=user_text,
                        tools=tool_declarations or None,
                        model=client_model,
                        temperature=client_temp,
                    ):
                        # ── Text delta ──────────────────────────────────
                        if chunk.text:
                            assistant_content += chunk.text
                            await _send(websocket, {
                                "type": "text_delta",
                                "delta": chunk.text,
                                "session_id": session_id,
                            })

                        # ── Tool calls ──────────────────────────────────
                        if hasattr(chunk, "candidates") and chunk.candidates:
                            for candidate in chunk.candidates:
                                if not candidate.content or not candidate.content.parts:
                                    continue
                                for part in candidate.content.parts:
                                    if hasattr(part, "function_call") and part.function_call:
                                        fc = part.function_call
                                        tool_id = f"{fc.name}_{int(time.time()*1000)}"

                                        await _send(websocket, {
                                            "type": "tool_call",
                                            "tool_name": fc.name,
                                            "tool_id": tool_id,
                                            "status": "running",
                                            "session_id": session_id,
                                        })

                                        result = await execute_tool(
                                            fc.name,
                                            dict(fc.args) if fc.args else {},
                                        )

                                        await _send(websocket, {
                                            "type": "tool_call",
                                            "tool_name": fc.name,
                                            "tool_id": tool_id,
                                            "status": "done",
                                            "result": result,
                                            "session_id": session_id,
                                        })

                                        # Emit UI card if tool returns a structured card
                                        if isinstance(result, dict) and result.get("type") in ["stat", "table", "badge"]:
                                            await _send(websocket, {
                                                "type": "ui_card",
                                                "card_type": result.get("type"),
                                                "data": result.get("data", {}),
                                                "session_id": session_id,
                                            })

                except Exception as gen_err:
                    err_str = str(gen_err)
                    if "503" in err_str or "unavailable" in err_str.lower() or "high demand" in err_str.lower():
                        logger.warning("ws.gemini_overloaded: %s", gen_err)
                        user_msg = "The model is currently experiencing high demand. Please try again in a moment."
                    elif "429" in err_str or "quota" in err_str.lower() or "resource_exhausted" in err_str.lower():
                        logger.warning("ws.gemini_rate_limited: %s", gen_err)
                        user_msg = "Rate limit reached. Please wait a few seconds before trying again."
                    else:
                        logger.exception("ws.gemini_error: %s", gen_err)
                        user_msg = "Having trouble reaching the model. Please try again."

                    await _send(websocket, {
                        "type": "error",
                        "message": user_msg,
                        "session_id": session_id,
                    })
                    continue

                # 5. Store assistant turn in working memory
                if assistant_content:
                    wm.add_turn(session_id, MessageRole.ASSISTANT, assistant_content)

                    # Opportunistic: store memorable facts
                    # Heuristic: if the user mentioned personal/team info, store it
                    _maybe_store_fact(user_text, session_id, gemini, ltm)

                # 6. Done signal
                await _send(websocket, {
                    "type": "done",
                    "session_id": session_id,
                    "total_tokens": token_est,
                })
                continue

            # ── Unknown type ──────────────────────────────────────────────
            await _send(websocket, {
                "type": "error",
                "message": f"Unknown message type: {msg_type}",
                "session_id": session_id,
            })

    except WebSocketDisconnect:
        logger.info("ws.disconnected", extra={"session_id": session_id})
    except Exception as exc:
        logger.exception("ws.fatal_error: %s", exc)


def _maybe_store_fact(
    user_text: str,
    session_id: str,
    gemini: GeminiClient,
    ltm: LongTermMemory,
) -> None:
    """
    Lightweight heuristic: store the user turn if it looks like personal/team info.
    Upgrade to an LLM classifier when time allows.
    """
    KEYWORDS = [
        "my team", "we are", "our project", "i am", "i'm",
        "my name", "myname", "name is", "call me", "we're building",
        "our team", "project is"
    ]
    lower = user_text.lower()
    if any(kw in lower for kw in KEYWORDS):
        try:
            emb = gemini.embed(user_text)
            ltm.store_learned_fact(session_id, user_text, emb)
            logger.debug("ws.stored_fact", extra={"session_id": session_id})
        except Exception:
            pass  # Non-critical
