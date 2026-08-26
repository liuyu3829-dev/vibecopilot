# WebView Desktop Production Debugging Skill Design

## Goal

Create a reusable personal Codex skill for debugging and releasing products that combine a web application with a Tauri, Electron, or other WebView-based desktop companion. It must help separate browser, WebView, native, network, packaging, and release failures without tying the workflow to Thought Space or a specific speech provider.

## Scope

The skill will guide an agent to:

1. Preserve verified behavior and state which boundaries are out of scope before changing code.
2. Build an evidence table that separates permissions, audio/input capture, API session creation, WebSocket transport, transcript/display, persistence, native-window behavior, and release delivery.
3. Compare the actual browser and desktop request paths when one works and the other fails.
4. Prefer a minimal replacement at the failed boundary over a rewrite of working capture, authentication, or persistence code.
5. Verify desktop packaging uses a stable production origin, release installers are versioned, and website controls work against an installed application.
6. Run layered checks: focused regression tests, type/build checks, native compilation, and manual end-to-end acceptance.

## Exclusions

- No provider-specific API keys, domains, repository URLs, or framework-only commands.
- No assumption that a browser permission prompt proves streaming or transcription works.
- No automatic production deployment, GitHub release creation, or destructive recovery actions.
- No copying of stale design documents over current code and runtime evidence.

## Structure

`SKILL.md` will contain the short decision workflow and hard invariants. A single optional reference will capture the detailed evidence matrix and release checklist. The reference will use generic terms, with Thought Space only as a non-binding example of a WebView transport mismatch.

## Success criteria

The new skill is discoverable as a normal personal Codex skill, validates with the bundled skill validator, and helps an agent choose a testable fault layer before proposing a fix.
