#!/usr/bin/env bash
# Attaches the chapter video lessons in ./media to Class 6 Social Studies, chapter 1 (English + Arabic).
# Usage: ./linux-load-videos.sh [school_id]     (default: the DEMO school)
set -euo pipefail
cd "$(dirname "$0")/backend"
. .venv/bin/activate
SID=${1:-$(python - <<'PY'
import asyncio
from app.core.database import init_db, close_db
from app.models.tenant import Tenant
async def main():
    await init_db(); t = await Tenant.find_one(Tenant.code == "DEMO"); print(t.id if t else ""); await close_db()
asyncio.run(main())
PY
)}
[ -n "$SID" ] || { echo "school not found"; exit 1; }
python -m scripts.attach_chapter_videos "$SID" --grade 6 --subject "Social Studies" --unit 1 \
  --en ../media/social6_ch1_en.mp4 --ar ../media/social6_ch1_ar.mp4
