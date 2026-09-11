"""
backend/app/routes/ingest.py — Document ingestion and semantic chunking endpoints.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from backend.app.config import get_settings
from backend.app.chunking.chunker import chunk_file, chunk_text
from backend.app.deps import dep_gemini, dep_long_term_memory
from backend.app.llm.gemini_client import GeminiClient
from backend.app.memory.long_term import LongTermMemory
from backend.app.schemas.chat import IngestResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ingest", tags=["ingest"])

KNOWLEDGE_COLLECTION = "goal_knowledge"
cfg = get_settings()


def _resolve_data_dir() -> Path:
    # Check data/goal_materials relative to root or backend
    candidates = [
        Path("data/goal_materials"),
        Path("backend/data/goal_materials"),
        Path(__file__).resolve().parent.parent.parent / "data" / "goal_materials",
    ]
    for c in candidates:
        if c.exists() and c.is_dir():
            return c
    # Default
    target = Path("data/goal_materials")
    target.mkdir(parents=True, exist_ok=True)
    return target


@router.post("", response_model=IngestResponse)
async def ingest(
    files: List[UploadFile] = File(default=[]),
    ingest_dir: str = Form(default=""),
    gemini: GeminiClient = Depends(dep_gemini),
    ltm: LongTermMemory = Depends(dep_long_term_memory),
) -> IngestResponse:
    """
    Chunk and embed uploaded documents or server-side directories into the shared knowledge base.
    """
    all_chunks = []

    # 1. Uploaded files
    for upload in files:
        content = await upload.read()
        text = content.decode("utf-8", errors="replace")
        chunks = chunk_text(text, source=upload.filename or "uploaded_doc")
        all_chunks.extend(chunks)
        logger.info("ingest.file: filename=%s, chunks=%d", upload.filename, len(chunks))

    # 2. Server-side directory
    scan_dir = Path(ingest_dir) if ingest_dir else _resolve_data_dir()
    if scan_dir.exists() and scan_dir.is_dir():
        for fpath in scan_dir.iterdir():
            if fpath.suffix.lower() in {".txt", ".md", ".rst", ".csv"} and not fpath.name.startswith("."):
                chunks = chunk_file(fpath)
                all_chunks.extend(chunks)
                logger.info("ingest.dir_file: file=%s, chunks=%d", fpath.name, len(chunks))

    if not all_chunks:
        raise HTTPException(
            status_code=400,
            detail="No documents found. Upload files or place .txt/.md files in data/goal_materials/.",
        )

    texts = [c.text for c in all_chunks]
    metadatas = [c.metadata for c in all_chunks]

    try:
        embeddings = gemini.embed_batch(texts)
    except Exception as exc:
        logger.error("ingest.embed_failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Embedding calculation failed: {exc}")

    count = ltm.upsert_chunks(
        collection_name=KNOWLEDGE_COLLECTION,
        texts=texts,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    return IngestResponse(
        chunks_ingested=count,
        message=f"Successfully ingested and indexed {count} chunks into '{KNOWLEDGE_COLLECTION}'.",
    )


@router.post("/dir", response_model=IngestResponse)
async def ingest_goal_materials(
    gemini: GeminiClient = Depends(dep_gemini),
    ltm: LongTermMemory = Depends(dep_long_term_memory),
) -> IngestResponse:
    """
    Convenience endpoint: scans data/goal_materials/ and ingests all documents.
    """
    scan_dir = _resolve_data_dir()
    all_chunks = []

    for fpath in scan_dir.iterdir():
        if fpath.suffix.lower() in {".txt", ".md", ".rst", ".csv"} and not fpath.name.startswith("."):
            chunks = chunk_file(fpath)
            all_chunks.extend(chunks)
            logger.info("ingest.goal_materials: file=%s, chunks=%d", fpath.name, len(chunks))

    if not all_chunks:
        raise HTTPException(
            status_code=400,
            detail=f"No document files found in '{scan_dir}'. Add .md or .txt files and try again.",
        )

    texts = [c.text for c in all_chunks]
    metadatas = [c.metadata for c in all_chunks]
    embeddings = gemini.embed_batch(texts)
    count = ltm.upsert_chunks(KNOWLEDGE_COLLECTION, texts, embeddings, metadatas)

    return IngestResponse(
        chunks_ingested=count,
        message=f"Ingested {count} semantic chunks from '{scan_dir}'.",
    )
