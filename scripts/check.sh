#!/usr/bin/env bash
# The standard name for this project's verify command: scripts/check-all.sh does the work
# (mirrors CI). `scripts/check.sh --fast` = typecheck + Biome.
set -euo pipefail
"$(dirname "${BASH_SOURCE[0]}")/check-all.sh" "$@"
echo; echo "check: OK"
