import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("local desktop server", () => {
  it("uses the normal Next server for local development", () => {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };

    expect(packageJson.scripts.start).toBe("next start --hostname 127.0.0.1 --port 3001");
  });

  it("does not retain the obsolete standalone build mode", () => {
    const config = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

    expect(config).not.toContain('output: "standalone"');
  });
});