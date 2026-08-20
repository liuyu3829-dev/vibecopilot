import { requestIdentity } from "@/server/identity";
import { reportStore } from "@/server/store";

export const runtime = "nodejs";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requestIdentity(request);
  if (!identity) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } }, { status: 401 });
  const { id } = await params;
  await reportStore.delete(identity.id, id);
  return Response.json({ data: { id } });
}
