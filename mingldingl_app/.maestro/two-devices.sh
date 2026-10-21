#!/usr/bin/env bash
# live-edit and revoke, on two devices signed in to one seeded account.
#   .maestro/two-devices.sh <deviceA> <deviceB>      e.g. R58N33NA73Y emulator-5554
# Needs scripts/dev.sh running. live-edit: A renames the character in the app and B shows it;
# then live-latency.py times an edit's arrival on each device's screen (limit 2 s). revoke: another
# sign-in to the same number calls POST /auth/sign-out-all; both devices must return to the Gate.
set -euo pipefail
A=${1:?device A}; B=${2:?device B}
cd "$(dirname "$0")/.."
ENGINE=${ENGINE_URL:-http://localhost:5150}
MAESTRO=${MAESTRO:-$HOME/.maestro/bin/maestro}
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}"

PHONE="99$(printf '%06d' $((RANDOM * 30 % 1000000)))"
echo "== seed Finished account $PHONE"
(cd ../mingldingl_engine && ASPNETCORE_ENVIRONMENT=Development "$DOTNET_ROOT/dotnet" run \
  --project src/MinglDingl.Engine --no-launch-profile -- seed Finished --phone "$PHONE" | grep Finished)

for d in "$A" "$B"; do
  echo "== sign in on $d"
  "$MAESTRO" --device "$d" test -e PHONE="$PHONE" .maestro/sign-in.yaml >/dev/null
done

NEW_NAME="Renamed$((RANDOM % 900 + 100))"
echo "== live-edit: $A renames to $NEW_NAME, $B watches"
log=$(mktemp -d)
"$MAESTRO" --device "$B" test --debug-output "$log/b" --flatten-debug-output \
  -e NEW_NAME="$NEW_NAME" .maestro/live-edit-see.yaml >/dev/null 2>&1 &
watcher=$!
sleep 12   # the watcher's driver is up and polling before the edit happens
"$MAESTRO" --device "$A" test -e NEW_NAME="$NEW_NAME" .maestro/live-edit-change.yaml >/dev/null
wait $watcher || { echo "live-edit: $B never showed $NEW_NAME (log: $log/b)"; exit 1; }
echo "live-edit: $B shows the name $A saved"
# How fast is measured on the screen (Maestro's waits poll every few seconds, so it cannot).
for d in "$B" "$A"; do python3 .maestro/live-latency.py "$d" "$PHONE" --max 2; done

echo "== revoke: a third sign-in to $PHONE signs out everywhere"
vid=$(curl -sf "$ENGINE/auth/phone/start" -H 'Content-Type: application/json' -d "{\"phone\":\"$PHONE\"}" | sed -E 's/.*"verificationId":"([^"]+)".*/\1/')
curl -sf "$ENGINE/auth/phone/check" -H 'Content-Type: application/json' \
  -d "{\"verificationId\":\"$vid\",\"code\":\"000000\"}" >/dev/null   # the fake WeSend's code
token=$(curl -sf "$ENGINE/auth/phone/complete" -H 'Content-Type: application/json' \
  -d "{\"verificationId\":\"$vid\",\"deviceName\":\"two-devices.sh\"}" | sed -E 's/.*"accessToken":"([^"]+)".*/\1/')
curl -sf -X POST "$ENGINE/auth/sign-out-all" -H "Authorization: Bearer $token" -o /dev/null -w "sign-out-all: %{http_code}\n"
for d in "$A" "$B"; do
  "$MAESTRO" --device "$d" test .maestro/revoke-see.yaml >/dev/null && echo "revoke: $d is back at the Gate"
done
echo "== two-device flows passed"
