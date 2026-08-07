import { describe, expect, it } from "vitest";

import { bypassesAuthGate } from "./auth-route";

describe("auth callback routing", () => {
  it("lets the magic-link callback load before a session exists", () => {
    expect(bypassesAuthGate("/auth/callback")).toBe(true);
  });

  it("still protects the dashboard", () => {
    expect(bypassesAuthGate("/")).toBe(false);
  });

  it("lets the paired desktop orb load without the web login form", () => {
    expect(bypassesAuthGate("/desktop/orb")).toBe(true);
  });
});
