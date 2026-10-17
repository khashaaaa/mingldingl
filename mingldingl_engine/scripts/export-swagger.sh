#!/usr/bin/env bash
# Rewrites swagger.json from the code (no server, no database). --check: fail if it is stale.
set -euo pipefail
cd "$(dirname "$0")/.."
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}" PATH="$HOME/.dotnet:$PATH" DOTNET_NOLOGO=1
out=swagger.json
[[ "${1:-}" == "--check" ]] && out=$(mktemp)
# The export exits before serving anything, so it gets throwaway keys: CI has no appsettings.Development.json.
Auth__SigningKey=export-only-app-key-never-used-to-sign-0001 \
Admin__JwtSigningKey=export-only-admin-key-never-used-to-sign-02 \
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/MinglDingl.Engine -v q -- export-swagger "$(realpath -m "$out")" >/dev/null
if [[ "${1:-}" == "--check" ]]; then
  if ! diff -q swagger.json "$out" >/dev/null; then echo "swagger.json is stale — run scripts/export-swagger.sh"; diff swagger.json "$out" | head -20; exit 1; fi
  echo "swagger.json is current"
fi
