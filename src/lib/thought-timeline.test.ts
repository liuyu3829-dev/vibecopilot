import { describe, expect, it } from "vitest";

import { filterThoughtsForDate, localDateKey } from "./thought-timeline";

describe("thought timeline date selection", () => {
  it("only returns thoughts captured on the selected local day", () => {
    const selectedDate = localDateKey("2026-08-09T05:10:00.000Z");
    const otherDate = localDateKey("2026-08-07T05:10:00.000Z");
    const thoughts = [
      { id: "selected", capturedAt: "2026-08-09T05:10:00.000Z" },
      { id: "other", capturedAt: "2026-08-07T05:10:00.000Z" },
    ];

    expect(filterThoughtsForDate(thoughts, selectedDate)).toEqual([thoughts[0]]);
    expect(filterThoughtsForDate(thoughts, otherDate)).toEqual([thoughts[1]]);
  });
});
