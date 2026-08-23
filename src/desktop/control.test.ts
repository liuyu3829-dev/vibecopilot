import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop orb controls", () => {
  it("always creates a fresh pairing before showing the desktop orb", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");

    expect(page).toContain('fetch("/api/desktop/pair", { method: "POST" })');
    expect(page).toContain('controlDesktopPet("show")');
    expect(page).toContain("desktopLaunchUrl(ticket, controlSecret)");
    expect(page).not.toContain("requestLocalOrbControl");
  });

  it("hides through the registered protocol instead of a browser loopback request", () => {
    const page = readFileSync(resolve(process.cwd(), "src/app/page.tsx"), "utf8");

    expect(page).toContain("desktopHideUrl(controlSecret)");
    expect(page).not.toContain("127.0.0.1:17894");
  });
});
