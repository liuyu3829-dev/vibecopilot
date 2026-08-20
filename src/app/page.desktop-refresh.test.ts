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
});
