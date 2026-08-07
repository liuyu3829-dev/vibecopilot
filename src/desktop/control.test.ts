import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { desktopControlUrl } from "./launch";

describe("desktop orb controls", () => {
  it("uses the registered protocol to show the already-running orb", () => {
    expect(desktopControlUrl("show")).toBe("thoughtspace://open-orb");
  });

  it("uses the registered protocol to hide the running orb without closing it", () => {
    expect(desktopControlUrl("hide")).toBe("thoughtspace://hide-orb");
  });

  it("keeps explicit show and hide controls in the dashboard", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");

    expect(page).toContain('controlDesktopPet("show")');
    expect(page).toContain('controlDesktopPet("hide")');
  });
});
