# ==========================================
# Stage 1: Build Frontend (Vite + React SPA)
# ==========================================
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

# Copy frontend dependencies and install
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source code and compile production assets
COPY frontend/ ./
RUN npm run build

# ==========================================
# Stage 2: Python FastAPI + Uvicorn Runtime
# ==========================================
FROM python:3.11-slim AS runner
WORKDIR /app

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    CHROMA_PERSIST_DIR=/app/chroma_store

# Install build dependencies for C++ extensions (ChromaDB / hnswlib)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code and application data
COPY backend/ ./backend/
COPY data/ ./data/

# Copy compiled React SPA from Stage 1 into /app/frontend/dist
# (backend/app/main.py automatically mounts this directory at root /)
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create directory for ChromaDB vector embeddings
RUN mkdir -p /app/chroma_store

EXPOSE 8000

# Run Uvicorn using shell to resolve $PORT assigned by host (Render, Hugging Face, Koyeb)
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
