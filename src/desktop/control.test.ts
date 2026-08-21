import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop orb controls", () => {
  it("uses the loopback control bridge for an already-running orb", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");

    expect(page).toContain("requestLocalOrbControl");
    expect(page).toContain('controlDesktopPet("show")');
    expect(page).toContain('controlDesktopPet("hide")');
    expect(page).not.toContain('desktopControlUrl("hide")');
  });
});
