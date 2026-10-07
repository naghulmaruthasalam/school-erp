#!/usr/bin/env bash
# Local MongoDB in Docker (no VPN, no Atlas needed for testing). Data lives in the school-erp-mongo-data volume.
set -euo pipefail
command -v docker >/dev/null || { echo "Docker not found. Install it, or install mongod and make sure it listens on localhost:27017."; exit 1; }
if docker ps -a --format '{{.Names}}' | grep -qx school-erp-mongo; then
  docker start school-erp-mongo >/dev/null
else
  docker run -d --name school-erp-mongo -p 27017:27017 -v school-erp-mongo-data:/data/db mongo:7 >/dev/null
fi
echo "MongoDB is up on mongodb://localhost:27017  (backend/.env should have MONGODB_URI=mongodb://localhost:27017)"
