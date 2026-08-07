import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("temporary desktop development access", () => {
  it("keeps the API on the local identity while web login is disabled", () => {
    const source = readFileSync(resolve(process.cwd(), "src/server/identity.ts"), "utf8");
    expect(source).toContain("shouldRequireAuth");
    expect(source).toContain('return shouldRequireAuth() && process.env.THOUGHT_SPACE_MODE === "supabase";');
  });

  it("allows the Tauri shell origin to read speech and save thought endpoints", () => {
    const speech = readFileSync(resolve(process.cwd(), "src/app/api/speech/session/route.ts"), "utf8");
    const thoughts = readFileSync(resolve(process.cwd(), "src/app/api/thoughts/route.ts"), "utf8");
    expect(speech).toContain("Access-Control-Allow-Origin");
    expect(thoughts).toContain("Access-Control-Allow-Origin");
  });
});
