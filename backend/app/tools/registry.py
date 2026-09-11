"""
backend/app/tools/registry.py — Dynamic tool registration and dispatch.
"""
from __future__ import annotations

import asyncio
import inspect
import logging
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

TOOL_REGISTRY: Dict[str, Callable] = {}


def register(fn: Callable) -> Callable:
    """Decorator: registers a Python callable into TOOL_REGISTRY by function name."""
    TOOL_REGISTRY[fn.__name__] = fn
    logger.info("tool_registry.registered: %s", fn.__name__)
    return fn


def get_tool(name: str) -> Optional[Callable]:
    return TOOL_REGISTRY.get(name)


def list_tools() -> List[str]:
    return list(TOOL_REGISTRY.keys())


async def execute_tool(name: str, args: Dict[str, Any]) -> Any:
    """
    Execute tool callable by name. Supports both synchronous and asynchronous functions.
    """
    fn = get_tool(name)
    if fn is None:
        logger.warning("tool_registry.unknown_tool: %s", name)
        return {"error": f"Unknown tool: {name}"}

    try:
        if inspect.iscoroutinefunction(fn):
            result = await fn(**args)
        else:
            result = await asyncio.to_thread(fn, **args)
        logger.info("tool_registry.executed: tool=%s, result_type=%s", name, type(result).__name__)
        return result
    except Exception as exc:
        logger.exception("tool_registry.execution_error: %s — %s", name, exc)
        return {"error": str(exc)}


def get_gemini_tool_declarations() -> List[Dict[str, Any]]:
    """
    Build Gemini FunctionDeclaration specifications from all registered functions.
    """
    declarations = []
    py_to_json = {
        str: "string",
        int: "integer",
        float: "number",
        bool: "boolean",
        list: "array",
        dict: "object",
    }

    for name, fn in TOOL_REGISTRY.items():
        sig = inspect.signature(fn)
        params: Dict[str, Any] = {}
        required: List[str] = []

        for param_name, param in sig.parameters.items():
            ann = param.annotation
            json_type = py_to_json.get(ann, "string")
            params[param_name] = {"type": json_type}
            if param.default is inspect.Parameter.empty:
                required.append(param_name)

        declarations.append({
            "name": name,
            "description": (fn.__doc__ or "").strip(),
            "parameters": {
                "type": "object",
                "properties": params,
                "required": required,
            },
        })

    return declarations


# Import goal_tools so decorators execute on module load
import backend.app.tools.goal_tools  # noqa: E402, F401
