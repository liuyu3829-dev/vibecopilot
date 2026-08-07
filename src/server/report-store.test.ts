import { afterEach, describe, expect, it } from "vitest";

import { createLocalReportStore } from "./report-store";

describe("local report store", () => {
  const stores: Array<{ close(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(stores.splice(0).map((store) => store.close()));
  });

  it("keeps one current daily report for a date and locale", async () => {
    const store = createLocalReportStore(":memory:");
    stores.push(store);

    await store.save("local-user", {
      date: "2026-08-04",
      locale: "en",
      theme: "Build with purpose",
      narrative: "A reflective day.",
      insights: ["Keep shipping."],
      sourceThoughtCount: 2,
    });
    const replacement = await store.save("local-user", {
      date: "2026-08-04",
      locale: "en",
      theme: "Clarity drives execution",
      narrative: "A clearer day.",
      insights: ["Choose the next action."],
      sourceThoughtCount: 3,
    });

    expect(await store.get("local-user", "2026-08-04", "en")).toEqual(replacement);
  });
});
