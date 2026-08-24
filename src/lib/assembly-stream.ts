export type AssemblyTurn = { type: "partial" | "final"; text: string; languageCode?: string } | { type: "ignored" };
export type TranscriptState = { confirmed: string; live: string };

type CaptureLanguage = "cn" | "en";

export function parseAssemblyMessageType(raw: string) {
  try {
    const payload = JSON.parse(raw) as { type?: unknown };
    return typeof payload.type === "string" ? payload.type : undefined;
  } catch {
    return undefined;
  }
}

export function parseAssemblyTurn(raw: string): AssemblyTurn {
  try {
    const payload = JSON.parse(raw) as { type?: string; transcript?: string; end_of_turn?: boolean; language_code?: string };
    if (payload.type !== "Turn" || !payload.transcript) return { type: "ignored" };
    return { type: payload.end_of_turn ? "final" : "partial", text: payload.transcript, languageCode: payload.language_code };
  } catch {
    return { type: "ignored" };
  }
}

export function isExpectedAssemblyTurn(turn: AssemblyTurn, expectedLanguage: CaptureLanguage) {
  if (turn.type === "ignored") return false;
  if (/\p{Script=Cyrillic}/u.test(turn.text)) return false;
  if (!turn.languageCode) return true;
  return expectedLanguage === "cn" ? turn.languageCode === "zh" : turn.languageCode === "en";
}

export function mergeAssemblyTranscript(state: TranscriptState, turn: AssemblyTurn, expectedLanguage: CaptureLanguage): TranscriptState {
  if (turn.type === "ignored") return state;
  if (!isExpectedAssemblyTurn(turn, expectedLanguage)) return turn.type === "final" ? { ...state, live: "" } : state;
  if (turn.type === "partial") return { confirmed: state.confirmed, live: removeCommittedOverlap(state.confirmed, turn.text) };

  const formatted = ensureSentencePunctuation(turn.text.trim(), expectedLanguage);
  if (!formatted || hasEquivalentEnding(state.confirmed, formatted)) return { confirmed: state.confirmed, live: "" };
  const separator = state.confirmed && expectedLanguage === "en" ? " " : "";
  return { confirmed: `${state.confirmed}${separator}${formatted}`, live: "" };
}

function ensureSentencePunctuation(text: string, language: CaptureLanguage) {
  if (!text || /[\u3002\uff01\uff1f!?\u2026]$/.test(text)) return text;
  if (language === "cn") return `${text}${/[\u5417\u5462\u5427]$/.test(text) ? "\uff1f" : "\u3002"}`;
  return `${text}.`;
}

function hasEquivalentEnding(confirmed: string, incoming: string) {
  const normalize = (value: string) => value.replace(/[\s,.!?\uFF0C\u3002\uFF01\uFF1F\u2026]/g, "");
  const known = normalize(confirmed);
  const next = normalize(incoming);
  return Boolean(next) && (known.endsWith(next) || next === known);
}

function removeCommittedOverlap(confirmed: string, incoming: string) {
  if (!confirmed || !incoming) return incoming;
  for (let length = Math.min(confirmed.length, incoming.length); length > 0; length -= 1) {
    if (confirmed.slice(-length) === incoming.slice(0, length)) return incoming.slice(length);
  }
  return incoming;
}

export function encodePcm16(input: Float32Array, inputSampleRate: number): ArrayBuffer {
  const ratio = inputSampleRate / 16000;
  const output = new Int16Array(Math.ceil(input.length / ratio));
  for (let index = 0; index < output.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[Math.floor(index * ratio)] ?? 0));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output.buffer;
}
