import { describe, expect, it, vi } from "vitest";

import { closeAudioContext, connectAudioGraph, disconnectAudioGraph, resumeAudioContext } from "./audio-session";

describe("audio session", () => {
  it("connects source and processor through the supplied audio context", () => {
    const processor = { connect: vi.fn() } as unknown as ScriptProcessorNode;
    const source = { connect: vi.fn() } as unknown as MediaStreamAudioSourceNode;
    const context = { createMediaStreamSource: vi.fn(() => source), createScriptProcessor: vi.fn(() => processor), destination: {} as AudioDestinationNode } as unknown as AudioContext;
    connectAudioGraph(context, {} as MediaStream, vi.fn());
    expect(source.connect).toHaveBeenCalledWith(processor);
    expect(processor.connect).toHaveBeenCalledWith(context.destination);
  });

  it("disconnects the processor, source, and callback when capture stops", () => {
    const processor = { disconnect: vi.fn(), onaudioprocess: vi.fn() } as unknown as ScriptProcessorNode;
    const source = { disconnect: vi.fn() } as unknown as MediaStreamAudioSourceNode;
    disconnectAudioGraph({ processor, source });
    expect(processor.onaudioprocess).toBeNull();
    expect(processor.disconnect).toHaveBeenCalledOnce();
    expect(source.disconnect).toHaveBeenCalledOnce();
  });

  it("does not close an audio context twice", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    await closeAudioContext({ state: "closed", close } as unknown as AudioContext);
    await closeAudioContext({ state: "running", close } as unknown as AudioContext);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("resumes a suspended audio context before capture begins", async () => {
    const resume = vi.fn().mockImplementation(async () => { context.state = "running"; });
    const context = { state: "suspended", resume } as unknown as AudioContext & { state: AudioContextState };

    await resumeAudioContext(context);

    expect(resume).toHaveBeenCalledOnce();
    expect(context.state).toBe("running");
  });

  it("rejects capture when the audio context stays suspended", async () => {
    const resume = vi.fn().mockResolvedValue(undefined);
    const context = { state: "suspended", resume } as unknown as AudioContext;

    await expect(resumeAudioContext(context)).rejects.toThrow("Audio context could not start.");
  });
});
