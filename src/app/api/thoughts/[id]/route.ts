import { requestIdentity } from "@/server/identity";
import { thoughtStore } from "@/server/store";

export const runtime = "nodejs";
const unauthorized = () => Response.json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } }, { status: 401 });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requestIdentity(request); if (!identity) return unauthorized();
  const { id } = await params; const body = await request.json().catch(() => null) as { transcript?: unknown } | null;
  if (!body || typeof body.transcript !== "string" || !body.transcript.trim()) return Response.json({ error: { code: "INVALID_TRANSCRIPT", message: "Thought text is required." } }, { status: 400 });
  const thought = await thoughtStore.updateTranscript(identity.id, id, body.transcript.trim());
  return thought ? Response.json({ data: thought }) : Response.json({ error: { code: "NOT_FOUND", message: "Thought not found." } }, { status: 404 });
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requestIdentity(request); if (!identity) return unauthorized();
  const { id } = await params; await thoughtStore.softDelete(identity.id, id); return Response.json({ data: { id } });
}