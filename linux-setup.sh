#!/usr/bin/env bash
# One-time setup on Linux (Ubuntu/Debian/Fedora...). Needs python3 (3.11-3.13), python3-venv, node 20.19+/22 and npm.
set -euo pipefail
cd "$(dirname "$0")"
command -v python3 >/dev/null || { echo "python3 not found"; exit 1; }
command -v node >/dev/null || { echo "node not found (install Node 22 LTS)"; exit 1; }
echo "Python: $(python3 --version)   Node: $(node -v)"

( cd backend
  python3 -m venv .venv
  . .venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt )
( cd frontend && npm install )

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  secret=$(python3 -c "import secrets;print(secrets.token_urlsafe(48))")
  sed -i "s|^JWT_SECRET_KEY=.*|JWT_SECRET_KEY=${secret}|" backend/.env
  echo "Created backend/.env (local MongoDB at mongodb://localhost:27017)."
fi
chrom=$(command -v chromium chromium-browser google-chrome 2>/dev/null | head -1 || true)
if [ -n "${chrom}" ] && ! grep -q "^COPILOT_CHROMIUM_PATH=" backend/.env; then
  echo "COPILOT_CHROMIUM_PATH=${chrom}" >> backend/.env
  echo "PDF export will use ${chrom}"
fi
echo
echo "Next: 1) edit backend/.env: set GEMINI_API_KEY (and MONGODB_URI if you don't use the local one below)"
echo "      2) ./linux-mongo.sh        (starts a local MongoDB in Docker; skip if you use Atlas/VPN)"
echo "      3) ./linux-test-flow.sh    (seeds the demo school, loads the textbooks, runs the checks)"
echo "      4) ./linux-run.sh          (starts backend + frontend; open http://localhost:5173)"
