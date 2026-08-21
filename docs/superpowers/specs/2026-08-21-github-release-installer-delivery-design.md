# GitHub Release installer delivery

## Goal

Let any visitor download the public Windows desktop-orb installer without a Cloudflare account, payment method, invite code, or R2 credentials. Keep the installed orb's pairing, local show/hide bridge, recording, and Supabase data flow unchanged.

## Chosen approach

Publish each signed NSIS installer as an asset of the repository's public GitHub Release. The web app's existing `GET /api/desktop/download` endpoint reads one server-side environment variable, `DESKTOP_RELEASE_URL`, and redirects to it. The variable points to the immutable GitHub Release asset URL.

This keeps the Settings download button stable while allowing a new installer release to be selected by changing one Vercel environment variable and redeploying. The asset itself is public by design, so it does not require a signed URL or a storage credential.

## Scope

- Replace the R2 SDK route with a URL-validation-and-redirect route.
- Return the existing `DESKTOP_DOWNLOAD_NOT_CONFIGURED` 503 when no valid URL is configured.
- Remove unused R2 SDK packages and R2 variables from the example environment file and README.
- Document release packaging, GitHub Release upload, and the Vercel variable.

## Non-goals

- Do not change Tauri application code, orb UI, local bridge, pairing, Supabase, reports, or recording.
- Do not commit an installer binary to Git.
- Do not create or publish a GitHub Release automatically; this requires the repository owner's explicit release action.

## Verification

1. A test proves a valid HTTPS GitHub release URL returns a 302 redirect.
2. A test proves absent or non-GitHub configuration returns the existing 503 response.
3. The release-flow test proves R2 SDK and R2 configuration are absent from the download route.
4. The TypeScript check, unit tests, and production build pass.
