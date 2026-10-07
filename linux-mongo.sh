#!/usr/bin/env bash
# Local MongoDB in a container (no VPN, no Atlas needed for testing). Works with Docker or Podman (Fedora).
# Data lives in the school-erp-mongo-data volume.
set -euo pipefail
if command -v podman >/dev/null; then CT=podman; elif command -v docker >/dev/null; then CT=docker
else echo "Neither podman nor docker found. Install one (Fedora: sudo dnf install -y podman), or install mongod and make sure it listens on localhost:27017."; exit 1; fi
IMAGE="docker.io/library/mongo:7"   # fully-qualified: Fedora/Podman refuses short names like mongo:7
if $CT ps -a --format '{{.Names}}' | grep -qx school-erp-mongo; then
  $CT start school-erp-mongo >/dev/null
else
  $CT run -d --name school-erp-mongo -p 27017:27017 -v school-erp-mongo-data:/data/db "$IMAGE" >/dev/null
fi
echo "MongoDB is up on mongodb://localhost:27017 (using $CT)"
