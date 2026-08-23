import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("bundled desktop orb shell", () => {
  it("refreshes an already running orb when a new pairing ticket is supplied", () => {
    const source = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");

    expect(source).toContain("let refresh_shell = ticket.is_some();");
    expect(source).toContain('window.eval("window.location.reload();")');
  });

  it("stops session validation when refreshing the desktop pairing fails", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");

    expect(page).toContain("if (!await refreshDesktopSession()) return false;");
    expect(page).toContain("desktopToken = null;");
  });

  it("opens a local Tauri page instead of the remote dashboard", () => {
    const source = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");

    expect(source).toContain('WebviewUrl::App("orb-shell/index.html".into())');
    expect(existsSync(resolve(process.cwd(), "public/orb-shell/index.html"))).toBe(true);
  });

  it("contains a draggable ball and a visible recording control", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");

    expect(page).toContain('id="orb"');
    expect(page).toContain('id="record-button"');
  });

  it("keeps a compact mic-first capture control and only reveals post-stop actions", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");

    expect(page).toContain('id="close"');
    expect(page).not.toContain('id="cancel"');
    expect(page).toContain('id="save" type="button" hidden');
    expect(page).toContain('id="discard"');
    expect(page).toContain('hidden><svg');
    expect(page).toContain("function renderCaptureControls()");
    expect(page).toContain('recordButton.textContent = "继续说话";');
    expect(page).toContain('discardButton.textContent = "确认删除";');
    expect(page).toContain('document.getElementById("close").addEventListener("click", collapse);');
  });

  it("keeps a hidden orb process available for instant protocol-based reopening", () => {
    const source = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");

    expect(source).toContain('Some("open-orb")');
    expect(source).toContain('Some("hide-orb")');
    expect(source).toContain('window.hide()');
    expect(source).toContain('window.show()');
  });

  it("stores a first-time web control secret before honoring a protocol hide request", () => {
    const source = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");

    expect(source).toContain('Some("hide-orb") => Some(OrbAction::Hide(');
    expect(source).toContain("Some(OrbAction::Hide(control_secret))");
    expect(source).toContain("if let Some(control_secret) = control_secret {\n    store_control_secret(&control_secret)?;");
  });

  it("uses the Windows GUI subsystem so protocol controls never show a terminal", () => {
    const source = readFileSync(resolve(process.cwd(), "src-tauri/src/main.rs"), "utf8");

    expect(source).toContain('#![cfg_attr(windows, windows_subsystem = "windows")]');
  });

  it("does not prevent the orb from opening when Windows denies protocol re-registration", () => {
    const source = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");

    expect(source).toContain("let _ = app.deep_link().register_all();");
  });

  it("uses a compact listening-sheet hierarchy", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");
    const native = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");

    expect(page).toContain(".summary { order:1; flex-direction:column;");
    expect(page).toContain("#transcript { order:2;");
    expect(page).toContain("#voice-wave { order:3;");
    expect(page).toContain(".actions { order:5;");
    expect(page).toContain("white-space:nowrap");
    expect(native).toContain("const CARD_WIDTH: f64 = 332.0;");
  });

  it("draws a live audio waveform and keeps long transcripts editable and scrollable", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");

    expect(page).toContain('id="voice-wave"');
    expect(page).toContain("function drawWave(samples)");
    expect(page).toContain("overflow-y:auto");
    expect(page).toContain("function renderCaptureControls()");
  });
  it("clears completed capture state before a new recording", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");

    expect(page).toContain("function resetTranscript()");
    expect(page).toContain('confirmed = ""; live = ""; transcript.value = "";');
    expect(page).toContain("async function start(initialTranscript = \"\") {");
    expect(page).toContain("confirmed = initialTranscript; live = \"\"; transcript.value = initialTranscript;");
  });

  it("pauses the current capture when the user edits live transcription", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");

    expect(page).toContain("let captureRun = 0;");
    expect(page).toContain("if (captureRun !== activeRun) return;");
    expect(page).toContain('transcript.addEventListener("input"');
    expect(page).toMatch(/if \(recording\) \{\s+stop\(\);/);
    expect(page).toContain('recordButton.addEventListener("click", () => recording ? stop() : start(transcript.value));');
  });

  it("abandons an outdated asynchronous recording start before it can reclaim the audio graph", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");

    expect(page).toContain("const media = await navigator.mediaDevices.getUserMedia({audio:true});");
    expect(page).toContain("if (captureRun !== activeRun) { media.getTracks().forEach(track => track.stop()); return; }");
    expect(page).toContain("if (captureRun !== activeRun) { webSocket.close(); media.getTracks().forEach(track => track.stop()); void audioContext.close(); return; }");
  });

  it("requires a valid paired desktop session before recording or saving", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");
    const native = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");

    expect(page).toContain("async function ensureDesktopSession()");
    expect(page).toContain('if (!await ensureDesktopSession()) return;');
    expect(page).toContain("const result = response.data;");
    expect(page).toContain('await invoke("clear_token")');
    expect(native).toContain("fn clear_token()");
  });

  it("routes Thought Space API calls through the native HTTPS bridge", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");
    const native = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");

    expect(page).toContain('invoke("desktop_api_request"');
    expect(page).not.toContain('fetch(`${apiOrigin}/api/thoughts`');
    expect(native).toContain("async fn desktop_api_request(");
    expect(native).toContain("fn desktop_api_url(path: &str)");
  });

  it("gives installed users a network hint instead of asking them to start a local web service", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");

    expect(page).toContain("无法连接 Thought Space，请检查网络或稍后重试。");
    expect(page).not.toContain("Make sure the web service is running.");
  });

  it("uses the Windows system proxy configuration and surfaces native connection errors", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");
    const native = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");

    expect(native).toContain("reqwest::Client::builder().build()");
    expect(native).not.toContain("reqwest::Client::builder().no_proxy().build()");
    expect(page).toContain("catch (error)");
    expect(page).toContain("error instanceof Error ? error.message");
  });
});
