import { afterEach, describe, expect, it } from "vitest";

import { createLocalThoughtStore } from "./thought-store";

describe("local thought store", () => {
  const stores: Array<{ close(): Promise<void> }> = [];

  afterEach(async () => {
    await Promise.all(stores.splice(0).map((store) => store.close()));
  });

  it("persists a thought and excludes a soft-deleted thought from the timeline", async () => {
    const store = createLocalThoughtStore(":memory:");
    stores.push(store);

    const thought = await store.create("local-user", {
      transcript: "Build the transcription loop first.",
      language: "en",
      source: "manual",
    });

    expect(await store.list("local-user")).toEqual([thought]);

    await store.softDelete("local-user", thought.id);

    expect(await store.list("local-user")).toEqual([]);
  });
});
