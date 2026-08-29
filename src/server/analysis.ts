import type { Thought } from "./thought-store";
import type { ReportMode } from "./report-store";

export type PostLengthPreference = "short" | "adaptive" | "long";

type MaterialDecision = { selectedThoughtIds: string[]; focus?: string; coreTheme?: string; chronology?: string; omittedThoughtIds?: string[] };

function isThoughtIdList(value: unknown, expected: Set<string>): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string" && expected.has(id)) && new Set(value).size === value.length;
}

function coversEveryThought(ids: unknown, expected: Set<string>) {
  return isThoughtIdList(ids, expected) && ids.length === expected.size;
}

function isMaterialDecision(value: Record<string, unknown>, thoughtIds: Set<string>, mode: ReportMode): value is MaterialDecision {
  const selectedThoughtIds = value.selectedThoughtIds;
  if (!isThoughtIdList(selectedThoughtIds, thoughtIds) || selectedThoughtIds.length === 0) return false;
  if (mode === "short_essay" && !coversEveryThought(selectedThoughtIds, thoughtIds)) return false;
  return ["focus", "coreTheme", "chronology"].every((key) => value[key] === undefined || typeof value[key] === "string")
    && (value.omittedThoughtIds === undefined || isThoughtIdList(value.omittedThoughtIds, thoughtIds));
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

export async function analyzeDailyReport(thoughts: Thought[], locale: "zh-CN" | "en", mode: ReportMode = "short_essay", _legacyLengthPreference: PostLengthPreference = "adaptive") {
  if (thoughts.length === 0) return null;
  if (mode === "post") throw new Error("LEGACY_REPORT_MODE");
  const language = locale === "zh-CN" ? "Simplified Chinese" : "English";
  const orderedThoughts = [...thoughts].sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));
  const sourceText = orderedThoughts.map((thought) => `- id:${thought.id} | ${thought.capturedAt}\n${thought.transcript}`).join("\n\n");
  const thoughtIds = new Set(orderedThoughts.map((thought) => thought.id));
  const shortMaterial = Array.from(orderedThoughts.map((thought) => thought.transcript).join("\n")).length <= 200;
  const materialInstructions = mode === "casual_post"
    ? "Casual post: choose one substantial line of thought. Keep its original voice; scattered material does not need to be forced together. Return {selectedThoughtIds:string[],focus:string}."
    : mode === "opinion_post"
      ? "Opinion post: choose one strongest theme and the source thoughts that support it. You may omit peripheral thoughts instead of inventing a connection. Return {selectedThoughtIds:string[],coreTheme:string,omittedThoughtIds:string[]}."
      : "Diary: include every supplied thought in its natural capture order. A diary may contain separate threads and pauses; do not force a central theme or causal relationship. Return {selectedThoughtIds:string[],chronology:string}.";
  const material = await deepSeekJson(`Return JSON only. Write in ${language}.
Make a material decision before writing prose. ${materialInstructions}
Use only supplied source thoughts. Do not invent events, emotions, people, relationships, actions, outcomes, causes, conclusions, or identity experiences. Do not write the report yet.
Source thoughts, in capture order:\n${sourceText}`);
  if (!isMaterialDecision(material, thoughtIds, mode)) throw new Error("DEEPSEEK_INVALID_RESPONSE");
  const sharedRules = `Use only the supplied thoughts and material decision. Do not invent events, emotions, people, relationships, facts, actions, outcomes, causal links, conclusions, or personal experience. Do not use a generic hook, slogan, teaching tone, AI self-reference, title, heading, numbered list, hashtag, call to action, repeated summary, formulaic ending, or question to the reader. Use natural short paragraphs, not an outline. End on a natural judgement or aftertaste without forcing a summary, reversal, or question. preview is one plain source-grounded sentence.`;
  const shortMaterialRule = shortMaterial ? "This is light organization: preserve the original meaning and recognisable short phrases, adding only needed links, gentle grammar repair, and natural line breaks; do not turn it into a long piece." : "Let material density determine the length. Distil long material instead of expanding every detail.";
  const style = mode === "casual_post"
    ? "Write a concise, relaxed chat-like casual post. Be direct and human, never padded. Use first person only when the source actually contains a personal position or experience. Lightly repair broken sentences and repetition while retaining the original tone."
    : mode === "opinion_post"
      ? "Write an opinion post around one strongest theme with only the small supporting points it needs. The judgement must be supported by the source, never presented as research, a universal law, or expert fact. You may omit peripheral thoughts; do not force them into the piece. Be clear without sounding like an expert article or social-media template."
      : "Write a private first-person diary that follows the day naturally. Multiple unrelated thoughts may remain separate. Do not impose a thesis, causal explanation, or emotion that the source does not contain.";
  const report = await deepSeekJson(`Return JSON only: {markdown:string,preview:string}. Write in ${language}.
${style}
${shortMaterialRule}
${sharedRules}
Material decision:\n${JSON.stringify(material)}
Source thoughts:\n${sourceText}`);
  if (typeof report.markdown !== "string" || typeof report.preview !== "string") throw new Error("DEEPSEEK_INVALID_RESPONSE");
  const markdown = report.markdown.trim();
  const preview = report.preview.trim();
  if (markdown.length < 2 || !preview) throw new Error("DEEPSEEK_INVALID_RESPONSE");
  return { markdown, preview };
}
