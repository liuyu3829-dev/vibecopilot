import { beforeEach, describe, expect, it, vi } from "vitest";

const { list, listForDate } = vi.hoisted(() => ({ list: vi.fn(), listForDate: vi.fn() }));

vi.mock("@/server/identity", () => ({ requestIdentity: vi.fn(async () => ({ id: "owner-a" })) }));
vi.mock("@/server/store", () => ({
  reportStore: { list, listForDate },
  thoughtStore: { list: vi.fn() },
}));
vi.mock("@/server/analysis", () => ({ analyzeDailyReport: vi.fn() }));
vi.mock("@/server/daily-report-input", () => ({ selectReportThoughts: vi.fn() }));

import { GET } from "./route";

describe("daily report search index", () => {
  beforeEach(() => {
    list.mockReset();
    listForDate.mockReset();
  });

  it("returns every report owned by the current user for search", async () => {
    const reports = [{ id: "report-a", date: "2026-08-18", markdown: "AI notes" }];
    list.mockResolvedValue(reports);

    const response = await GET(new Request("http://localhost/api/reports/daily?index=all"));

    expect(await response.json()).toEqual({ data: reports });
    expect(list).toHaveBeenCalledWith("owner-a");
    expect(listForDate).not.toHaveBeenCalled();
  });
});
