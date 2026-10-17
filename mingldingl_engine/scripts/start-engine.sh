#!/usr/bin/env bash
# Runs the engine with hot reload on 0.0.0.0:5150 (a phone on the LAN reaches it), freeing a stale port first.
set -euo pipefail
cd "$(dirname "$0")/.."
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}" PATH="$HOME/.dotnet:$PATH" DOTNET_NOLOGO=1
export ASPNETCORE_ENVIRONMENT="${ASPNETCORE_ENVIRONMENT:-Development}"
if pid=$(lsof -ti tcp:5150 2>/dev/null); then kill $pid 2>/dev/null || true; sleep 1; fi
exec dotnet watch --project src/MinglDingl.Engine run --urls http://0.0.0.0:5150 "$@"
