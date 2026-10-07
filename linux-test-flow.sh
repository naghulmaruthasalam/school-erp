#!/usr/bin/env bash
# Prepares the data and checks the whole flow. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/backend"
. .venv/bin/activate
grep -q "^MONGODB_URI=" .env || { echo "backend/.env has no MONGODB_URI"; exit 1; }

echo "== 1/4 connection =="
python -m scripts.check_connection || { echo "Cannot reach MongoDB. Start it (./linux-mongo.sh) or fix MONGODB_URI."; exit 1; }

echo "== 2/4 demo school + users (skipped if it already exists) =="
python -m scripts.seed_sample_data

echo "== 3/4 textbook library (English + Arabic) =="
python -m scripts.ingest_curriculum cls6_all_units_mongodb.ndjson
SID=$(python - <<'PY'
import asyncio
from app.core.database import init_db, close_db
from app.models.tenant import Tenant
async def main():
    await init_db()
    t = await Tenant.find_one(Tenant.code == "DEMO")
    print(t.id if t else "")
    await close_db()
asyncio.run(main())
PY
)
[ -n "$SID" ] || { echo "DEMO school not found"; exit 1; }
echo "DEMO school id: $SID"
python -m scripts.sync_curriculum "$SID" --apply --create-missing | tail -25

echo "== 4/4 start the API for the checks =="
( uvicorn app.main:app --port 8000 >/tmp/school-erp-smoke.log 2>&1 & echo $! > /tmp/school-erp-smoke.pid )
trap 'kill "$(cat /tmp/school-erp-smoke.pid)" 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf http://localhost:8000/health >/dev/null 2>&1 && break || sleep 1; done
python -m scripts.smoke_flow --school DEMO
