#!/usr/bin/env bash
# Puts the seed portraits in their own album on a device, where _pick-portraits.yaml picks them.
#   .maestro/push-seed-photos.sh <device>      e.g. R58N33NA73Y or emulator-5554
set -euo pipefail
D=${1:?device}
# One crowd traveller's six photos: the engine refuses a portrait with no face, so the ink figures
# in Seed/photos (the seed CLI's stand-ins) cannot be picked in onboarding.
SRC="$(cd "$(dirname "$0")/../../mingldingl_engine/src/MinglDingl.Engine/Seed/crowd" && pwd)"
DIR=/sdcard/Pictures/MingldinglSeed
adb -s "$D" shell "rm -rf $DIR; mkdir -p $DIR"
for f in "$SRC"/p23_*.jpg; do
  adb -s "$D" push "$f" "$DIR/" >/dev/null 2>&1
  adb -s "$D" shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d "file://$DIR/$(basename "$f")" >/dev/null
done
echo "$(ls "$SRC"/p23_*.jpg | wc -l) seed portraits in $DIR on $D"
