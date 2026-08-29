import { beforeEach, describe, expect, it, vi } from "vitest";

const { list, listForDate, get, thoughtList, selectReportThoughts, analyzeDailyReport, save } = vi.hoisted(() => ({ list: vi.fn(), listForDate: vi.fn(), get: vi.fn(), thoughtList: vi.fn(), selectReportThoughts: vi.fn(), analyzeDailyReport: vi.fn(), save: vi.fn() }));

vi.mock("@/server/identity", () => ({ requestIdentity: vi.fn(async () => ({ id: "owner-a" })) }));
vi.mock("@/server/store", () => ({
  reportStore: { list, listForDate, get, save },
  thoughtStore: { list: thoughtList },
}));
vi.mock("@/server/analysis", () => ({ analyzeDailyReport }));
vi.mock("@/server/daily-report-input", () => ({ selectReportThoughts }));

import { GET, POST } from "./route";

describe("daily report search index", () => {
  beforeEach(() => {
    list.mockReset();
    listForDate.mockReset();
    get.mockReset();
    thoughtList.mockReset();
    selectReportThoughts.mockReset();
    analyzeDailyReport.mockReset();
    save.mockReset();
  });

  it("returns every report owned by the current user for search", async () => {
    const reports = [{ id: "report-a", date: "2026-08-18", markdown: "AI notes" }];
    list.mockResolvedValue(reports);

    const response = await GET(new Request("http://localhost/api/reports/daily?index=all"));

    expect(await response.json()).toEqual({ data: reports });
    expect(list).toHaveBeenCalledWith("owner-a");
    expect(listForDate).not.toHaveBeenCalled();
  });

  it("creates a casual post without a client length preference", async () => {
    const thoughts = [{ id: "thought-a", transcript: "A raw thought." }];
    thoughtList.mockResolvedValue(thoughts);
    selectReportThoughts.mockReturnValue(thoughts);
    analyzeDailyReport.mockResolvedValue({ markdown: "A concise note.", preview: "A concise note." });
    save.mockResolvedValue({ id: "report-a", mode: "casual_post" });

    const response = await POST(new Request("http://localhost/api/reports/daily", {
      method: "POST",
      body: JSON.stringify({ date: "2026-08-18", locale: "en", mode: "casual_post" }),
    }));

    expect(response.status).toBe(200);
    expect(analyzeDailyReport).toHaveBeenCalledWith(thoughts, "en", "casual_post", "adaptive");
    expect(save).toHaveBeenCalledWith("owner-a", expect.objectContaining({ mode: "casual_post", markdown: "A concise note." }));
  });

  it("keeps the old post mode readable but rejects generating another one", async () => {
    get.mockResolvedValue({ id: "legacy", mode: "post" });

    const readResponse = await GET(new Request("http://localhost/api/reports/daily?date=2026-08-18&locale=en&mode=post"));
    const writeResponse = await POST(new Request("http://localhost/api/reports/daily", {
      method: "POST",
      body: JSON.stringify({ date: "2026-08-18", locale: "en", mode: "post" }),
    }));

    expect(readResponse.status).toBe(200);
    expect(await readResponse.json()).toEqual({ data: { id: "legacy", mode: "post" } });
    expect(writeResponse.status).toBe(400);
    expect(analyzeDailyReport).not.toHaveBeenCalled();
  });
});
