# Public Desktop Orb Download and Control Design

## Goal

Ship Thought Space Orb as a normal Windows companion app for every visitor of the deployed Thought Space website. Installing the companion must not require Node.js, Rust, a terminal, a local Next.js service, an invite code, or developer tools.

The existing orb appearance, free dragging, capture-card flow, real-time AssemblyAI transcription, deletion behavior, and Supabase save flow are frozen by `docs/desktop-orb-v1-contract.md` and are out of scope for this change.

## User flow

1. A visitor opens Settings on the deployed Thought Space site and clicks **Download for Windows**.
2. The web server issues a short-lived R2 download URL for the signed NSIS installer. No invite code or browser access cookie is required.
3. The visitor installs `Thought Space Orb Setup.exe`. The installer registers the `thoughtspace://` protocol and offers to launch the orb after installation.
4. On first show, the website uses one protocol launch to pair the browser's Thought Space identity with the installed app.
5. While the desktop app remains running, **Show orb** and **Hide orb** take effect immediately without a browser protocol-confirmation dialog and without a second orb process.
6. If the desktop app is fully exited or the computer has restarted, Settings shows that it is offline. Choosing **Start orb** uses the Windows protocol once; the browser may ask for confirmation because a website cannot silently start a native process.

Hidden means the window is hidden while the compact desktop process stays alive. It is not an autostart feature and it does not keep the microphone active.

## Design

### Download delivery

`GET /api/desktop/download` stays server-side and creates a five-minute signed R2 redirect. It no longer checks `DESKTOP_BETA_INVITE_CODES` or a beta cookie. The Settings invite input, prompt, beta endpoint, cookie helper, related tests, and beta-only environment variables are removed.

The installer binary is not committed to GitHub. A release build is produced with `THOUGHT_SPACE_API_ORIGIN` set to the deployed HTTPS application URL, then uploaded to the configured private R2 bucket at `R2_DESKTOP_INSTALLER_KEY`.

### Pairing and local control

The existing one-time server pairing ticket remains the trust bootstrap. When the website first starts an installed orb, the pairing response additionally provides a high-entropy **local control secret**. The page stores this secret only in its own origin storage; the desktop app stores a hash in Windows Credential Manager after it exchanges the one-time ticket.

The running desktop app owns a loopback-only control listener at `127.0.0.1` on a documented fixed port. Its only commands are `show` and `hide`.

Each browser request must include the local control secret. The listener rejects requests with a missing or invalid secret and returns no permissive CORS response. It accepts CORS only from the packaged `THOUGHT_SPACE_API_ORIGIN` (and the explicit local development origin). The listener never exposes transcription, stored thoughts, API secrets, or filesystem access.

The website tries this local endpoint first:

- Success: update Settings status and do not invoke `thoughtspace://`.
- Connection failure: show a clear offline state and a separate **Start orb** action.
- Authentication failure: clear the stale local secret and use a one-time re-pair action.

The protocol remains solely a launch/pairing fallback, not the normal show/hide mechanism. The Tauri single-instance handler must forward a protocol action to the running instance and never construct a second `orb` window.

### Data and privacy

The local control secret is distinct from the existing server-issued desktop API token. It grants only local window visibility and cannot read or write Supabase data. The existing desktop API token remains in Windows Credential Manager and continues to authorize `/api/speech/session` and `/api/thoughts`.

No audio is added to disk, no recording is started by show/hide, and hidden state does not alter the desktop recording lifecycle.

## Settings states

- **Not installed / not paired:** Download button and brief install explanation.
- **Running and paired:** Show and Hide buttons. Both are immediate local requests.
- **Installed but offline:** Start orb button, which may prompt the browser once.
- **Stale pairing:** Reconnect orb button, which creates a one-time ticket and refreshes the local control secret.

The web UI must not claim that it can instantly start a fully exited native app; Windows browser confirmation is expected in that one case.

## Verification

1. Direct download has no invite field, prompt, beta cookie, or beta endpoint dependency.
2. The download response is a short-lived R2 redirect and contains no R2 credential.
3. A valid local secret can show and hide the same running window without a custom-protocol navigation.
4. Invalid origin or secret cannot control the local listener.
5. Calling show/hide repeatedly leaves exactly one `thought-space-orb` process and one `orb` window.
6. When the listener is unavailable, Settings reports offline and does not silently create a new process; Start orb uses the protocol fallback.
7. Existing orb contract tests for drag, capture, save, transcript deletion, and Supabase persistence continue to pass.

## Non-goals

- No Windows autostart, global shortcut, background microphone, macOS release, login redesign, updater service, or public installer analytics.
- No change to the currently approved orb visual design or recording card.
