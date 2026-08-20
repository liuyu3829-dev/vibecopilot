import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

vi.mock("./auth-mode", () => ({ shouldRequireAuth: () => false }));

const thoughts = [
  { id: "thought-ai", transcript: "我想把 AI 用在写作流程里。", language: "cn", capturedAt: "2026-08-18T12:00:00.000Z", capturedDay: "2026-08-18", summary: "AI 写作", tags: [], personalTags: ["writing"], reportIncluded: true, analysisStatus: "complete" },
  { id: "thought-reading", transcript: "读书需要留下笔记。", language: "cn", capturedAt: "2026-08-17T12:00:00.000Z", capturedDay: "2026-08-17", summary: null, tags: [], personalTags: ["reading"], reportIncluded: true, analysisStatus: "complete" },
];
const reports = [{ id: "report-ai", date: "2026-08-18", locale: "zh-CN", mode: "post", generatedAt: "2026-08-18T13:00:00.000Z", theme: "", narrative: "关于 AI 写作的一段报告。", markdown: "关于 AI 写作的一段报告。", insights: [], evidence: [], sourceThoughtCount: 1 }];

describe("search and tags", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url === "/api/thoughts") return { ok: true, json: async () => ({ data: thoughts }) };
      if (url.includes("index=all")) return { ok: true, json: async () => ({ data: reports }) };
      if (url.includes("index=dates")) return { ok: true, json: async () => ({ data: [] }) };
      return { ok: true, json: async () => ({ data: [] }) };
    }));
  });

  it("searches historical thoughts and reports without navigating to Thoughts", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.change(await screen.findByRole("searchbox"), { target: { value: "ai" } });

    expect(await screen.findByText("我想把 AI 用在写作流程里。", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText("关于 AI 写作的一段报告。", { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Search" })).toHaveAttribute("aria-current", "page");
  });

  it("shows all historical matching thoughts inside Tags", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Tags" }));
    fireEvent.click((await screen.findAllByRole("button", { name: "reading" }))[0]);

    expect(await screen.findByText("读书需要留下笔记。", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tags" })).toHaveAttribute("aria-current", "page");
  });

  it("shows all tagged thoughts when the all-tags filter is active", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Tags" }));

    expect(await screen.findByText("我想把 AI 用在写作流程里。", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("读书需要留下笔记。", { exact: false })).toBeInTheDocument();
  });
});
