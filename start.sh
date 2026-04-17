#!/usr/bin/env bash
# RunaNet display launcher
# Usage: ./start.sh [--no-fullscreen] [--build] [--debug]
set -e
cd "$(dirname "$0")"

# Install Python display deps if not present
python3 -c "import webview" 2>/dev/null || {
    echo "Installing pywebview..."
    pip install -r display-requirements.txt
}

# Install backend deps if needed
pip install -r backend/requirements.txt -q

# Install frontend deps if needed
[ -d frontend/node_modules ] || (cd frontend && npm install --silent)

exec python3 launcher.py "$@"
