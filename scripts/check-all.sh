#!/usr/bin/env bash
# Every check, in one command; exits non-zero on the first failure. CI (.github/workflows/ci.yml)
# runs the same steps as three jobs.
#
#   scripts/check-all.sh          everything
#   scripts/check-all.sh --fast   app typecheck + both Biome checks (seconds; the pre-commit hook)
#
#   CHECK_SKIP_ENGINE=1   skip the engine suite (it starts its own Postgres: needs initdb/pg_ctl)
#   CHECK_SKIP_E2E=1      skip the admin Playwright test (it needs local Postgres + the engine's
#                         appsettings.Development.json; it is skipped automatically in CI)
#
# Needs node_modules installed in mingldingl_app and mingldingl_control.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}"
export PATH="$DOTNET_ROOT:$DOTNET_ROOT/tools:$PATH" DOTNET_NOLOGO=1
APP="$ROOT/mingldingl_app"
ADMIN="$ROOT/mingldingl_control"

step() { echo; echo "== $* =="; }

# Orval regenerates in place from swagger.json; any difference means the committed hooks are stale.
# The regenerated files are left in place (they are what swagger.json says), so a rerun passes.
orval_fresh() {
  local dir=$1 gen=$2 before
  before=$(mktemp -d)
  cp -r "$dir/$gen" "$before/"
  (cd "$dir" && npm run --silent generate:api >/dev/null)
  if ! diff -r -q "$before/$(basename "$gen")" "$dir/$gen" >/dev/null; then
    diff -r -q "$before/$(basename "$gen")" "$dir/$gen" | head -10
    rm -rf "$before"
    echo "$gen was stale against swagger.json — regenerated now; review and rerun."
    return 1
  fi
  rm -rf "$before"
  echo "$gen is current"
}

if [[ "${1:-}" == "--fast" ]]; then
  step "app: typecheck"; (cd "$APP" && npm run typecheck)
  step "app: biome"; (cd "$APP" && npx biome check .)
  step "admin: biome"; (cd "$ADMIN" && npx biome check .)
  step "fast checks passed"
  exit 0
fi

# ---- engine ----
if [[ "${CHECK_SKIP_ENGINE:-}" == "1" ]]; then
  step "engine: tests skipped (CHECK_SKIP_ENGINE=1)"
elif [[ -z "${PG_BIN:-}" ]] && ! compgen -G "/usr/lib/postgresql/*/bin/initdb" >/dev/null && ! command -v initdb >/dev/null; then
  echo "No Postgres server binaries — the engine tests initdb a throwaway Postgres of their own."
  echo "Install postgresql (or set PG_BIN), or rerun with CHECK_SKIP_ENGINE=1."
  exit 1
else
  step "engine: dotnet test"; (cd "$ROOT/mingldingl_engine" && dotnet test)
fi
step "engine: swagger.json current"; "$ROOT/mingldingl_engine/scripts/export-swagger.sh" --check

# ---- app ----
step "app: typecheck"; (cd "$APP" && npm run typecheck)
step "app: biome + colour literals"; (cd "$APP" && npm run lint)
step "app: jest"; (cd "$APP" && npm test)
step "app: script tests"; (cd "$APP" && npm run test:scripts)
step "app: generated API current"; orval_fresh "$APP" src/lib/api/generated

# ---- admin ----
step "admin: biome + colour literals"; (cd "$ADMIN" && npm run lint)
step "admin: build"; (cd "$ADMIN" && npm run build)
step "admin: generated API current"; orval_fresh "$ADMIN" src/lib/api/generated
if [[ "${CHECK_SKIP_E2E:-}" == "1" || -n "${CI:-}" ]]; then
  step "admin: Playwright skipped"
elif ! pg_isready -q -h 127.0.0.1 -p 5432; then
  step "admin: Playwright skipped — local Postgres is down"
else
  step "admin: Playwright"; (cd "$ADMIN" && npx playwright test --reporter=line)
fi

step "all checks passed"
