import { describe, expect, it } from "vitest";

import { shouldRequireAuth } from "./auth-mode";

describe("temporary development authentication mode", () => {
  it("keeps the dashboard usable while email login is being repaired", () => {
    expect(shouldRequireAuth()).toBe(false);
  });
});
