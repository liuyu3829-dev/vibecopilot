import { describe, expect, it } from "vitest";

import { desktopHideUrl, desktopLaunchUrl } from "./launch";

describe("desktop launch URL", () => {
  it("opens the registered desktop protocol without exposing API secrets", () => {
    expect(desktopLaunchUrl()).toBe("thoughtspace://open-orb");
  });

  it("uses the registered desktop protocol to hide a running orb", () => {
    expect(desktopHideUrl("control-token")).toBe("thoughtspace://hide-orb?control=control-token");
  });
});
