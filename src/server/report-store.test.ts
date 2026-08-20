import { afterEach, describe, expect, it } from "vitest";

import { createLocalReportStore } from "./report-store";

describe("local report store", () => {
  const stores: Array<{ close(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(stores.splice(0).map((store) => store.close()));
  });

  it("keeps independent report snapshots for each mode", async () => {
    const store = createLocalReportStore(":memory:");
    stores.push(store);

    await store.save("local-user", {
      date: "2026-08-04",
      locale: "en",
      mode: "short_essay",
      markdown: "# Reflection\n\nA reflective day.",
      theme: "Build with purpose",
      narrative: "A reflective day.",
      insights: ["Keep shipping."],
      sourceThoughtCount: 2,
    });
    const post = await store.save("local-user", {
      date: "2026-08-04",
      locale: "en",
      mode: "post",
      markdown: "# Essay\n\nA clearer argument.",
      theme: "Clarity drives execution",
      narrative: "A clearer day.",
      insights: ["Choose the next action."],
      sourceThoughtCount: 3,
    });

    expect(await store.get("local-user", "2026-08-04", "en", "short_essay")).toMatchObject({ mode: "short_essay", markdown: "# Reflection\n\nA reflective day." });
    expect(await store.get("local-user", "2026-08-04", "en", "post")).toEqual(post);

    const regeneratedReflection = await store.save("local-user", {
      date: "2026-08-04",
      locale: "en",
      mode: "short_essay",
      markdown: "# Reflection\n\nA revised reflection.",
      theme: "Build with purpose",
      narrative: "A revised day.",
      insights: ["Keep shipping."],
      sourceThoughtCount: 3,
    });

    expect(await store.get("local-user", "2026-08-04", "en", "short_essay")).toEqual(regeneratedReflection);
    expect(await store.get("local-user", "2026-08-04", "en", "post")).toEqual(post);
  });

  it("lists every language and mode generated for one date", async () => {
    const store = createLocalReportStore(":memory:");
    stores.push(store);
    const base = { date: "2026-08-07", theme: "A thought", narrative: "A note.", insights: [], sourceThoughtCount: 1 };

    await store.save("local-user", { ...base, locale: "zh-CN", mode: "short_essay", markdown: "# 随笔" });
    await store.save("local-user", { ...base, locale: "en", mode: "post", markdown: "# Post" });
    await store.save("local-user", { ...base, date: "2026-08-08", locale: "en", mode: "short_essay", markdown: "# Other day" });

    expect(await store.listForDate("local-user", "2026-08-07")).toEqual(expect.arrayContaining([
      expect.objectContaining({ locale: "zh-CN", mode: "short_essay", markdown: "# 随笔" }),
      expect.objectContaining({ locale: "en", mode: "post", markdown: "# Post" }),
    ]));
  });

  it("preserves the selected thought snapshot that a report was written from", async () => {
    const store = createLocalReportStore(":memory:");
    stores.push(store);
    const input = {
      date: "2026-08-09", locale: "zh-CN" as const, mode: "short_essay" as const,
      markdown: "一段仅基于选中材料的整理。", theme: "2026-08-09", narrative: "一段整理。", insights: [], sourceThoughtCount: 1,
      evidence: [{ thoughtId: "thought-1", capturedAt: "2026-08-09T01:00:00.000Z", transcript: "保留这一条。" }],
    };

    await store.save("local-user", input as Parameters<typeof store.save>[1]);

    const reloaded = await store.get("local-user", "2026-08-09", "zh-CN", "short_essay");
    expect(reloaded as { evidence?: unknown }).toMatchObject({ evidence: input.evidence });
  });

  it("deletes only the requested report owned by the current user", async () => {
    const store = createLocalReportStore(":memory:");
    stores.push(store);
    const base = { date: "2026-08-10", locale: "zh-CN" as const, mode: "post" as const, markdown: "一条推文。", theme: "2026-08-10", narrative: "一条推文。", insights: [], sourceThoughtCount: 1 };
    const removable = await store.save("local-user", base);
    const retained = await store.save("other-user", { ...base, mode: "short_essay", markdown: "另一份报告。" });

    await store.delete("local-user", removable.id);

    expect(await store.listForDate("local-user", "2026-08-10")).toEqual([]);
    expect(await store.listForDate("other-user", "2026-08-10")).toEqual([retained]);
  });
});
