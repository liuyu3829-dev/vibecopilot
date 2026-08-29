# Desktop Orb 0.1.9 Polish Design

> 历史设计记录：该版本范围已经完成；本文保留为验收背景，不代表后续迭代计划。

## Scope

This release polishes the already-working desktop orb without changing its microphone capture, WebView API transport, AssemblyAI session flow, or web Show/Hide protocol.

## Changes

1. Create the native Tauri webview with a fully transparent background color in addition to its existing transparent window setting. This lets WebView2 compose the circular idle orb and expanded card without an opaque rectangular backing layer.
2. Render only transcript turns that are identified as Chinese or English by the provider, or whose characters consist solely of Han/Latin characters, normal digits, whitespace, and punctuation. Other-language turns are ignored before they affect the visible transcript.
3. Keep website Show/Hide unchanged. The installed app registers the `thoughtspace` protocol and the website opens `open-orb` or `hide-orb` links; release packaging must preserve this behavior.

## Verification

- Rust compilation accepts the transparent background configuration.
- Source tests cover transparent native construction and the language guard.
- The 0.1.9 installer is manually checked on Windows: no square backing layer in idle or expanded state; Chinese and English transcribe; Korean is not appended; website Show, Hide, and Show again work after installation.
