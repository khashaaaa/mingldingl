#!/usr/bin/env bash
# One command for everything that would otherwise be four separately
# remembered ones (dotnet test, tsc, jest, oxlint+vite build) run by hand
# after every change. Exits non-zero on first failure so it's usable as a
# CI gate, not just a manual habit.
#
# --fast runs only the sub-minute checks (app typecheck, control lint +
# typecheck). The pre-commit hook uses it; CI runs the full set.
#
# Requires: the engine's local Postgres running (integration tests hit it
# directly — see mingldingl_engine/scripts/start-engine.sh) and node_modules
# already installed in both frontend projects.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}"
export PATH="$DOTNET_ROOT:$DOTNET_ROOT/tools:$PATH"

if [[ "${1:-}" == "--fast" ]]; then
  echo "== app: typecheck =="
  (cd "$ROOT/mingldingl_app" && npm run typecheck)
  echo "== control: lint =="
  (cd "$ROOT/mingldingl_control" && npm run lint)
  echo "== control: typecheck =="
  (cd "$ROOT/mingldingl_control" && npx tsc -b)
  echo "== fast checks passed (tests + builds run in CI) =="
  exit 0
fi

PG_HOST="${PGHOST:-127.0.0.1}"; PG_PORT="${PGPORT:-5432}"
if [[ "${CHECK_SKIP_ENGINE:-}" == "1" ]]; then
  echo "== engine: skipped (CHECK_SKIP_ENGINE=1) =="
elif ! (exec 3<>"/dev/tcp/$PG_HOST/$PG_PORT") 2>/dev/null; then
  echo "== engine: Postgres not reachable at $PG_HOST:$PG_PORT =="
  echo "   Integration tests need it. Start it, or re-run with CHECK_SKIP_ENGINE=1 to skip the engine suite."
  exit 1
else
  echo "== engine: dotnet test =="
  (cd "$ROOT/mingldingl_engine" && dotnet test)
fi

echo "== app: typecheck =="
(cd "$ROOT/mingldingl_app" && npm run typecheck)

echo "== app: jest =="
(cd "$ROOT/mingldingl_app" && npm test)

echo "== control: lint =="
(cd "$ROOT/mingldingl_control" && npm run lint)

echo "== control: build (tsc -b && vite build) =="
(cd "$ROOT/mingldingl_control" && npm run build)

echo "== all checks passed =="
