import { requestIdentity } from "@/server/identity";
import { thoughtStore } from "@/server/store";

export const runtime = "nodejs";
const unauthorized = () => Response.json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } }, { status: 401 });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requestIdentity(request); if (!identity) return unauthorized();
  const { id } = await params; const body = await request.json().catch(() => null) as { transcript?: unknown; reportIncluded?: unknown; personalTags?: unknown } | null;
  if (!body) return Response.json({ error: { code: "INVALID_INPUT", message: "Thought updates are required." } }, { status: 400 });
  if (body.transcript !== undefined && (typeof body.transcript !== "string" || !body.transcript.trim())) return Response.json({ error: { code: "INVALID_TRANSCRIPT", message: "Thought text is required." } }, { status: 400 });
  if (body.reportIncluded !== undefined && typeof body.reportIncluded !== "boolean") return Response.json({ error: { code: "INVALID_INPUT", message: "reportIncluded must be a boolean." } }, { status: 400 });
  if (body.personalTags !== undefined && (!Array.isArray(body.personalTags) || body.personalTags.some((tag) => typeof tag !== "string"))) return Response.json({ error: { code: "INVALID_INPUT", message: "personalTags must be a list of strings." } }, { status: 400 });
  if (body.transcript === undefined && body.reportIncluded === undefined && body.personalTags === undefined) return Response.json({ error: { code: "INVALID_INPUT", message: "Thought updates are required." } }, { status: 400 });
  let thought = body.transcript === undefined ? (await thoughtStore.list(identity.id)).find((item) => item.id === id) ?? null : await thoughtStore.updateTranscript(identity.id, id, body.transcript.trim());
  if (thought && (body.reportIncluded !== undefined || body.personalTags !== undefined)) thought = await thoughtStore.updateOrganization(identity.id, id, { reportIncluded: body.reportIncluded as boolean | undefined, personalTags: body.personalTags as string[] | undefined });
  return thought ? Response.json({ data: thought }) : Response.json({ error: { code: "NOT_FOUND", message: "Thought not found." } }, { status: 404 });
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requestIdentity(request); if (!identity) return unauthorized();
  const { id } = await params; await thoughtStore.softDelete(identity.id, id); return Response.json({ data: { id } });
}
