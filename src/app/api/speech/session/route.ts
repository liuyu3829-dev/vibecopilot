import { createAssemblySpeechSession } from "@/server/speech-session";

export const runtime = "nodejs";

const desktopCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
};

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { ...desktopCors, ...init?.headers } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: desktopCors });
}

export async function GET(request: Request) {
  const language = new URL(request.url).searchParams.get("language");
  if (language !== "cn" && language !== "en") return json({ error: { code: "INVALID_LANGUAGE", message: "language must be cn or en" } }, { status: 400 });
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) return json({ error: { code: "SPEECH_NOT_CONFIGURED", message: "AssemblyAI transcription is not configured." } }, { status: 503 });
  try {
    const session = await createAssemblySpeechSession(apiKey);
    return json({ data: { url: session.url, language } });
  } catch {
    return json({ error: { code: "SPEECH_SESSION_UNAVAILABLE", message: "Unable to start an AssemblyAI transcription session." } }, { status: 502 });
  }
}
