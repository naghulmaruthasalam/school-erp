#!/usr/bin/env bash
# Test everything on THIS machine with a local MongoDB: no VPN, your backend/.env (Atlas URI, keys) is not touched.
# It overrides only MONGODB_URI / MONGODB_DB_NAME for the commands it starts; GEMINI_API_KEY etc. still come from backend/.env.
#
#   ./linux-local.sh test     # start local MongoDB, seed demo school, load textbooks + videos, run the checks
#   ./linux-local.sh run      # start backend :8000 + frontend :5173 on that same local database
#   ./linux-local.sh reset    # throw the local test database away (start clean)
set -euo pipefail
cd "$(dirname "$0")"
export MONGODB_URI="${LOCAL_MONGODB_URI:-mongodb://localhost:27017}"
export MONGODB_DB_NAME="${LOCAL_MONGODB_DB:-school_erp_localtest}"

start_mongo() {
  if (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null; then echo "MongoDB already listening on 27017"; return; fi
  if command -v docker >/dev/null; then ./linux-mongo.sh
  elif command -v mongod >/dev/null; then
    mkdir -p /tmp/school-erp-mongo-data
    mongod --dbpath /tmp/school-erp-mongo-data --bind_ip 127.0.0.1 --port 27017 --fork --logpath /tmp/school-erp-mongod.log >/dev/null
    echo "mongod started (data in /tmp/school-erp-mongo-data)"
  else
    echo "No MongoDB found. Install Docker (https://docs.docker.com/engine/install/) or MongoDB Community, then re-run."; exit 1
  fi
  for i in $(seq 1 30); do (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null && return; sleep 1; done
  echo "MongoDB did not come up"; exit 1
}

case "${1:-test}" in
  test)  start_mongo; ./linux-test-flow.sh ;;
  run)   start_mongo; ./linux-run.sh ;;
  reset)
    start_mongo
    ( cd backend && . .venv/bin/activate && python - <<'PY'
import os
from pymongo import MongoClient
MongoClient(os.environ["MONGODB_URI"]).drop_database(os.environ["MONGODB_DB_NAME"]); print("dropped", os.environ["MONGODB_DB_NAME"])
PY
    ) ;;
  *) echo "usage: $0 test|run|reset"; exit 1 ;;
esac
