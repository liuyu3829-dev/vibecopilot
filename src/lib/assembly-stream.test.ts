import { describe, expect, it } from "vitest";

import { encodePcm16, isExpectedAssemblyTurn, mergeAssemblyTranscript, parseAssemblyMessageType, parseAssemblyTurn } from "./assembly-stream";

describe("AssemblyAI streaming messages", () => {
  it("recognizes handshake and server error message types without exposing their contents", () => {
    expect(parseAssemblyMessageType(JSON.stringify({ type: "Begin" }))).toBe("Begin");
    expect(parseAssemblyMessageType(JSON.stringify({ type: "Error", error: "private details" }))).toBe("Error");
    expect(parseAssemblyMessageType("not json")).toBeUndefined();
  });

  it("distinguishes partial and final Turn transcripts", () => {
    expect(parseAssemblyTurn(JSON.stringify({ type: "Turn", transcript: "hello", end_of_turn: false }))).toEqual({ type: "partial", text: "hello", languageCode: undefined });
    expect(parseAssemblyTurn(JSON.stringify({ type: "Turn", transcript: "hello world", end_of_turn: true, language_code: "en" }))).toEqual({ type: "final", text: "hello world", languageCode: "en" });
  });

  it("commits a formatted final Chinese turn once and clears the matching interim text", () => {
    const partial = parseAssemblyTurn(JSON.stringify({ type: "Turn", transcript: "\u4f60\u597d\u542c\u5f97\u5230\u6211\u8bf4\u8bdd\u5417", end_of_turn: false }));
    const finalTurn = parseAssemblyTurn(JSON.stringify({ type: "Turn", transcript: "\u4f60\u597d\uff0c\u542c\u5f97\u5230\u6211\u8bf4\u8bdd\u5417", end_of_turn: true, language_code: "zh" }));
    const interim = mergeAssemblyTranscript({ confirmed: "", live: "" }, partial, "cn");
    const committed = mergeAssemblyTranscript(interim, finalTurn, "cn");

    expect(interim).toEqual({ confirmed: "", live: "\u4f60\u597d\u542c\u5f97\u5230\u6211\u8bf4\u8bdd\u5417" });
    expect(committed).toEqual({ confirmed: "\u4f60\u597d\uff0c\u542c\u5f97\u5230\u6211\u8bf4\u8bdd\u5417\uff1f", live: "" });
    expect(mergeAssemblyTranscript(committed, finalTurn, "cn")).toEqual(committed);
  });

  it("accepts a completed turn when automatic language detection returns a regional language code", () => {
    const chineseTurn = parseAssemblyTurn(JSON.stringify({ type: "Turn", transcript: "你好", end_of_turn: true, language_code: "zh-CN" }));
    expect(isExpectedAssemblyTurn(chineseTurn, "cn")).toBe(true);
    expect(isExpectedAssemblyTurn(chineseTurn, "en")).toBe(true);
  });

  it("accepts interim text while language detection is pending", () => {
    const interim = parseAssemblyTurn(JSON.stringify({ type: "Turn", transcript: "\u041f\u0440\u0438\u0432\u0435\u0442", end_of_turn: false }));
    expect(isExpectedAssemblyTurn(interim, "cn")).toBe(true);
  });

  it("encodes microphone samples as PCM bytes", () => {
    const pcm = encodePcm16(new Float32Array([-1, 0, 1]), 16000);
    expect(Array.from(new Int16Array(pcm))).toEqual([-32768, 0, 32767]);
  });
});
