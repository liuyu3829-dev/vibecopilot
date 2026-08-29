# Desktop orb WebView API transport

> 历史设计记录：本文描述的 WebView `fetch` 修复已在当前生产实现中生效；后续架构事实见 [`docs/current-architecture-and-release-status.md`](../../current-architecture-and-release-status.md)。

## Problem

The web application reaches the production site, but Windows direct HTTPS requests to
`https://vibecopilot-xi.vercel.app/api/thoughts` time out. The raw Tauri orb currently
routes all application API calls through Rust `reqwest`, so it fails before it can create
an AssemblyAI speech session. AssemblyAI and its server-side key are not involved in this
failure.

## Decision

Move raw-orb API requests from the Rust `desktop_api_request` command to `fetch` in the
Tauri WebView. The existing `api_origin` command remains the sole source of the compiled
development or production origin. The existing token remains in Windows secure storage and
is sent as the existing `Authorization` request header.

The relevant API routes already return the required CORS headers for the desktop WebView.
This change does not broaden those headers, change API authorization, or expose server
secrets.

## Scope

- Change `public/orb-shell/index.html` to fetch API URLs using the compiled origin.
- Remove the unused Rust HTTP command, URL helper, response type, and `reqwest` dependency.
- Retain Rust window, protocol, origin and secure-token commands.
- Preserve pairing, microphone, WebSocket, storage, reports, and web recording behavior.
- Bump the desktop release to `0.1.8` after the implementation is verified.

## Failure handling

The WebView keeps the existing safe `desktop_api` stage. HTTP failures retain the API error
message; transport failures retain the user-facing connection message. No token, key,
transcript, or raw response body is logged.

## Verification

1. Tests prove the raw orb uses `fetch` with the compiled origin and bearer token.
2. Tests prove the Rust API bridge and `reqwest` dependency are absent.
3. Existing origin, pairing, audio, and API route tests remain green.
4. Run all tests, type check, web build, Tauri check, and build a new `0.1.8` installer.
5. On the user's computer and the stable production site, open the orb, receive a speech
   session, obtain a WebSocket `101`, display a transcript, and save a `desktop_orb` thought.
