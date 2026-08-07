import type { DailyReport } from "./report-store";
import type { Thought } from "./thought-store";

async function deepSeekJson(prompt: string) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_NOT_CONFIGURED");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "deepseek-chat", response_format: { type: "json_object" }, messages: [{ role: "system", content: prompt }] }),
  });
  if (!response.ok) throw new Error("DEEPSEEK_REQUEST_FAILED");
  const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("DEEPSEEK_INVALID_RESPONSE");
  return JSON.parse(content) as Record<string, unknown>;
}

export async function analyzeThought(thought: Thought) {
  const analysis = await deepSeekJson(`Return JSON only: {summary:string,tags:string[]}; tags has 1-4 short strings. Write in ${thought.language === "cn" ? "Simplified Chinese" : "English"}. Analyze this raw thought without rewriting it: ${thought.transcript}`);
  if (typeof analysis.summary !== "string" || !Array.isArray(analysis.tags)) throw new Error("DEEPSEEK_INVALID_RESPONSE");
  return { summary: analysis.summary.trim(), tags: analysis.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 4) };
}

export async function analyzeDailyReport(thoughts: Thought[], locale: DailyReport["locale"]) {
  if (thoughts.length === 0) return null;
  const language = locale === "zh-CN" ? "Simplified Chinese" : "English";
  const prompt = `Return JSON only: {theme:string,narrative:string,insights:string[]}. Write in ${language}. Create a concise, reflective daily thought report. Do not invent facts or repeat long quotes. Thoughts:\n${thoughts.map((thought) => `- ${thought.transcript}`).join("\n")}`;
  const report = await deepSeekJson(prompt);
  if (typeof report.theme !== "string" || typeof report.narrative !== "string" || !Array.isArray(report.insights)) throw new Error("DEEPSEEK_INVALID_RESPONSE");
  return { theme: report.theme.trim(), narrative: report.narrative.trim(), insights: report.insights.filter((item): item is string => typeof item === "string").slice(0, 3) };
}
