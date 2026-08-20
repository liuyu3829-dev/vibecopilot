import { describe, expect, it } from "vitest";

import { selectReportThoughts } from "./daily-report-input";

describe("daily report input", () => {
  it("uses only selected thoughts from the requested Shanghai calendar day", () => {
    const thoughts = [
      { id: "included", capturedDay: "2026-08-09", reportIncluded: true },
      { id: "excluded", capturedDay: "2026-08-09", reportIncluded: false },
      { id: "other-day", capturedDay: "2026-08-08", reportIncluded: true },
    ];

    expect(selectReportThoughts(thoughts, "2026-08-09").map((thought) => thought.id)).toEqual(["included"]);
  });
});
