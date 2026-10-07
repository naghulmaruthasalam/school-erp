#!/usr/bin/env bash
# Runs backend (8000) and frontend (5173). Ctrl-C stops both.
set -euo pipefail
cd "$(dirname "$0")"
( cd backend && . .venv/bin/activate && exec uvicorn app.main:app --reload --port 8000 ) &
API=$!
( cd frontend && exec npm run dev -- --host 127.0.0.1 ) &
WEB=$!
trap 'kill $API $WEB 2>/dev/null || true' INT TERM EXIT
echo "Open http://localhost:5173   (API docs: http://localhost:8000/docs)"
wait
