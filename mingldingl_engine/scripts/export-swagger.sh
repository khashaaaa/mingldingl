#!/usr/bin/env bash
# Writes mingldingl_engine/swagger.json from the engine's controllers without starting the
# server or touching Postgres. Both frontends' `npm run generate:api` read that file, so run
# this (and commit the result) whenever a controller or DTO changes.
#
#   ./mingldingl_engine/scripts/export-swagger.sh            # write swagger.json
#   ./mingldingl_engine/scripts/export-swagger.sh --check    # exit 1 if swagger.json is stale (CI)
set -euo pipefail
ENGINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}"
export PATH="$DOTNET_ROOT:$DOTNET_ROOT/tools:$PATH"
export ASPNETCORE_ENVIRONMENT=Development

TARGET="$ENGINE/swagger.json"
if [[ "${1:-}" == "--check" ]]; then
  TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT
  dotnet run --project "$ENGINE/src/MinglDingl.Engine" -- export-swagger "$TMP" >/dev/null
  if ! diff -q "$TARGET" "$TMP" >/dev/null; then
    echo "swagger.json is stale — run ./mingldingl_engine/scripts/export-swagger.sh and commit it" >&2
    diff "$TARGET" "$TMP" | head -40 >&2 || true
    exit 1
  fi
  echo "swagger.json is up to date"
else
  dotnet run --project "$ENGINE/src/MinglDingl.Engine" -- export-swagger "$TARGET"
fi
