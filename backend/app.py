"""
backend/app.py — Root re-export pointing to backend.app.main:app for backward compatibility.
"""
from backend.app.main import app

__all__ = ["app"]
