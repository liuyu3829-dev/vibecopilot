export async function createAssemblySpeechSession(apiKey: string, request: typeof fetch = fetch) {
  const tokenUrl = new URL("https://streaming.assemblyai.com/v3/token");
  tokenUrl.searchParams.set("expires_in_seconds", "60");
  tokenUrl.searchParams.set("max_session_duration_seconds", "600");

  const response = await request(tokenUrl, { headers: { Authorization: apiKey } });
  if (!response.ok) throw new Error("AssemblyAI could not create a streaming session.");
  const payload = await response.json() as { token?: string; expires_in_seconds?: number };
  if (!payload.token) throw new Error("AssemblyAI did not return a streaming token.");

  const websocketUrl = new URL("wss://streaming.assemblyai.com/v3/ws");
  websocketUrl.searchParams.set("sample_rate", "16000");
  websocketUrl.searchParams.set("speech_model", "whisper-rt");
  websocketUrl.searchParams.set("language_detection", "true");
  websocketUrl.searchParams.set("format_turns", "true");
  websocketUrl.searchParams.set("token", payload.token);
  return { url: websocketUrl.toString(), expiresInSeconds: payload.expires_in_seconds ?? 60 };
}