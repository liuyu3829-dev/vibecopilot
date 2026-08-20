import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop API origin", () => {
  it("uses port 3001 consistently for development, production, and the desktop orb", () => {
    const packageJson = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
    const nativeShell = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");

    expect(packageJson).toContain('"dev": "next dev --port 3001"');
    expect(packageJson).toContain('"start": "next start --hostname 127.0.0.1 --port 3001"');
    expect(nativeShell).toContain('unwrap_or("http://127.0.0.1:3001")');
  });
});
