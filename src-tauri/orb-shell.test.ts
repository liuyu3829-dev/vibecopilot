import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("bundled desktop orb shell", () => {
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
    expect(page).toContain("const result = await response.json().catch(() => null);");
    expect(page).toContain('await invoke("clear_token")');
    expect(native).toContain("fn clear_token()");
  });
});
