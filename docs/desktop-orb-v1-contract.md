# Desktop Orb Core Contract v1

This document freezes the desktop orb behavior accepted on 2026-08-06. Changes to the desktop orb must keep every item below true.

For project-wide ownership, API, data, and future calendar/login isolation rules, see [Feature boundaries](feature-boundaries.md).

## User-visible behavior

1. The orb is transparent, borderless, always on top, and freely draggable.
2. Clicking the orb opens the compact capture card.
3. The capture card can request the microphone, stream live transcription, stop recording, and save one thought to the web timeline.
4. Raw audio is never written to disk.
5. Closing the capture card collapses it back to the orb. The existing close/exit behavior is not changed by web controls.
6. A web control may hide or reveal the already-running orb immediately. Hiding must not stop recording infrastructure, alter saved thoughts, or recreate the desktop process.

## Technical boundary

- The desktop app is the only owner of native window visibility, dragging, and size.
- The web dashboard requests `thoughtspace://open-orb` or `thoughtspace://hide-orb`; it does not create a second desktop window.
- The desktop app keeps its current process alive while hidden, so opening a hidden orb is a show/focus operation rather than an application launch.
- Real-time transcription and saving continue to use the existing `/api/speech/session` and `/api/thoughts` paths.

## Regression gate

Before changing desktop-orb UI, protocol behavior, or recording code, run `npm test`, `npm run typecheck`, and `npm run build`. The automated contract tests must cover the local shell, drag command, visible recording control, show/hide protocol actions, and local API recording/save endpoints.
