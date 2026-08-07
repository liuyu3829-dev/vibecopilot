import { requestIdentity } from "@/server/identity";
import { isThoughtSource } from "@/server/thought-metadata";
import { thoughtStore } from "@/server/store";

export const runtime = "nodejs";

const desktopCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, { ...init, headers: { ...desktopCors, ...init?.headers } });
}

function unauthorized() {
  return json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } }, { status: 401 });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: desktopCors });
}

export async function GET(request: Request) {
  const identity = await requestIdentity(request);
  return identity ? json({ data: await thoughtStore.list(identity.id) }) : unauthorized();
}

export async function POST(request: Request) {
  const identity = await requestIdentity(request);
  if (!identity) return unauthorized();
  const body = await request.json().catch(() => null) as { transcript?: unknown; language?: unknown; source?: unknown; userId?: unknown } | null;
  if (!body || typeof body.transcript !== "string" || !body.transcript.trim()) return json({ error: { code: "INVALID_TRANSCRIPT", message: "Thought text is required." } }, { status: 400 });
  if (body.userId !== undefined) return json({ error: { code: "USER_ID_FORBIDDEN", message: "userId is assigned by the server." } }, { status: 400 });
  if ((body.language !== "cn" && body.language !== "en") || !isThoughtSource(body.source)) return json({ error: { code: "INVALID_INPUT", message: "Invalid thought metadata." } }, { status: 400 });
  return json({ data: await thoughtStore.create(identity.id, { transcript: body.transcript.trim(), language: body.language, source: body.source }) }, { status: 201 });
}
