export type AudioGraph = { source: MediaStreamAudioSourceNode; processor: AudioWorkletNode };

export async function closeAudioContext(context: AudioContext | null) {
  if (context && context.state !== "closed") await context.close();
}

export async function resumeAudioContext(context: AudioContext) {
  if (context.state !== "running") await context.resume();
  if (context.state !== "running") throw new Error("Audio context could not start.");
}

export async function connectAudioGraph(context: AudioContext, stream: MediaStream, onSamples: (samples: Float32Array, sampleRate: number) => void): Promise<AudioGraph> {
  await context.audioWorklet.addModule("/orb-shell/audio-capture-worklet.js");
  const source = context.createMediaStreamSource(stream);
  const processor = new AudioWorkletNode(context, "pcm-capture");
  processor.port.onmessage = (event: MessageEvent<ArrayBuffer>) => onSamples(new Float32Array(event.data), context.sampleRate);
  source.connect(processor);
  processor.connect(context.destination);
  return { source, processor };
}

export function disconnectAudioGraph(graph: AudioGraph | null) {
  if (!graph) return;
  graph.processor.port.onmessage = null;
  graph.processor.disconnect();
  graph.source.disconnect();
}
