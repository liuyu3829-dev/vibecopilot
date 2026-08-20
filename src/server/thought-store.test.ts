import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("assigns new thoughts to the Shanghai calendar day and keeps report selection separate from personal tags", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-08T16:30:00.000Z"));
    const store = createLocalThoughtStore(":memory:");
    stores.push(store);

    const thought = await store.create("local-user", {
      transcript: "A late-night thought.",
      language: "en",
      source: "manual",
    });

    expect(thought as { capturedDay?: string; reportIncluded?: boolean; personalTags?: string[] }).toMatchObject({
      capturedDay: "2026-08-09",
      reportIncluded: true,
      personalTags: [],
    });

    const organized = await (store as unknown as {
      updateOrganization(ownerId: string, id: string, input: { reportIncluded?: boolean; personalTags?: string[] }): Promise<unknown>;
    }).updateOrganization("local-user", thought.id, { reportIncluded: false, personalTags: ["#writing", "ideas"] });

    expect(organized).toMatchObject({ reportIncluded: false, personalTags: ["writing", "ideas"] });
    vi.useRealTimers();
  });
});
