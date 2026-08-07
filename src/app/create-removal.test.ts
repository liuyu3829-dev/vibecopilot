import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("creative workspace removal", () => {
  it("does not expose the removed creative workspace", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");
    expect(page).not.toContain('href="/create"');
    expect(existsSync(resolve(process.cwd(), "src/app/create/page.tsx"))).toBe(false);
  });
});