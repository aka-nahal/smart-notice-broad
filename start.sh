#!/usr/bin/env bash
# RunaNet display launcher — thin wrapper around start.py.
# Usage: ./start.sh [--no-fullscreen] [--build] [--debug] [--no-presence]
set -e
cd "$(dirname "$0")"
exec python3 start.py "$@"
