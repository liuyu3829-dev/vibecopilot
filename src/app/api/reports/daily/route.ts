import { analyzeDailyReport } from "@/server/analysis";
import { requestIdentity } from "@/server/identity";
import { reportStore, thoughtStore } from "@/server/store";

export const runtime = "nodejs";
function currentDate() { return new Date().toLocaleDateString("en-CA"); }
function isLocale(value: unknown): value is "zh-CN" | "en" { return value === "zh-CN" || value === "en"; }
function unauthorized() { return Response.json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } }, { status: 401 }); }

export async function GET(request: Request) {
  const identity = await requestIdentity(request); if (!identity) return unauthorized();
  const locale = new URL(request.url).searchParams.get("locale");
  if (!isLocale(locale)) return Response.json({ error: { code: "INVALID_LOCALE", message: "locale must be zh-CN or en" } }, { status: 400 });
  return Response.json({ data: await reportStore.get(identity.id, currentDate(), locale) });
}
export async function POST(request: Request) {
  const identity = await requestIdentity(request); if (!identity) return unauthorized();
  const { locale } = await request.json().catch(() => ({})) as { locale?: unknown };
  if (!isLocale(locale)) return Response.json({ error: { code: "INVALID_LOCALE", message: "locale must be zh-CN or en" } }, { status: 400 });
  const today = currentDate(); const thoughts = (await thoughtStore.list(identity.id)).filter((thought) => thought.capturedAt.startsWith(today));
  if (!thoughts.length) return Response.json({ error: { code: "NO_THOUGHTS", message: "No thoughts captured today." } }, { status: 422 });
  try { const analysis = await analyzeDailyReport(thoughts, locale); if (!analysis) return Response.json({ error: { code: "NO_THOUGHTS", message: "No thoughts captured today." } }, { status: 422 }); return Response.json({ data: await reportStore.save(identity.id, { date: today, locale, ...analysis, sourceThoughtCount: thoughts.length }) }); }
  catch { return Response.json({ error: { code: "REPORT_GENERATION_FAILED", message: "Report generation failed. You can retry." } }, { status: 502 }); }
}