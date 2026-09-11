"""
Main entrypoint to run the Minimalist AI Chatbot application.
Usage:
    python run.py
"""

import os
import sys
import subprocess
import webbrowser
from pathlib import Path
import uvicorn
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"

def ensure_frontend_built():
    """Ensure frontend/dist is built so FastAPI can serve the compiled React SPA."""
    if not DIST_DIR.exists() or not (DIST_DIR / "index.html").exists():
        print("  • React bundle not found in frontend/dist. Building frontend...")
        try:
            subprocess.run(
                ["npm", "run", "build"],
                cwd=str(FRONTEND_DIR),
                shell=True,
                check=True
            )
            print("  • Frontend built successfully.")
        except Exception as e:
            print(f"  [!] Failed to build frontend automatically: {e}")

def print_banner(host: str, port: int):
    api_key_present = bool(os.getenv("GOOGLE_API_KEY", "").strip())
    status_str = "Configured" if api_key_present else "Missing GOOGLE_API_KEY in .env"
    
    print("\n" + "=" * 62)
    print("  MINIMALIST AI CHATBOT (React 18 + FastAPI + Gemini)")
    print("=" * 62)
    print(f"  • Local Server:      http://{host}:{port}")
    print(f"  • API Key Status:    {status_str}")
    print(f"  • Active Model:      gemini-2.5-flash (Default)")
    print(f"  • Frontend Stack:    React 18 + Vite + TailwindCSS")
    print("=" * 62)
    print("  Press Ctrl+C to terminate the application.\n")

def main():
    host = "127.0.0.1"
    port = 8000
    
    ensure_frontend_built()
    print_banner(host, port)
    
    # Run uvicorn server
    uvicorn.run(
        "backend.app.main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()

