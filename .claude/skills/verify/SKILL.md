---
name: verify
description: How to run + drive MingldIngl end-to-end (scripts/dev.sh with fake WeSend, seed CLI, Maestro on the A51/emulator, adb screenshots, the device pass against Figma)
---

# MingldIngl end-to-end verification recipe

## Start the stack
- `./scripts/dev.sh` — checks Postgres, runs the engine under `dotnet watch` on `0.0.0.0:5150`
  with **fake WeSend** (no text; every code is 000000), Metro on 8081, the admin on 5173.
  `--real-sms` uses WeSend with `WeSend:ApiKey` from appsettings: a `ws_test_` sandbox key sends
  nothing and its code is 000000; a live key texts for real at 80₮ of credit each (the project
  account sends only to its owner's own number until it is Active).
- Health: `curl localhost:5150/health`. Swagger/OpenAPI only in Development.
- `dotnet watch` sometimes keeps old code after a new class/endpoint: kill the child
  (`pgrep -f DOTNET_WATCH_ITERATION`), `touch` a source file, wait for `/health`.
- Don't `pkill -f <pattern>` inside a command whose own text matches the pattern — it kills the shell.

## Accounts in any state, no SMS
- With fake WeSend every number takes the code **000000** (Maestro: `_code.yaml`) — except
  **99000001**, whose code expires ("That code expired"). Any other code is "not the code we sent".
- `cd mingldingl_engine && ASPNETCORE_ENVIRONMENT=Development ~/.dotnet/dotnet run --project src/MinglDingl.Engine --no-launch-profile -- seed <Step1..Step6|Finished|Suspended|Deleted> --phone 99xxxxxx`
  puts that number's account in that exact state; signing in with it lands there. A signed-in app
  picks the change up on relaunch. `seed crowd` restores the 48-person crowd (99100000–99100047) and their world (venues, bonds at every stage, meetings, threads, reports); `seed crowd --phone 99xxxxxx` also gives that finished account one bond at each stage.
- `PUT /dev/config/{key}` `{ "value": "…" }` writes config like the admin does (bounds + a live
  `config.updated`): `app.minVersion 99.0.0` → Update required, `app.maintenance true` → repairs.
  Put them back afterwards.
- In the app, the dev Tools screen (Expo dev menu → "MingldIngl tools") does the same for the
  signed-in account and fires live/world events.
- Direct DB look: connection string in `appsettings.Development.json`; tables are PascalCase
  columns (`config."Key"`). Engine tests never touch this DB (they initdb their own throwaway Postgres).

## Devices
- **A51** (`R58N33NA73Y`, USB) and **emulator** (`emulator -avd mingl_pixel`, `emulator-5554`).
  Both run the development build; Metro serves the JS, so JS edits need no rebuild. Native changes:
  `npx expo run:android`.
- Open the app on Metro: Maestro's `_launch.yaml`, or
  `adb shell am start -a android.intent.action.VIEW -d "mingldingl://expo-development-client/?url=http%3A%2F%2F192.168.1.32%3A8081"`.
- Look: `adb exec-out screencap -p > shot.png` then Read it (shown at 900×2000; ×1.20 for taps).
  UI tree without screenshots (e.g. inside a personal photo picker):
  `adb shell uiautomator dump /sdcard/ui.xml && adb shell cat /sdcard/ui.xml`. Keyboard state:
  `adb shell dumpsys input_method | grep mInputShown`.
- The A51 is a personal phone: never screenshot its gallery or other apps.

## Maestro (`mingldingl_app/.maestro`, `~/.maestro/bin/maestro --device <id> test <flow>`)
- `signup.yaml`, `resume.yaml`, `resume-every-step.yaml`, `keyboard-clear.yaml`;
  `two-devices.sh <A> <B>` = live-edit (with on-screen latency, limit 2 s) + revoke.
- `device-pass.sh <device>` = the foundation screens (sign-in, onboarding, Character, Edit) in EN and MN, each diffed against its Figma
  frame (`scripts/visual-diff.mjs`, token `~/.figma-token`). The frames show other names and
  photos, so read the three-panel images, not just the percentage.
- Once per device: `push-seed-photos.sh <device>` — `_pick-portraits.yaml` picks from that album
  (Samsung picker: Collections → From this device → MingldinglSeed).
- Screenshots land in Maestro's debug folder (`~/.maestro/tests/<run>/<flow>/takeScreenshot/`),
  not the working directory.
- Never `hideKeyboard` (Android Back; can leave the app) — tap body text via `_keys-away.yaml`.
  After a relaunch, `waitForAnimationToEnd` before typing, or the text lands nowhere.
- Maestro types fast; the emulator once dropped a key ("uul" → "ul"). Rerun before suspecting the app.

## Admin
- `cd mingldingl_control && npm run e2e` — Playwright with its own engine, a throwaway admin and
  its own database `mingldingl_e2e`, dropped and remade each run (`playwright.config.ts`). The dev engine's admin password is the user's; don't ask for it to
  test — use `/dev/config` or the e2e setup.
