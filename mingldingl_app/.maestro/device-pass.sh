#!/usr/bin/env bash
# The Stage 2 device pass: every screen in English and Mongolian, each beside its Figma frame.
#   .maestro/device-pass.sh <device> [out-dir]           e.g. R58N33NA73Y   (LOCALES="mn" for one language)
# Needs scripts/dev.sh (fake WeSend), the seed album (push-seed-photos.sh) and ~/.figma-token.
# Writes <out>/<lang>-<frame>.png (device) and <lang>-<frame>-diff.png (Figma | device | diff), and
# prints each mismatch. The frames hold other names and photos, so the number is a guide and the
# three-panel image is what gets looked at.
set -euo pipefail
D=${1:?device}
APP="$(cd "$(dirname "$0")/.." && pwd)"
OUT=$(mkdir -p "${2:-$APP/.maestro/device-pass-out}" && cd "${2:-$APP/.maestro/device-pass-out}" && pwd)
ENGINE=${ENGINE_URL:-http://localhost:5150}
MAESTRO=${MAESTRO:-$HOME/.maestro/bin/maestro}
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}"
FRAMES=(23:6 23:68 23:141 23:285 23:216 23:359 23:442 23:530 23:624 23:707 23:810 23:881 23:973 26:1029 35:183
        23:1075 23:1138 23:1191)   # maintenance has no frame of its own: <lang>-maintenance.png is looked at

seed() { (cd "$APP/../mingldingl_engine" && ASPNETCORE_ENVIRONMENT=Development "$DOTNET_ROOT/dotnet" run \
  --project src/MinglDingl.Engine --no-launch-profile -- seed "$1" --phone "$2" >/dev/null); }
config() { curl -sf -X PUT "$ENGINE/dev/config/$1" -H 'Content-Type: application/json' -d "{\"value\":\"$2\"}" >/dev/null; }
# Maestro keeps takeScreenshot files in its debug folder; run each flow into one and collect them.
run() {
  local raw; raw=$(mktemp -d)
  "$MAESTRO" --device "$D" test --debug-output "$raw" "$@" >"$raw/out.log" 2>&1 \
    || { echo "flow failed: $* (log: $raw)"; return 1; }
  find "$raw" -path '*takeScreenshot*' -name '*.png' -exec cp {} "$OUT/" \;
}
shot() { run -e NAME="$1" -e EXPECT="$2" -e RELAUNCH="$3" "$APP/.maestro/_shot.yaml"; }
trap 'config app.minVersion 1.0.0; config app.maintenance false' EXIT

for LOC in ${LOCALES:-en mn}; do
  PHONE="98$(printf '%06d' $((RANDOM * 30 % 1000000)))"
  echo "== $LOC: onboarding as $PHONE"
  run -e LOCALE="$LOC" -e PHONE="$PHONE" "$APP/.maestro/device-pass.yaml"
  echo "== $LOC: closed screens"
  seed Suspended "$PHONE"; shot "$LOC-23-1075" 'Cast Out|Хөөгдсөн' yes
  seed Deleted "$PHONE"; shot "$LOC-23-1138" 'This character is gone|Энэ баатар байхгүй болжээ' yes
  seed Finished "$PHONE"; shot "$LOC-26-3-reseeded" 'The Tavern|Учралын тойрог' yes
  config app.minVersion 99.0.0; shot "$LOC-23-1191" 'The hold has changed|Цайз өөрчлөгджээ' no; config app.minVersion 1.0.0
  config app.maintenance true; shot "$LOC-maintenance" 'The gate is shut for repairs|Хаалга засварт хаалттай' no; config app.maintenance false
done

echo "== diff against Figma"
for LOC in en mn; do
  for F in "${FRAMES[@]}"; do
    png="$OUT/$LOC-${F/:/-}.png"
    [ -f "$png" ] || { echo "$LOC $F: no screenshot"; continue; }
    printf '%s %-8s ' "$LOC" "$F"
    node "$APP/scripts/visual-diff.mjs" --figma "$F" "$png" --out "${png%.png}-diff.png" --max 100 | tail -1
  done
done
