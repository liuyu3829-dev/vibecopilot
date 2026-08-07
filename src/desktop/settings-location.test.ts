import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop orb settings location", () => {
  it("keeps orb controls out of the home header and inside Settings", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(page).toContain('section === t.settings ? <section className="desktop-settings"');
    expect(page).toContain('aria-label="Desktop orb invite code"');
    expect(page).not.toContain('<span className="desktop-orb-controls" aria-label');
  });
});