import { describe, expect, it } from "vitest";

import { createBetaAccessCookie, hasBetaAccess, isAllowedInviteCode } from "./desktop-beta";

describe("desktop beta access", () => {
  it("accepts only an exact configured invite code", () => {
    expect(isAllowedInviteCode("orb-test", "alpha,orb-test,beta")).toBe(true);
    expect(isAllowedInviteCode("orb", "alpha,orb-test,beta")).toBe(false);
  });

  it("signs an expiring browser-only beta access cookie", () => {
    const cookie = createBetaAccessCookie("secret", 1_000, 60_000);

    expect(hasBetaAccess(cookie, "secret", 60_999)).toBe(true);
    expect(hasBetaAccess(cookie, "secret", 61_001)).toBe(false);
    expect(hasBetaAccess(cookie, "another-secret", 60_999)).toBe(false);
  });
});