#!/usr/bin/env bash
# One-command dev startup for the engine. Frees port 5150 first if a
# previous instance is still bound to it (safe to re-run any time — no more
# manual pkill-then-restart), then runs the API in the foreground so Ctrl+C
# stops it, same as any other dev server. Uses the "http" launch profile,
# which binds 0.0.0.0:5150 (not just localhost) so a phone/device on the
# same LAN can reach it, not just this machine.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="$SCRIPT_DIR/../src/MinglDingl.Engine"
PORT=5150

existing_pid="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
if [ -n "$existing_pid" ]; then
  echo "Port $PORT is in use by PID $existing_pid — stopping it first."
  kill "$existing_pid"
  sleep 1
fi

cd "$ENGINE_DIR"
exec dotnet run --launch-profile http
