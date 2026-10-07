#!/usr/bin/env bash
# Runs backend (8000) and frontend (5173). Ctrl-C stops both.
set -euo pipefail
cd "$(dirname "$0")"
# Say which database the API will use (password hidden) so a wrong-DB login failure is obvious.
( cd backend && . .venv/bin/activate && python - <<'PY'
import re
from app.core.config import get_settings
settings = get_settings()
u = getattr(settings, "mongodb_uri", "") or ""
print("Database:", getattr(settings, "mongodb_db_name", "?"), "@", re.sub(r"//[^@/]*@", "//***@", u).split("?")[0])
PY
) || true
( cd backend && . .venv/bin/activate && exec uvicorn app.main:app --reload --port 8000 ) &
API=$!
( cd frontend && exec npm run dev -- --host 127.0.0.1 ) &
WEB=$!
trap 'kill $API $WEB 2>/dev/null || true' INT TERM EXIT
echo "Open http://localhost:5173   (API docs: http://localhost:8000/docs)"
wait
