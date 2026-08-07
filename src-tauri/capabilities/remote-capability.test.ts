import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop orb remote capability", () => {
  it("grants the local development orb page access to its native window APIs", () => {
    const capability = JSON.parse(readFileSync(resolve(process.cwd(), "src-tauri/capabilities/default.json"), "utf8"));

    expect(capability.remote.urls).toContain("http://127.0.0.1:3001/*");
  });
});
