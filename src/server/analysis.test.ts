import { afterEach, describe, expect, it, vi } from "vitest";

import { analyzeDailyReport, analyzeThought } from "./analysis";

describe("daily report analysis", () => {
  const originalKey = process.env.DEEPSEEK_API_KEY;
  afterEach(() => { vi.unstubAllGlobals(); process.env.DEEPSEEK_API_KEY = originalKey; });

  it("builds an evidence outline before writing a short opinion note", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ claim: "Writing should begin with the unresolved question.", points: [{ point: "The source keeps returning to the order of writing.", thoughtIds: ["thought-1"] }], reservation: "The source does not settle the order yet." }) } }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ markdown: "## The unresolved order\n\nI keep returning to what should be written first.", preview: "A brief note about the unresolved order of writing." }) } }],
      }), { status: 200 }));
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", fetch);

    const report = await analyzeDailyReport([{
      id: "thought-1", ownerId: "owner", transcript: "我还没决定要先写什么。", source: "manual", language: "cn",
      capturedAt: "2026-08-09T01:00:00.000Z", capturedDay: "2026-08-09", updatedAt: "2026-08-09T01:00:00.000Z",
      summary: null, tags: [], personalTags: [], reportIncluded: true, analysisStatus: "complete", deletedAt: null,
    }], "zh-CN", "short_essay");

    expect(report).toEqual({ markdown: "## The unresolved order\n\nI keep returning to what should be written first.", preview: "A brief note about the unresolved order of writing." });
    expect(fetch).toHaveBeenCalledTimes(2);
    const outlineBody = JSON.parse(fetch.mock.calls[0][1].body as string) as { messages: Array<{ content: string }> };
    const writingBody = JSON.parse(fetch.mock.calls[1][1].body as string) as { messages: Array<{ content: string }> };
    expect(outlineBody.messages[0].content).toContain("evidence outline");
    expect(outlineBody.messages[0].content).toContain("thoughtIds");
    expect(writingBody.messages[0].content).toContain("Opinion short essay");
    expect(writingBody.messages[0].content).toContain("Do not add a Markdown title");
  });

  it("writes a post that covers every selected thought and honors its length preference", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ claim: "The reliable core matters before new features.", points: [{ point: "Recording must be saved before it can be expanded.", thoughtIds: ["thought-post"] }, { point: "A narrow operating model can preserve more opportunities.", thoughtIds: ["thought-post-2"] }], reservation: "The source does not decide the next feature." }) } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ markdown: "我这几天一直在补功能，后来才发现最重要的是先把刚刚说过的话好好存住。功能可以慢一点长出来，信任不行；同样地，尽量把固定成本压低，才有余地留住更多试错的机会。", preview: "A note about reliable capture and keeping room to experiment.", coveredThoughtIds: ["thought-post", "thought-post-2"] }) } }] }), { status: 200 }));
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", fetch);

    const report = await analyzeDailyReport([{
      id: "thought-post", ownerId: "owner", transcript: "先把录音保存稳定，再继续做新功能。", source: "manual", language: "cn",
      capturedAt: "2026-08-09T01:00:00.000Z", capturedDay: "2026-08-09", updatedAt: "2026-08-09T01:00:00.000Z",
      summary: null, tags: [], personalTags: [], reportIncluded: true, analysisStatus: "complete", deletedAt: null,
    }, {
      id: "thought-post-2", ownerId: "owner", transcript: "固定成本越低，个人能保留的试错机会就越多。", source: "manual", language: "cn",
      capturedAt: "2026-08-09T02:00:00.000Z", capturedDay: "2026-08-09", updatedAt: "2026-08-09T02:00:00.000Z",
      summary: null, tags: [], personalTags: [], reportIncluded: true, analysisStatus: "complete", deletedAt: null,
    }], "zh-CN", "post", "long");

    expect(report?.markdown).not.toContain("#");
    const body = JSON.parse(fetch.mock.calls[1][1].body as string) as { messages: Array<{ content: string }> };
    expect(body.messages[0].content).toContain("single first-person post");
    expect(body.messages[0].content).toContain("600–1,400 Chinese characters");
    expect(body.messages[0].content).toContain("coveredThoughtIds");
  });

  it("rejects a report outline that omits a selected thought", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ claim: "Only one point.", points: [{ point: "The first thought.", thoughtIds: ["thought-a"] }], reservation: "Uncertain." }) } }] }), { status: 200 }));
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", fetch);

    await expect(analyzeDailyReport([
      { id: "thought-a", ownerId: "owner", transcript: "第一条。", source: "manual", language: "cn", capturedAt: "2026-08-09T01:00:00.000Z", capturedDay: "2026-08-09", updatedAt: "2026-08-09T01:00:00.000Z", summary: null, tags: [], personalTags: [], reportIncluded: true, analysisStatus: "complete", deletedAt: null },
      { id: "thought-b", ownerId: "owner", transcript: "第二条。", source: "manual", language: "cn", capturedAt: "2026-08-09T02:00:00.000Z", capturedDay: "2026-08-09", updatedAt: "2026-08-09T02:00:00.000Z", summary: null, tags: [], personalTags: [], reportIncluded: true, analysisStatus: "complete", deletedAt: null },
    ], "zh-CN", "post", "adaptive")).rejects.toThrow("DEEPSEEK_INVALID_RESPONSE");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps automatic analysis to a summary and does not create AI tags", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ summary: "A short summary." }) } }],
    }), { status: 200 }));
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", fetch);

    const analysis = await analyzeThought({
      id: "thought-2", ownerId: "owner", transcript: "A raw thought.", source: "manual", language: "en",
      capturedAt: "2026-08-09T01:00:00.000Z", capturedDay: "2026-08-09", updatedAt: "2026-08-09T01:00:00.000Z",
      summary: null, tags: [], personalTags: [], reportIncluded: true, analysisStatus: "pending", deletedAt: null,
    });

    expect(analysis).toEqual({ summary: "A short summary.", tags: [] });
    const body = JSON.parse(fetch.mock.calls[0][1].body as string) as { messages: Array<{ content: string }> };
    expect(body.messages[0].content).not.toContain("tags has");
  });
});
