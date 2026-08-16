#!/usr/bin/env bash
# One command for everything that would otherwise be four separately
# remembered ones (dotnet test, tsc, jest, oxlint+vite build) run by hand
# after every change. Exits non-zero on first failure so it's usable as a
# pre-commit/CI gate, not just a manual habit.
#
# Requires: the engine's local Postgres running (integration tests hit it
# directly — see mingldingl_engine/scripts/start-engine.sh) and node_modules
# already installed in both frontend projects.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}"
export PATH="$DOTNET_ROOT:$DOTNET_ROOT/tools:$PATH"

echo "== engine: dotnet test =="
(cd "$ROOT/mingldingl_engine" && dotnet test)

echo "== app: tsc --noEmit =="
(cd "$ROOT/mingldingl_app" && npx tsc --noEmit)

echo "== app: jest =="
(cd "$ROOT/mingldingl_app" && npm test)

echo "== control: lint =="
(cd "$ROOT/mingldingl_control" && npm run lint)

echo "== control: build (tsc -b && vite build) =="
(cd "$ROOT/mingldingl_control" && npm run build)

echo "== all checks passed =="
