#!/bin/bash
# ==============================================================================
# NutriTrack AI - Unified Startup Script
# Starts FastAPI Backend Server, Cloudflare Tunnel (for Expo on phone), & Mobile App
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
MOBILE_DIR="$PROJECT_ROOT/mobile"
VENV_PYTHON="$BACKEND_DIR/venv/bin/python"
VENV_UVICORN="$BACKEND_DIR/venv/bin/uvicorn"

echo "=========================================================="
echo "🌱 Starting NutriTrack AI Backend & Mobile Environment..."
echo "=========================================================="

# 1. Kill any stale backend on port 8000
STALE_PID=$(lsof -ti :8000 2>/dev/null)
if [ -n "$STALE_PID" ]; then
  echo "Stopping stale process on port 8000 (PID: $STALE_PID)..."
  kill -9 $STALE_PID 2>/dev/null || true
fi

# 2. Start FastAPI Server
echo "🚀 Launching FastAPI Backend on http://0.0.0.0:8000..."
cd "$BACKEND_DIR"
"$VENV_UVICORN" app.main:app --host 0.0.0.0 --port 8000 --reload > "$PROJECT_ROOT/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend running with PID $BACKEND_PID. (Logs: backend.log)"

sleep 2

# Verify health
if curl -s http://127.0.0.1:8000/ > /dev/null; then
  echo "✅ FastAPI Backend is healthy and connected to database!"
else
  echo "⚠️ FastAPI startup check pending. Check backend.log if issues occur."
fi

# 3. Check / Start Cloudflare Tunnel if tunnel mode requested
if command -v cloudflared &> /dev/null; then
  echo "🌐 Starting Cloudflare public tunnel for mobile device access..."
  cloudflared tunnel --url http://127.0.0.1:8000 > "$PROJECT_ROOT/tunnel.log" 2>&1 &
  TUNNEL_PID=$!
  sleep 4
  TUNNEL_URL=$(grep -o 'https://[-a-z0-9.]*\.trycloudflare\.com' "$PROJECT_ROOT/tunnel.log" | head -n 1)
  if [ -n "$TUNNEL_URL" ]; then
    echo "🔗 Cloudflare Tunnel active at: $TUNNEL_URL"
    echo "Updating mobile/src/api/client.js with active tunnel..."
    sed -i '' "s|const TUNNEL_URL = '.*';|const TUNNEL_URL = '$TUNNEL_URL';|g" "$MOBILE_DIR/src/api/client.js"
  fi
fi

# Cleanup on exit
trap 'kill $BACKEND_PID $TUNNEL_PID 2>/dev/null || true' EXIT INT TERM

# 4. Start Expo Mobile App
echo "📱 Starting Expo Mobile App..."
cd "$MOBILE_DIR"
npx expo start --port 8085 --tunnel -c
