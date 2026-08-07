import { createLocalReportStore } from "@/server/report-store";
import { createSupabaseAdminClient } from "@/server/supabase";
import { requestIdentity } from "@/server/identity";
import { createLocalThoughtStore } from "@/server/thought-store";

export const runtime = "nodejs";
const localUrl = () => { const value = process.env.THOUGHT_SPACE_LOCAL_DB || ".thought-space.sqlite"; return value.startsWith("file:") ? value : `file:${value}`; };
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return Response.json({ error: { code: "NOT_AVAILABLE", message: "Local migration is available only during local setup." } }, { status: 404 });
  const identity = await requestIdentity(request); if (!identity || identity.mode !== "supabase") return Response.json({ error: { code: "UNAUTHENTICATED", message: "Please sign in before migration." } }, { status: 401 });
  const thoughts = createLocalThoughtStore(localUrl()); const reports = createLocalReportStore(localUrl());
  try {
    const [localThoughts, localReports] = await Promise.all([thoughts.list("local-user"), reports.list("local-user")]); const admin = createSupabaseAdminClient();
    if (localThoughts.length) { const result = await admin.from("thoughts").upsert(localThoughts.map((item) => ({ id:item.id, owner_id:identity.id, transcript:item.transcript, source:item.source, language:item.language, captured_at:item.capturedAt, updated_at:item.updatedAt, summary:item.summary, tags:item.tags, analysis_status:item.analysisStatus, deleted_at:item.deletedAt })), { onConflict:"id" }); if (result.error) throw new Error(result.error.message); }
    if (localReports.length) { const result = await admin.from("daily_reports").upsert(localReports.map((item) => ({ id:item.id, owner_id:identity.id, date:item.date, locale:item.locale, theme:item.theme, narrative:item.narrative, insights:item.insights, source_thought_count:item.sourceThoughtCount, generated_at:item.generatedAt })), { onConflict:"id" }); if (result.error) throw new Error(result.error.message); }
    return Response.json({ data: { thoughts: localThoughts.length, reports: localReports.length } });
  } catch { return Response.json({ error: { code:"MIGRATION_FAILED", message:"Unable to migrate local data. Your local database is unchanged." } }, { status:502 }); }
  finally { await thoughts.close(); await reports.close(); }
}