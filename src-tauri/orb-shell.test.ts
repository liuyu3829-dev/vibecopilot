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

  it("uses the centered listening-sheet hierarchy without changing capture controls", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");

    expect(page).toContain(".summary { order:2; flex-direction:column;");
    expect(page).toContain("#transcript { order:3;");
    expect(page).toContain("#voice-wave { order:4;");
    expect(page).toContain("#record-button { order:5;");
    expect(page).toContain(".actions { order:6;");
  });

  it("draws a live audio waveform and keeps long transcripts editable and scrollable", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");

    expect(page).toContain('id="voice-wave"');
    expect(page).toContain("function drawWave(samples)");
    expect(page).toContain("overflow-y:auto");
    expect(page).toContain("#state { visibility:hidden; }");
  });
  it("clears completed capture state before a new recording", () => {
    const page = readFileSync(resolve(process.cwd(), "public/orb-shell/index.html"), "utf8");

    expect(page).toContain("function resetTranscript()");
    expect(page).toContain('confirmed = ""; live = ""; transcript.value = "";');
    expect(page).toContain("async function start() {\n      stop(); resetTranscript();");
  });
});
