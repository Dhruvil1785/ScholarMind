"""
backend/app/routes/ingest.py — Document ingestion and semantic chunking endpoints.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile

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


def _resolve_data_dirs() -> List[Path]:
    """Find all valid data/goal_materials directories that exist."""
    here = Path(__file__).resolve()
    candidates = [
        here.parents[3] / "data" / "goal_materials",
        here.parents[2] / "data" / "goal_materials",
        Path("data/goal_materials"),
        Path("../data/goal_materials"),
    ]
    seen = set()
    valid = []
    for c in candidates:
        try:
            resolved = c.resolve()
            if resolved.exists() and resolved.is_dir() and str(resolved) not in seen:
                seen.add(str(resolved))
                valid.append(resolved)
        except Exception:
            pass
    if not valid:
        default_dir = here.parents[3] / "data" / "goal_materials"
        default_dir.mkdir(parents=True, exist_ok=True)
        valid.append(default_dir)
    return valid


@router.post("", response_model=IngestResponse)
async def ingest(
    request: Request,
    gemini: GeminiClient = Depends(dep_gemini),
    ltm: LongTermMemory = Depends(dep_long_term_memory),
) -> IngestResponse:
    """
    Chunk and embed uploaded documents or server-side directories into the shared knowledge base.
    Flexibly handles any multipart field names ('file', 'files', etc.) or directory scan.
    """
    all_chunks = []
    uploads: List[UploadFile] = []
    ingest_dir: str = ""

    # Parse form data if available
    try:
        content_type = request.headers.get("content-type", "")
        if "multipart/form-data" in content_type:
            form = await request.form()
            for key, value in form.multi_items():
                if isinstance(value, UploadFile) and value.filename:
                    uploads.append(value)
                elif key == "ingest_dir" and isinstance(value, str):
                    ingest_dir = value
    except Exception as exc:
        logger.warning("ingest.form_parse_warning: %s", exc)

    # 1. Process uploaded files
    for upload in uploads:
        content = await upload.read()
        text = content.decode("utf-8", errors="replace").strip()
        if text:
            chunks = chunk_text(text, source=upload.filename or "uploaded_doc")
            all_chunks.extend(chunks)
            logger.info("ingest.file: filename=%s, chunks=%d", upload.filename, len(chunks))

    # 2. If no files were uploaded or ingest_dir was explicitly requested, scan directories
    if not uploads or ingest_dir:
        dirs_to_scan = [Path(ingest_dir)] if ingest_dir else _resolve_data_dirs()
        scanned_sources = set()
        for sdir in dirs_to_scan:
            if sdir.exists() and sdir.is_dir():
                for fpath in sdir.iterdir():
                    if fpath.suffix.lower() in {".txt", ".md", ".rst", ".csv"} and not fpath.name.startswith("."):
                        if fpath.name in scanned_sources:
                            continue
                        scanned_sources.add(fpath.name)
                        chunks = chunk_file(fpath)
                        all_chunks.extend(chunks)
                        logger.info("ingest.dir_file: file=%s, chunks=%d", fpath.name, len(chunks))

    if not all_chunks:
        raise HTTPException(
            status_code=400,
            detail="No document content found. Please upload a .txt, .md, or .csv file, or place documents in data/goal_materials/.",
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
        chunks=count,
        chunk_count=count,
        total_chunks=count,
        chunks_indexed=count,
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
    dirs_to_scan = _resolve_data_dirs()
    all_chunks = []
    scanned_sources = set()

    for sdir in dirs_to_scan:
        if sdir.exists() and sdir.is_dir():
            for fpath in sdir.iterdir():
                if fpath.suffix.lower() in {".txt", ".md", ".rst", ".csv"} and not fpath.name.startswith("."):
                    if fpath.name in scanned_sources:
                        continue
                    scanned_sources.add(fpath.name)
                    chunks = chunk_file(fpath)
                    all_chunks.extend(chunks)
                    logger.info("ingest.goal_materials: file=%s, chunks=%d", fpath.name, len(chunks))

    if not all_chunks:
        raise HTTPException(
            status_code=400,
            detail="No document files found in data/goal_materials/. Add .md or .txt files and try again.",
        )

    texts = [c.text for c in all_chunks]
    metadatas = [c.metadata for c in all_chunks]
    embeddings = gemini.embed_batch(texts)
    count = ltm.upsert_chunks(KNOWLEDGE_COLLECTION, texts, embeddings, metadatas)

    return IngestResponse(
        chunks_ingested=count,
        chunks=count,
        chunk_count=count,
        total_chunks=count,
        chunks_indexed=count,
        message=f"Ingested {count} semantic chunks from goal materials.",
    )
