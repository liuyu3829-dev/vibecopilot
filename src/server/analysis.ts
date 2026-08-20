import type { Thought } from "./thought-store";
import type { ReportMode } from "./report-store";

export type PostLengthPreference = "short" | "adaptive" | "long";

function coversEveryThought(ids: unknown, expected: Set<string>) {
  return Array.isArray(ids) && ids.length === expected.size && ids.every((id) => typeof id === "string" && expected.has(id)) && new Set(ids).size === expected.size;
}

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
  const analysis = await deepSeekJson(`Return JSON only: {summary:string}. Write in ${thought.language === "cn" ? "Simplified Chinese" : "English"}. Analyze this raw thought without rewriting it: ${thought.transcript}`);
  if (typeof analysis.summary !== "string") throw new Error("DEEPSEEK_INVALID_RESPONSE");
  return { summary: analysis.summary.trim(), tags: [] };
}

export async function analyzeDailyReport(thoughts: Thought[], locale: "zh-CN" | "en", mode: ReportMode = "short_essay", lengthPreference: PostLengthPreference = "adaptive") {
  if (thoughts.length === 0) return null;
  const language = locale === "zh-CN" ? "Simplified Chinese" : "English";
  const orderedThoughts = [...thoughts].sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));
  const sourceText = orderedThoughts.map((thought) => `- id:${thought.id} | ${thought.capturedAt}\n${thought.transcript}`).join("\n\n");
  const outline = await deepSeekJson(`Return JSON only: {claim:string,points:Array<{point:string,thoughtIds:string[]}>,reservation:string}. Write in ${language}.
Build an evidence outline before any prose. Use only the supplied source thoughts. claim is a specific central judgement, not a slogan. Each point must name a concrete line of reasoning and cite one or more thoughtIds from the source. reservation records the important uncertainty or limitation. Do not invent events, emotions, people, actions, outcomes, or causal links. Do not write the daily report yet.
Source thoughts, in capture order:\n${sourceText}`);
  const thoughtIds = new Set(orderedThoughts.map((thought) => thought.id));
  const citedThoughtIds = Array.isArray(outline.points) ? outline.points.flatMap((point) => typeof point === "object" && point !== null ? (point as Record<string, unknown>).thoughtIds as unknown[] ?? [] : []) : [];
  if (typeof outline.claim !== "string" || !Array.isArray(outline.points) || !outline.points.every((point) => typeof point === "object" && point !== null && typeof (point as Record<string, unknown>).point === "string" && Array.isArray((point as Record<string, unknown>).thoughtIds) && ((point as Record<string, unknown>).thoughtIds as unknown[]).every((id) => typeof id === "string" && thoughtIds.has(id))) || !coversEveryThought([...new Set(citedThoughtIds)], thoughtIds)) throw new Error("DEEPSEEK_INVALID_RESPONSE");
  const postLength = lengthPreference === "short"
    ? "Use the short preference: usually 180–380 Chinese characters, while growing only when needed to cover every distinct selected point."
    : lengthPreference === "long"
      ? "Use the long preference: usually 600–1,400 Chinese characters, with room for concrete turns in the reasoning but without becoming a meeting log."
      : "Use the adaptive preference: let the number, density, and distinctness of selected thoughts determine the length; a few simple thoughts stay short, while several substantial thoughts receive enough room to be understood.";
  const style = mode === "post"
    ? `Write a single first-person post from the evidence outline and supplied thoughts. ${postLength} Every selected thought has a distinct core point: absorb every one of them, combining related points naturally instead of listing or quoting thoughts in capture order. Do not omit a distinct point merely to keep the post short. Do not use Markdown, a title, hashtags, a call to action, a generic hook, a lesson, therapy language, slogans, or polished conclusions. Do not invent events, emotions, facts, people, actions, outcomes, or connections.`
    : "Write an Opinion short essay from the evidence outline and the supplied thoughts. Make a clear but modest judgement, then develop only the two or three source-grounded reasons needed to support it. Use one to three light Markdown level-two headings only when they clarify a real turn in the argument. Do not add a Markdown title. Do not narrate every source thought in order, repeat long phrases, manufacture balance, or turn the note into a diary, a lesson, or therapy language. Do not invent events, emotions, facts, people, actions, outcomes, or connections. Avoid slogans, generic motivation, AI self-reference, and polished conclusions. Preserve uncertainty when the outline does not resolve it. With little material, keep the result short.";
  const report = await deepSeekJson(`Return JSON only: {markdown:string,preview:string${mode === "post" ? ",coveredThoughtIds:string[]" : ""}}. Write in ${language}.
${style} preview is one plain, source-grounded sentence.
Evidence outline:\n${JSON.stringify(outline)}
Source thoughts:\n${sourceText}`);
  if (typeof report.markdown !== "string" || typeof report.preview !== "string") throw new Error("DEEPSEEK_INVALID_RESPONSE");
  const markdown = report.markdown.trim();
  const preview = report.preview.trim();
  if (markdown.length < 2 || !preview || (mode === "post" && (markdown.includes("#") || !coversEveryThought(report.coveredThoughtIds, thoughtIds)))) throw new Error("DEEPSEEK_INVALID_RESPONSE");
  return { markdown, preview };
}
