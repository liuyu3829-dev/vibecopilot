import { afterEach, describe, expect, it, vi } from "vitest";

import { closeAudioContext, connectAudioGraph, disconnectAudioGraph, resumeAudioContext } from "./audio-session";

describe("audio session", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("connects source and AudioWorklet through the supplied audio context", async () => {
    const processor = { connect: vi.fn(), port: {} } as unknown as AudioWorkletNode;
    const source = { connect: vi.fn() } as unknown as MediaStreamAudioSourceNode;
    const addModule = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("AudioWorkletNode", class { constructor() { return processor; } });
    const context = { audioWorklet: { addModule }, createMediaStreamSource: vi.fn(() => source), destination: {} as AudioDestinationNode } as unknown as AudioContext;
    await connectAudioGraph(context, {} as MediaStream, vi.fn());
    expect(addModule).toHaveBeenCalledWith("/orb-shell/audio-capture-worklet.js");
    expect(source.connect).toHaveBeenCalledWith(processor);
    expect(processor.connect).toHaveBeenCalledWith(context.destination);
  });

  it("disconnects the worklet, source, and callback when capture stops", () => {
    const processor = { disconnect: vi.fn(), port: { onmessage: vi.fn() } } as unknown as AudioWorkletNode;
    const source = { disconnect: vi.fn() } as unknown as MediaStreamAudioSourceNode;
    disconnectAudioGraph({ processor, source });
    expect(processor.port.onmessage).toBeNull();
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
