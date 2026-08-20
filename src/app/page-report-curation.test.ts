import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("report source curation", () => {
  it("keeps report selection in the Reports view rather than thought cards", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    const reportView = page.slice(page.indexOf('section === "reports"'), page.indexOf(': section === "tags"'));
    const thoughtView = page.slice(page.indexOf('section !== "thoughts"'), page.indexOf('{captureOpen'));

    expect(reportView).toContain("report-workspace");
    expect(reportView).toContain("report-sidebar");
    expect(reportView).toContain("report-reading");
    expect(reportView).toContain("reportMode");
    expect(reportView).toContain("postLength");
    expect(reportView).toContain("expandedReportId");
    expect(reportView).toContain("setReportPendingDelete(item)");
    expect(page).toContain("confirmDeleteReport");
    expect(reportView).toContain("短论文");
    expect(reportView).toContain("推文");
    expect(reportView).toContain("自适应");
    expect(reportView).toContain("report-source-list");
    expect(reportView).toContain("checked={thought.reportIncluded}");
    expect(reportView).toContain('<details className="report-source-list">');
    expect(reportView).toContain("<summary>");
    expect(readFileSync(resolve(process.cwd(), "src/app/styles.css"), "utf8")).toContain(".report-collapse p { display: none; }");
    expect(reportView).not.toContain("Expand to choose thoughts");
    expect(thoughtView).not.toContain("report-include");
    expect(thoughtView).not.toContain("#{tag}");
  });
});
