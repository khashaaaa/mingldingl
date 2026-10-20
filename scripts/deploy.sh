#!/usr/bin/env bash
# Builds the engine and the web pages here and ships them to the home server (no containers):
#   ./scripts/deploy.sh            build, ship, restart the engine, wait for /health
#   ./scripts/deploy.sh --setup    first run scripts/server/setup.sh there (asks for the sudo password)
#   ./scripts/deploy.sh --tunnel   the same, and install + start the Cloudflare tunnel
# The server keeps its own /etc/mingldingl/engine.env (secrets never leave it). Needs `ssh server`.
set -euo pipefail
cd "$(dirname "$0")/.."
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}" PATH="$HOME/.dotnet:$PATH" DOTNET_NOLOGO=1
OUT="$(mktemp -d)"; trap 'rm -rf "$OUT"' EXIT

if [[ "${1:-}" == "--setup" || "${1:-}" == "--tunnel" ]]; then
  rsync -az --delete scripts/server/ server:mingldingl-server/
  ssh -t server "sudo bash mingldingl-server/setup.sh ${1/--setup/}"
fi

api=$(ssh server "sed -n 's/^PUBLIC_API_URL=//p' /etc/mingldingl/engine.env")
[[ -n "$api" ]] || { echo "PUBLIC_API_URL is not set in the server's /etc/mingldingl/engine.env"; exit 1; }
mail=$(ssh server "sed -n 's/^SUPPORT_EMAIL=//p' /etc/mingldingl/engine.env")
[[ -n "$mail" ]] || { echo "SUPPORT_EMAIL is not set in the server's /etc/mingldingl/engine.env (the legal pages print it)"; exit 1; }

echo "▶ engine: publish (linux-x64, self-contained, ReadyToRun)"
dotnet publish mingldingl_engine/src/MinglDingl.Engine -c Release -r linux-x64 --self-contained \
  -p:PublishReadyToRun=true -p:TieredPGO=true -o "$OUT/engine" --nologo -v quiet
rm -f "$OUT"/engine/appsettings.Development.json*

echo "▶ web: build against $api"
(cd mingldingl_control && VITE_API_URL="$api" VITE_SUPPORT_EMAIL="$mail" npx vite build --outDir "$OUT/web" --emptyOutDir --logLevel warn)

echo "▶ ship"
rsync -az --delete "$OUT/engine/" server:/opt/mingldingl/engine/
rsync -az --delete "$OUT/web/" server:/opt/mingldingl/web/
ssh server "sudo -n systemctl restart mingldingl-engine"
ssh server "for i in \$(seq 1 60); do curl -sf http://127.0.0.1:8080/health >/dev/null && echo 'engine healthy' && exit 0; sleep 1; done; echo 'engine did not come up:'; journalctl -u mingldingl-engine -n 30 --no-pager; exit 1"
