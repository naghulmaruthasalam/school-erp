#!/usr/bin/env bash
# Read-only report: what textbooks, subjects, notes and videos each school has, and what the sync would do. Send the output if content is missing.
set -euo pipefail
cd "$(dirname "$0")/backend"
. .venv/bin/activate
python -m scripts.diagnose_content
