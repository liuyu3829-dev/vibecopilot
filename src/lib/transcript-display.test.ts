import { describe, expect, it } from "vitest";

import { splitTranscriptForReading } from "./transcript-display";

describe("splitTranscriptForReading", () => {
  it("keeps the original transcript intact while producing readable paragraphs", () => {
    const transcript = "第一句已经结束。第二句继续展开，第三句补充一点细节。第四句构成新的段落。";

    const blocks = splitTranscriptForReading(transcript, 18);

    expect(blocks.length).toBeGreaterThan(1);
    expect(blocks.every((block) => block.length <= 18)).toBe(true);
    expect(blocks.join("")).toBe(transcript);
  });

  it("splits an unpunctuated long transcript without changing its characters", () => {
    const transcript = "abcdefghijkl";

    const blocks = splitTranscriptForReading(transcript, 5);

    expect(blocks).toEqual(["abcde", "fghij", "kl"]);
    expect(blocks.join("")).toBe(transcript);
  });
});
