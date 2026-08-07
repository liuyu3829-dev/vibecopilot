import { describe, expect, it } from "vitest";

import { isThoughtSource } from "./thought-metadata";

describe("thought metadata", () => {
  it("accepts desktop_orb as a first-class capture source", () => {
    expect(isThoughtSource("desktop_orb")).toBe(true);
    expect(isThoughtSource("desktop")).toBe(false);
  });
});