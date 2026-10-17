#!/usr/bin/env bash
# One command for local development: engine (hot reload, :5150), Metro (:8081), admin (:5173).
# Every log line is prefixed with its name; Ctrl-C stops all three.
#
#   scripts/dev.sh              fake verify.mn — sign-in completes with no SMS
#   scripts/dev.sh --real-sms   the real provider (each text costs the user 150₮)
#
# Migrations are applied by the engine itself at boot (Program.cs), so there is no separate step.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAKE=true
for a in "$@"; do
  case "$a" in
    --real-sms) FAKE=false ;;
    -h | --help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "unknown option: $a" >&2; exit 2 ;;
  esac
done

if ! pg_isready -q -h "${PGHOST:-127.0.0.1}" -p "${PGPORT:-5432}"; then
  echo "Postgres is not accepting connections on ${PGHOST:-127.0.0.1}:${PGPORT:-5432}."
  echo "Start it with:  sudo systemctl start postgresql"
  exit 1
fi

# The engine script frees a stale :5150 itself; anything else on Metro's or the admin's port is
# someone's running server, so say whose instead of killing it.
for port in 8081 5173; do
  if pid=$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null); then
    echo "Port $port is taken by: $(ps -o pid=,args= -p "$pid" | head -1)"
    echo "Stop it first (kill $pid), then rerun."
    exit 1
  fi
done

# Each service runs as its own job (set -m: its own process group, with dotnet watch's and Metro's
# children inside it), so stopping kills exactly those groups and never the shell that called us.
set -m
run() {
  local name=$1 colour=$2 dir=$3
  shift 3
  # stdin from /dev/null: a background job that reads the terminal is stopped (SIGTTIN)
  (cd "$dir" && exec "$@" </dev/null) 2>&1 | sed -u "s/^/$(printf '\033[%sm' "$colour")[$name]$(printf '\033[0m') /" &
}

cleanup() {
  trap - INT TERM EXIT
  echo
  echo "stopping…"
  local groups g i
  groups=$(jobs -p)
  # dotnet watch shuts down on SIGINT and shrugs off SIGTERM; escalate for anything that lingers
  for g in $groups; do kill -INT -- "-$g" 2>/dev/null; kill -CONT -- "-$g" 2>/dev/null; done
  for i in {1..10}; do
    alive=0
    for g in $groups; do kill -0 -- "-$g" 2>/dev/null && alive=1; done
    [[ $alive == 0 ]] && break
    sleep 0.5
  done
  for g in $groups; do kill -TERM -- "-$g" 2>/dev/null; done
  sleep 1
  for g in $groups; do kill -KILL -- "-$g" 2>/dev/null; done
  wait 2>/dev/null
}
trap cleanup INT TERM EXIT

echo "[engine] verify.mn: $([[ $FAKE == true ]] && echo fake || echo REAL — texts cost 150₮)"
export VerifyMn__Fake=$FAKE DOTNET_WATCH_SUPPRESS_LAUNCH_BROWSER=1
run engine 36 "$ROOT/mingldingl_engine" ./scripts/start-engine.sh
run metro 35 "$ROOT/mingldingl_app" npx expo start --dev-client
run admin 33 "$ROOT/mingldingl_control" npx vite --strictPort

wait
