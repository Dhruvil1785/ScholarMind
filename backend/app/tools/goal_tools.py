"""
backend/app/tools/goal_tools.py — Domain and Generative UI tool implementations.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List
from backend.app.tools.registry import register

logger = logging.getLogger(__name__)


@register
def get_general_info(query: str) -> Dict[str, Any]:
    """
    Look up general system information, documentation, or domain guidelines.

    Args:
        query: The domain query or keyword to look up.

    Returns:
        A dict with retrieved information and reference sources.
    """
    logger.info("goal_tools.get_general_info called: query=%s", query)
    return {
        "status": "success",
        "query": query,
        "summary": f"Information retrieved for: '{query}'. NextGen AI platform provides 3-tier memory, real-time streaming, and semantic document ingestion.",
        "source": "NextGen Domain Knowledge Base"
    }


@register
def generate_data_metric(label: str, value: str, delta: str = "", unit: str = "") -> Dict[str, Any]:
    """
    Generate a formatted Generative UI Stat Card widget for the interface.

    Args:
        label: Metric title (e.g. 'Latency', 'Accuracy', 'Throughput')
        value: Primary metric number or text (e.g. '99.4', '1.2M', '14ms')
        delta: Optional percentage or delta string (e.g. '+12.5', '-4.2')
        unit: Optional unit string (e.g. '%', 'ms', 'req/s')

    Returns:
        Structured card payload for rendering on the frontend.
    """
    return {
        "_ui_card": {
            "type": "stat",
            "data": {
                "label": label,
                "value": value,
                "delta": delta,
                "unit": unit
            }
        },
        "display_status": f"Rendered metric card for {label}: {value}{unit}"
    }


@register
def generate_comparison_table(title: str, headers: List[str], rows: List[List[str]]) -> Dict[str, Any]:
    """
    Generate a formatted Generative UI Table Card widget displaying tabular comparisons.

    Args:
        title: Table description or title
        headers: List of column header names
        rows: List of row arrays matching column headers

    Returns:
        Structured table payload for rendering on the frontend.
    """
    return {
        "_ui_card": {
            "type": "table",
            "data": {
                "title": title,
                "headers": headers,
                "rows": rows
            }
        },
        "display_status": f"Rendered tabular comparison: '{title}' ({len(rows)} rows)"
    }


@register
def generate_badge_list(title: str, tags: List[str]) -> Dict[str, Any]:
    """
    Generate a formatted Generative UI Badge List widget displaying tags or categories.

    Args:
        title: Section title for badges
        tags: List of tag or skill strings

    Returns:
        Structured badge list payload.
    """
    items = [{"label": t, "variant": "default"} for t in tags]
    return {
        "_ui_card": {
            "type": "badge",
            "data": {
                "title": title,
                "items": items
            }
        },
        "display_status": f"Rendered badge list: '{title}'"
    }
