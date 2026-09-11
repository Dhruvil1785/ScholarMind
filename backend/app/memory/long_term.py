"""
backend/app/memory/long_term.py — ChromaDB-backed episodic and knowledge retrieval memory.

Tier 3 Long-Term Memory:
  - Shared knowledge collection ("goal_knowledge") for ingested documents.
  - Per-session collection ("session_{id}") for learned user facts & preferences.
  - Top-k cosine similarity retrieval with vector embeddings.
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from backend.app.config import get_settings

logger = logging.getLogger(__name__)
cfg = get_settings()



# --- ChromaDB compatibility & telemetry fixes ---
try:
    import posthog
    posthog.capture = lambda *args, **kwargs: None
except Exception:
    pass

try:
    import chromadb.segment.impl.metadata.sqlite as _sqlite_meta
    _orig_decode = _sqlite_meta._decode_seq_id
    _sqlite_meta._decode_seq_id = lambda val: val if isinstance(val, int) else _orig_decode(val)
except Exception:
    pass

from pathlib import Path
import os

def _make_chroma_client() -> chromadb.ClientAPI:
    persist_dir = cfg.chroma_persist_dir
    if not os.path.isabs(persist_dir):
        backend_dir = Path(__file__).resolve().parents[2]
        candidate = backend_dir / "chroma_store"
        if candidate.exists():
            persist_dir = str(candidate)
        else:
            persist_dir = str(backend_dir.parent / "chroma_store")
    return chromadb.PersistentClient(
        path=persist_dir,
        settings=ChromaSettings(anonymized_telemetry=False),
    )


class LongTermMemory:
    """Manages persistent ChromaDB vector store for semantic knowledge and episodic memory."""

    def __init__(self, chroma_client: Optional[chromadb.ClientAPI] = None) -> None:
        self._client = chroma_client or _make_chroma_client()

    def _collection_name(self, session_id: str) -> str:
        clean_id = session_id.replace("-", "_")
        return f"session_{clean_id}"

    def _get_or_create(self, name: str) -> chromadb.Collection:
        return self._client.get_or_create_collection(
            name=name,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert_chunks(
        self,
        collection_name: str,
        texts: List[str],
        embeddings: List[List[float]],
        metadatas: List[Dict[str, Any]],
    ) -> int:
        """Upsert text chunks with corresponding vector embeddings."""
        if not texts:
            return 0
        col = self._get_or_create(collection_name)
        ids = [str(uuid.uuid4()) for _ in texts]
        col.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )
        logger.info(
            "long_term.upsert_chunks: collection=%s, count=%d",
            collection_name, len(texts)
        )
        return len(texts)

    def store_learned_fact(
        self,
        session_id: str,
        fact: str,
        embedding: List[float],
    ) -> None:
        """Persist a discovered user preference or factual detail."""
        ts = time.time()
        # 1. Store in session-specific collection
        col = self._get_or_create(self._collection_name(session_id))
        col.upsert(
            ids=[str(uuid.uuid4())],
            embeddings=[embedding],
            documents=[fact],
            metadatas=[{"type": "learned_fact", "ts": ts}],
        )
        # 2. Mirror into user_profile_facts so facts persist across new sessions
        try:
            profile_col = self._get_or_create("user_profile_facts")
            profile_col.upsert(
                ids=[str(uuid.uuid4())],
                embeddings=[embedding],
                documents=[fact],
                metadatas=[{"type": "learned_fact", "session_id": session_id, "ts": ts}],
            )
        except Exception as p_err:
            logger.debug("long_term.profile_col_upsert: %s", p_err)

        logger.info("long_term.stored_fact: session_id=%s, fact=%s", session_id, fact[:50])

    def retrieve(
        self,
        collection_name: str,
        query_embedding: List[float],
        k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Retrieve top-k nearest semantic neighbors."""
        try:
            col = self._get_or_create(collection_name)
            count = col.count()
            if count == 0:
                return []
            results = col.query(
                query_embeddings=[query_embedding],
                n_results=min(k, count),
                include=["documents", "metadatas", "distances"],
            )
            items = []
            if results and results.get("documents") and len(results["documents"]) > 0:
                for doc, meta, dist in zip(
                    results["documents"][0],
                    results["metadatas"][0],
                    results["distances"][0],
                ):
                    items.append({"text": doc, "metadata": meta, "distance": dist})
            return items
        except Exception as exc:
            logger.warning("long_term.retrieve_failed: collection=%s, error=%s", collection_name, exc)
            return []

    def retrieve_session_facts(
        self,
        session_id: str,
        query_embedding: List[float],
        k: int = 3,
    ) -> List[Dict[str, Any]]:
        session_items = self.retrieve(self._collection_name(session_id), query_embedding, k)
        profile_items = self.retrieve("user_profile_facts", query_embedding, k)
        # Merge and deduplicate by text
        seen = set()
        combined = []
        for item in session_items + profile_items:
            t = item.get("text")
            if t and t not in seen:
                seen.add(t)
                combined.append(item)
        return combined[:k]

    def get_session_facts(self, session_id: str) -> List[Dict[str, Any]]:
        """Return all stored learned facts for this session and user profile."""
        facts = []
        seen_texts = set()

        def _collect(col_name: str):
            try:
                col = self._get_or_create(col_name)
                data = col.get(include=["documents", "metadatas"])
                if data and data.get("documents"):
                    for doc, meta in zip(data["documents"], data["metadatas"]):
                        if doc and doc not in seen_texts:
                            seen_texts.add(doc)
                            facts.append({"fact": doc, "text": doc, "metadata": meta})
            except Exception as e:
                logger.debug("get_session_facts._collect err: %s", e)

        # 1. Session-specific facts
        _collect(self._collection_name(session_id))
        # 2. General user profile facts
        _collect("user_profile_facts")

        return facts

    def count_knowledge_chunks(self, collection_name: str = "goal_knowledge") -> int:
        try:
            col = self._get_or_create(collection_name)
            return col.count()
        except Exception:
            return 0

    def delete_session(self, session_id: str) -> None:
        name = self._collection_name(session_id)
        try:
            self._client.delete_collection(name)
            logger.info("long_term.deleted_session_collection: %s", name)
        except Exception:
            pass

    def list_sessions(self) -> List[str]:
        try:
            return [c.name for c in self._client.list_collections()]
        except Exception:
            return []


_long_term_memory: Optional[LongTermMemory] = None


def get_long_term_memory() -> LongTermMemory:
    global _long_term_memory
    if _long_term_memory is None:
        _long_term_memory = LongTermMemory()
    return _long_term_memory
