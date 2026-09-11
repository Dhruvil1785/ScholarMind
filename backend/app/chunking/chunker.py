"""
backend/app/chunking/chunker.py — Semantic document chunker with overlap and token estimation.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Tuple

logger = logging.getLogger(__name__)


@dataclass
class Chunk:
    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def token_estimate(self) -> int:
        return max(1, len(self.text) // 4)


def _count_tokens_approx(text: str) -> int:
    """Approximate token count (4 characters ~ 1 token)."""
    return max(1, len(text) // 4)


_HEADING_RE = re.compile(r"^#{1,6}\s+.+", re.MULTILINE)
_PARAGRAPH_SEP = re.compile(r"\n{2,}")


def _split_semantic(text: str) -> List[Tuple[str, str]]:
    """Split on Markdown headings first, then paragraphs."""
    segments: List[Tuple[str, str]] = []
    current_heading = ""
    current_parts: List[str] = []

    for line in text.splitlines(keepends=True):
        if _HEADING_RE.match(line.strip()):
            if current_parts:
                segments.append((current_heading, "".join(current_parts).strip()))
                current_parts = []
            current_heading = line.strip()
        else:
            current_parts.append(line)

    if current_parts:
        segments.append((current_heading, "".join(current_parts).strip()))

    if len(segments) == 1 and not segments[0][0]:
        paras = [p.strip() for p in _PARAGRAPH_SEP.split(text) if p.strip()]
        segments = [("", p) for p in paras]

    return [(h, p) for h, p in segments if p]


def _sliding_window(
    text: str,
    target_tokens: int = 650,
    overlap_pct: float = 0.15,
) -> List[str]:
    """Sliding window fallback across word sequences."""
    words = text.split()
    step = max(1, int(target_tokens * 4 * (1 - overlap_pct)) // 5)
    size = max(step, int(target_tokens * 4) // 5)

    chunks = []
    i = 0
    while i < len(words):
        chunk_words = words[i : i + size]
        chunks.append(" ".join(chunk_words))
        i += step

    return chunks


def chunk_text(
    text: str,
    source: str = "unknown",
    target_tokens: int = 650,
    overlap_pct: float = 0.15,
) -> List[Chunk]:
    """
    Split text into overlapping chunks preserving headings and metadata.
    """
    segments = _split_semantic(text)
    raw_chunks: List[Tuple[str, str]] = []

    for heading, seg_text in segments:
        if _count_tokens_approx(seg_text) <= target_tokens:
            raw_chunks.append((heading, seg_text))
        else:
            for sub in _sliding_window(seg_text, target_tokens, overlap_pct):
                raw_chunks.append((heading, sub))

    # Merge very small adjacent fragments (< 30% target)
    merged: List[Tuple[str, str]] = []
    buf_heading = ""
    buf_text = ""

    for heading, chunk_piece in raw_chunks:
        combined = (buf_text + " " + chunk_piece).strip()
        if buf_text and _count_tokens_approx(combined) <= target_tokens:
            buf_text = combined
            buf_heading = buf_heading or heading
        else:
            if buf_text:
                merged.append((buf_heading, buf_text))
            buf_heading = heading
            buf_text = chunk_piece

    if buf_text:
        merged.append((buf_heading, buf_text))

    result: List[Chunk] = []
    for idx, (heading, chunk_piece) in enumerate(merged):
        result.append(
            Chunk(
                text=chunk_piece,
                metadata={
                    "source": source,
                    "chunk_index": idx,
                    "heading": heading,
                    "token_estimate": _count_tokens_approx(chunk_piece),
                },
            )
        )

    logger.info("chunker.chunk_text: source=%s, chunks=%d", source, len(result))
    return result


def chunk_file(path: str | Path, **kwargs) -> List[Chunk]:
    """Read a document file and return semantic chunks."""
    p = Path(path)
    text = p.read_text(encoding="utf-8", errors="replace")
    return chunk_text(text, source=p.name, **kwargs)
