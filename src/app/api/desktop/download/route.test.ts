import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/desktop/download", () => {
  it("redirects to the configured public GitHub Release installer", async () => {
    vi.stubEnv(
      "DESKTOP_RELEASE_URL",
      "https://github.com/liuyu3829-dev/vibecopilot/releases/download/v0.1.0/Thought-Space-Orb-Setup.exe",
    );

    const response = await GET();

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://github.com/liuyu3829-dev/vibecopilot/releases/download/v0.1.0/Thought-Space-Orb-Setup.exe",
    );
  });

  it("rejects a missing or non-GitHub installer URL", async () => {
    vi.stubEnv("DESKTOP_RELEASE_URL", "https://example.com/Thought-Space-Orb-Setup.exe");

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "DESKTOP_DOWNLOAD_NOT_CONFIGURED",
        message: "Desktop installer download is not configured.",
      },
    });
  });
});
