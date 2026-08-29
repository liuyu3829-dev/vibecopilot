import { afterEach, describe, expect, it, vi } from "vitest";

import { analyzeDailyReport, analyzeThought } from "./analysis";

describe("daily report analysis", () => {
  const originalKey = process.env.DEEPSEEK_API_KEY;
  afterEach(() => { vi.unstubAllGlobals(); process.env.DEEPSEEK_API_KEY = originalKey; });

  it("builds a diary material decision before writing a diary", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ selectedThoughtIds: ["thought-1"], chronology: "Keep the unresolved order as one moment in the day." }) } }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ markdown: "今天一直没决定要先写什么。", preview: "记录了一个尚未决定的写作问题。" }) } }],
      }), { status: 200 }));
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", fetch);

    const report = await analyzeDailyReport([{
      id: "thought-1", ownerId: "owner", transcript: "我还没决定要先写什么。", source: "manual", language: "cn",
      capturedAt: "2026-08-09T01:00:00.000Z", capturedDay: "2026-08-09", updatedAt: "2026-08-09T01:00:00.000Z",
      summary: null, tags: [], personalTags: [], reportIncluded: true, analysisStatus: "complete", deletedAt: null,
    }], "zh-CN", "short_essay");

    expect(report).toEqual({ markdown: "今天一直没决定要先写什么。", preview: "记录了一个尚未决定的写作问题。" });
    expect(fetch).toHaveBeenCalledTimes(2);
    const outlineBody = JSON.parse(fetch.mock.calls[0][1].body as string) as { messages: Array<{ content: string }> };
    const writingBody = JSON.parse(fetch.mock.calls[1][1].body as string) as { messages: Array<{ content: string }> };
    expect(outlineBody.messages[0].content).toContain("Diary");
    expect(outlineBody.messages[0].content).toContain("do not force a central theme");
    expect(writingBody.messages[0].content).toContain("private first-person diary");
    expect(writingBody.messages[0].content).toContain("light organization");
  });

  it("lets an opinion post leave out peripheral thoughts", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ coreTheme: "Reliability before expansion.", selectedThoughtIds: ["thought-post"], omittedThoughtIds: ["thought-post-2"] }) } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ markdown: "先把录音保存稳定，再谈新功能。", preview: "把可靠保存放在功能扩展之前。" }) } }] }), { status: 200 }));
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
    }], "zh-CN", "opinion_post");

    expect(report).toEqual({ markdown: "先把录音保存稳定，再谈新功能。", preview: "把可靠保存放在功能扩展之前。" });
    const body = JSON.parse(fetch.mock.calls[1][1].body as string) as { messages: Array<{ content: string }> };
    expect(body.messages[0].content).toContain("one strongest theme");
    expect(body.messages[0].content).toContain("may omit peripheral thoughts");
    expect(body.messages[0].content).not.toContain("coveredThoughtIds");
  });

  it("uses light organization for short casual material", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ selectedThoughtIds: ["thought-a"], focus: "Keep the raw thought intact." }) } }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ markdown: "今天有点累，但还是把这件事记下来。", preview: "保留了一条简短的随手记录。" }) } }] }), { status: 200 }));
    process.env.DEEPSEEK_API_KEY = "test-key";
    vi.stubGlobal("fetch", fetch);

    await expect(analyzeDailyReport([
      { id: "thought-a", ownerId: "owner", transcript: "今天有点累。", source: "manual", language: "cn", capturedAt: "2026-08-09T01:00:00.000Z", capturedDay: "2026-08-09", updatedAt: "2026-08-09T01:00:00.000Z", summary: null, tags: [], personalTags: [], reportIncluded: true, analysisStatus: "complete", deletedAt: null },
    ], "zh-CN", "casual_post")).resolves.toEqual({ markdown: "今天有点累，但还是把这件事记下来。", preview: "保留了一条简短的随手记录。" });
    const body = JSON.parse(fetch.mock.calls[1][1].body as string) as { messages: Array<{ content: string }> };
    expect(body.messages[0].content).toContain("light organization");
    expect(body.messages[0].content).toContain("do not turn it into a long piece");
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
