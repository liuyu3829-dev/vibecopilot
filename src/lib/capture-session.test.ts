import { describe, expect, it } from "vitest";

import { replaceTranscriptAfterManualEdit, shouldAcceptCaptureMessage } from "./capture-session";

describe("capture session", () => {
  it("starts a new segment on a manual edit and rejects delayed messages from the old segment", () => {
    const next = replaceTranscriptAfterManualEdit({ run: 4, transcript: { confirmed: "delete this。", live: "" } }, "keep this。");

    expect(next).toEqual({ run: 5, transcript: { confirmed: "keep this。", live: "" } });
    expect(shouldAcceptCaptureMessage(next.run, 4)).toBe(false);
    expect(shouldAcceptCaptureMessage(next.run, 5)).toBe(true);
  });
});
