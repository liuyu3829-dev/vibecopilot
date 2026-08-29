# Thought Space

## Feature boundaries

Before extending the product, read [the feature-boundaries contract](docs/feature-boundaries.md). It freezes the accepted desktop orb, real-time capture, storage, and API behavior, and defines how future calendar/journal and login work must remain isolated.

Thought Space captures live spoken thoughts with AssemblyAI, creates user-selected daily writing with DeepSeek, and stores each signed-in user’s data in Supabase. The current release is **0.1.9**. For the authoritative production architecture and release state, read [current architecture and release status](docs/current-architecture-and-release-status.md).

## Local development

1. Copy `.env.example` values into `.env.local`.
2. For the temporary local data mode, set `THOUGHT_SPACE_MODE=local`.
3. Run `npm run dev` and open `http://localhost:3001`.

## Public cloud mode

For the public product, set `THOUGHT_SPACE_MODE=supabase` and `NEXT_PUBLIC_THOUGHT_SPACE_GUEST_MODE=true`. The site silently creates one Supabase anonymous user per browser; there is no email screen or magic-link loop. That anonymous identity owns the thoughts and can pair one or more installed desktop orbs. It is intentionally device-local for this release; account recovery/linking comes later.

1. In Supabase SQL Editor, run the schema migrations in order, including `supabase/migrations/20260805_thought_space.sql`, `supabase/migrations/20260807_daily_report_modes.sql`, and `supabase/migrations/20260818_curated_daily_reports.sql`.
2. In Supabase Authentication, enable **Anonymous sign-ins**.
3. Configure the Supabase URL, publishable/anon key and service role key, plus the existing AssemblyAI and DeepSeek server keys, on the deployed web host. Keep service, AssemblyAI and DeepSeek keys server-only.
4. Configure `DESKTOP_RELEASE_URL` with the public URL of the current Windows installer asset in GitHub Releases.

## Windows desktop orb release

Build the NSIS installer only after the web app has a real HTTPS URL:

```powershell
$env:THOUGHT_SPACE_API_ORIGIN = "https://your-app.example.com"
npm run desktop:pack
```

Create a public GitHub Release and upload the generated `Thought Space_*.exe` as its installer asset. Copy that asset's browser-download URL into the deployed app's `DESKTOP_RELEASE_URL` environment variable. New visitors download and install the normal Windows installer directly from Settings, then use **Show orb** or **Hide orb** from the web page. The first launch creates a one-time pairing ticket; the installed app exchanges it for a secure desktop session and then saves into the same browser identity.
## Windows desktop orb

The Windows orb uses Tauri and Windows WebView2 rather than Electron. During local development, start the web service first and then run `npm run desktop:dev`. This is only a developer workflow.

The production Windows installer uses the `thoughtspace://` protocol and connects the orb to the deployed HTTPS Thought Space API through its WebView. It does not launch a terminal, local Next server, or local SQLite database. Build with `THOUGHT_SPACE_API_ORIGIN` set to the stable deployed HTTPS app URL. The final product is a normal Windows installer; users do not install Rust, Node.js, or developer tools.

## Curated daily reports

Daily reports are immutable, date-based snapshots. A thought is included by default; clear its **Daily report** checkbox to exclude it from the next report. The report generator uses only the selected thoughts from the Shanghai calendar date and saves their IDs, times, and original text as evidence. Chinese and English reports are stored independently. Existing legacy report modes remain readable for compatibility.
