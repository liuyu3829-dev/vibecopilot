import { describe, expect, it, vi } from "vitest";

import { createAssemblySpeechSession } from "./speech-session";

describe("AssemblyAI speech session", () => {
  it("mints a temporary token server-side and returns a browser-safe streaming URL", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "temporary-token", expires_in_seconds: 60 })));
    const session = await createAssemblySpeechSession("private-api-key", request);

    expect(String(request.mock.calls[0]?.[0])).toContain("https://streaming.assemblyai.com/v3/token?");
    expect(request.mock.calls[0]?.[1]).toEqual({ headers: { Authorization: "private-api-key" } });
    expect(session.url).toContain("wss://streaming.assemblyai.com/v3/ws?");
    expect(session.url).toContain("speech_model=whisper-rt");
    expect(session.url).toContain("sample_rate=16000");
    expect(session.url).toContain("language_detection=true");
    expect(session.url).toContain("format_turns=true");
    expect(session.url).toContain("token=temporary-token");
    expect(session.expiresInSeconds).toBe(60);
  });
});