export type AudioGraph = { source: MediaStreamAudioSourceNode; processor: ScriptProcessorNode };

export async function closeAudioContext(context: AudioContext | null) {
  if (context && context.state !== "closed") await context.close();
}

export function connectAudioGraph(context: AudioContext, stream: MediaStream, onSamples: (samples: Float32Array, sampleRate: number) => void): AudioGraph {
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  processor.onaudioprocess = (event) => onSamples(event.inputBuffer.getChannelData(0), context.sampleRate);
  source.connect(processor);
  processor.connect(context.destination);
  return { source, processor };
}

export function disconnectAudioGraph(graph: AudioGraph | null) {
  if (!graph) return;
  graph.processor.onaudioprocess = null;
  graph.processor.disconnect();
  graph.source.disconnect();
}