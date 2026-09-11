# Expo HAS CHANGED

This project is on **Expo SDK 54** — `package.json` pins `expo: ~54.0.0` against React Native
0.81.5. Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing
any code: Expo's API surface moves every SDK, and the unversioned docs describe whichever SDK is
current, which is not this one.

**If you bump `expo` in `package.json`, bump the link above in the same commit.** This file named
v56 from the initial commit (2026-08-16) until 2026-09-11 while the app was pinned to v54, and the
root `CLAUDE.md` told readers to believe the file over the lockfile — so every Expo instruction
given in this repo pointed at an SDK the app was not on.

## Expo Go cannot run this app

Three native modules are not part of Expo Go, which ships only Expo's own:

| Module | What breaks without it |
|---|---|
| `react-native-agora` | Every video call — the Flame Rite, Town Square rounds |
| `@shopify/react-native-skia` | All Canvas vfx (embers, bursts, fog) |
| `react-native-view-shot` | Sharing a character card as an image |

`components/video/AgoraVideoCall.native.tsx` already guards for this
(`Constants.appOwnership !== 'expo'`); `lib/vfx.ts` does not, so Skia mounts on any native
platform with no fallback.

Expo Go also tracks the latest SDK and auto-updates from the Play Store, so it will drift out of
step with this project on every Expo release. That mismatch is noise, not risk — it has no
bearing on anything built or shipped. Do not chase it by upgrading.

## Use the development build instead

Already configured — `expo-dev-client` is a dependency and `eas.json` has the profile:

```bash
eas build --profile development --platform android
```

It produces an internal-distribution APK containing this project's own SDK and native modules,
with `EXPO_PUBLIC_API_URL` baked in. Install it once; after that the Expo Go version on the
device is irrelevant and video calls are testable on hardware for the first time.
