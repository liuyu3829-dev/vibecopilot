import { describe, expect, it } from "vitest";

import { OPTIONS } from "./route";

describe("desktop pairing exchange CORS", () => {
  it("accepts the preflight required by the native desktop webview", () => {
    const response = OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
  });
});
