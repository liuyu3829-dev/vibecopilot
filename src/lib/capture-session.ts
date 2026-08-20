import type { TranscriptState } from "./assembly-stream";

export type CaptureSession = { run: number; transcript: TranscriptState };

export function replaceTranscriptAfterManualEdit(session: CaptureSession, value: string): CaptureSession {
  return { run: session.run + 1, transcript: { confirmed: value, live: "" } };
}

export function shouldAcceptCaptureMessage(currentRun: number, messageRun: number) {
  return currentRun === messageRun;
}
