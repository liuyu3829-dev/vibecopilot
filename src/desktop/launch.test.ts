import { describe, expect, it } from "vitest";

import { desktopLaunchUrl } from "./launch";

describe("desktop launch URL", () => {
  it("opens the registered desktop protocol without exposing API secrets", () => {
    expect(desktopLaunchUrl()).toBe("thoughtspace://open-orb");
  });
});