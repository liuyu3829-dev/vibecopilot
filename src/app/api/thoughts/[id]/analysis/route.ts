import { analyzeThought } from "@/server/analysis";
import { requestIdentity } from "@/server/identity";
import { thoughtStore } from "@/server/store";

export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const identity = await requestIdentity(request); if (!identity) return Response.json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } }, { status: 401 });
  const { id } = await params; const thought = (await thoughtStore.list(identity.id)).find((item) => item.id === id);
  if (!thought) return Response.json({ error: { code: "NOT_FOUND", message: "Thought not found." } }, { status: 404 });
  try { const analysis = await analyzeThought(thought); return Response.json({ data: await thoughtStore.updateAnalysis(identity.id, id, { ...analysis, status: "complete" }) }); }
  catch { await thoughtStore.updateAnalysis(identity.id, id, { summary: null, tags: [], status: "failed" }); return Response.json({ error: { code: "ANALYSIS_FAILED", message: "Analysis failed. You can retry." } }, { status: 502 }); }
}