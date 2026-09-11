#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==> Building NextGen AI Chatbot..."

# 1. Install frontend dependencies and build React SPA
echo "==> 1/3 Installing frontend dependencies..."
cd frontend
npm ci || npm install

echo "==> 2/3 Building React production assets..."
npm run build
cd ..

# 2. Install backend Python dependencies
echo "==> 3/3 Installing backend Python packages..."
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "==> Build complete! Ready to start Uvicorn server."
