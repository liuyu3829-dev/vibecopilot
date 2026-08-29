# Desktop orb production connection repair

> 历史排障记录：其中的原生 HTTP 方案已被 WebView `fetch` 方案替代，不代表当前实现。

## Confirmed cause

The installed Tauri orb reaches `getUserMedia`, then fails while its native `desktop_api_request` bridge checks the paired Thought Space session. The user-facing “cannot connect Thought Space” notice is emitted only from that native API path, not from microphone capture or AssemblyAI.

The API origin is compiled into the installer through `THOUGHT_SPACE_API_ORIGIN`. A package built without the production value falls back to `http://127.0.0.1:3001`, which cannot work on an end user's machine after deployment.

## Scope

- Keep the packaged production origin fixed at `https://vibecopilot-xi.vercel.app`.
- Make a failed desktop API/session check end the pending capture cleanly: release the microphone, restore the start control, and show a production-connection message.
- Add safe diagnostics that identify the `desktop_api` stage without exposing tokens, URLs with credentials, or transcription text.
- Keep the existing browser speech path, AssemblyAI protocol, pairing model, Reports, and data model unchanged.

## Acceptance criteria

1. A production-built installer contains the stable production origin and not the localhost fallback.
2. When the desktop API bridge cannot reach Thought Space, the orb is no longer stuck on “connecting” and the microphone track is stopped.
3. The failure is visibly reported as a desktop API connection issue.
4. The existing paired desktop API flow still works when the bridge succeeds.
5. Relevant tests, type checking, web build, and Tauri compile checks pass before a new installer is built.

## Release consequence

Because this changes the desktop binary, it requires a new installer release and a fresh installation. A Vercel redeployment alone cannot update an installed orb.
