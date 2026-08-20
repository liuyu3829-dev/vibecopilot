import { analyzeDailyReport, type PostLengthPreference } from "@/server/analysis";
import { requestIdentity } from "@/server/identity";
import { reportStore, thoughtStore } from "@/server/store";
import { shanghaiDateKey } from "@/lib/thought-timeline";
import { selectReportThoughts } from "@/server/daily-report-input";
import type { ReportMode } from "@/server/report-store";

export const runtime = "nodejs";
function currentDate() { return shanghaiDateKey(new Date()); }
function isLocale(value: unknown): value is "zh-CN" | "en" { return value === "zh-CN" || value === "en"; }
function isMode(value: unknown): value is ReportMode { return value === "short_essay" || value === "post"; }
function isPostLengthPreference(value: unknown): value is PostLengthPreference { return value === "short" || value === "adaptive" || value === "long"; }
function isDate(value: unknown): value is string { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function unauthorized() { return Response.json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } }, { status: 401 }); }

export async function GET(request: Request) {
  const identity = await requestIdentity(request); if (!identity) return unauthorized();
  const params = new URL(request.url).searchParams;
  if (params.get("index") === "dates") {
    const reports = await reportStore.list(identity.id);
    return Response.json({ data: [...new Set(reports.map((report) => report.date))].sort() });
  }
  if (params.get("index") === "all") {
    return Response.json({ data: await reportStore.list(identity.id) });
  }
  const date = params.get("date") ?? currentDate();
  const locale = params.get("locale");
  if (!isDate(date)) return Response.json({ error: { code: "INVALID_DATE", message: "date must be YYYY-MM-DD" } }, { status: 400 });
  if (locale === null) return Response.json({ data: await reportStore.listForDate(identity.id, date) });
  if (!isLocale(locale)) return Response.json({ error: { code: "INVALID_LOCALE", message: "locale must be zh-CN or en" } }, { status: 400 });
  const mode = params.get("mode") ?? "short_essay";
  if (!isMode(mode)) return Response.json({ error: { code: "INVALID_MODE", message: "mode must be short_essay or post" } }, { status: 400 });
  return Response.json({ data: await reportStore.get(identity.id, date, locale, mode) });
}

export async function POST(request: Request) {
  const identity = await requestIdentity(request); if (!identity) return unauthorized();
  const { locale, date = currentDate(), mode = "short_essay", lengthPreference = "adaptive" } = await request.json().catch(() => ({})) as { locale?: unknown; date?: unknown; mode?: unknown; lengthPreference?: unknown };
  if (!isLocale(locale)) return Response.json({ error: { code: "INVALID_LOCALE", message: "locale must be zh-CN or en" } }, { status: 400 });
  if (!isMode(mode)) return Response.json({ error: { code: "INVALID_MODE", message: "mode must be short_essay or post" } }, { status: 400 });
  if (!isPostLengthPreference(lengthPreference)) return Response.json({ error: { code: "INVALID_POST_LENGTH", message: "lengthPreference must be short, adaptive, or long" } }, { status: 400 });
  if (!isDate(date)) return Response.json({ error: { code: "INVALID_DATE", message: "date must be YYYY-MM-DD" } }, { status: 400 });
  const thoughts = selectReportThoughts(await thoughtStore.list(identity.id), date);
  if (!thoughts.length) return Response.json({ error: { code: "NO_REPORT_THOUGHTS", message: "Select at least one thought for this daily report." } }, { status: 422 });
  try {
    const analysis = await analyzeDailyReport(thoughts, locale, mode, lengthPreference);
    if (!analysis) return Response.json({ error: { code: "NO_REPORT_THOUGHTS", message: "Select at least one thought for this daily report." } }, { status: 422 });
    const evidence = thoughts.map((thought) => ({ thoughtId: thought.id, capturedAt: thought.capturedAt, transcript: thought.transcript }));
    return Response.json({ data: await reportStore.save(identity.id, { date, locale, mode, markdown: analysis.markdown, theme: date, narrative: analysis.preview, insights: [], evidence, sourceThoughtCount: thoughts.length }) });
  } catch {
    return Response.json({ error: { code: "REPORT_GENERATION_FAILED", message: "Report generation failed. You can retry." } }, { status: 502 });
  }
}
