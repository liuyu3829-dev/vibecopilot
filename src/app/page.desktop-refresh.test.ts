import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop orb timeline refresh", () => {
  it("refreshes the visible timeline when the desktop orb saves in the background", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");

    expect(page).toContain('window.addEventListener("focus", refreshTimeline)');
    expect(page).toContain('window.setInterval(refreshTimeline, 5000)');
  });

  it("keeps the capture card mic-first and only offers save or discard after a pause", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    const styles = readFileSync(resolve(process.cwd(), "src/app/styles.css"), "utf8");

    expect(page).toContain('draft.trim() ? <><button type="button" onClick={() => void startRecording(draft)}');
    expect(page).toContain('onClick={closeCapture}');
    expect(page).toContain('capture-discard ${discardArmed ?');
    expect(page).toContain('setDiscardArmed(true)');
    expect(page).toContain('className="capture-start"');
    expect(styles).toContain('white-space: nowrap');
  });

  it("resumes Web Audio before connecting the web capture stream", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");

    expect(page).toContain("await resumeAudioContext(context)");
    expect(page.indexOf("await resumeAudioContext(context)")).toBeLessThan(page.indexOf("connectAudioGraph(context, mediaStream"));
    expect(page.indexOf("const context = new AudioContext();")).toBeLessThan(page.indexOf('await fetch(`/api/speech/session'));
  });

  it("reports safe capture stages without logging capture content", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");

    expect(page).toContain('"speech_session"');
    expect(page).toContain('"microphone"');
    expect(page).toContain('"audio_context"');
    expect(page).toContain('"streaming"');
    expect(page).toContain('console.warn("[thought-space][capture]"');
  });
});
