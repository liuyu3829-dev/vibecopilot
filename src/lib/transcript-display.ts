const sentenceBoundary = /[。！？!?；;]/;

export function splitTranscriptForReading(transcript: string, targetLength = 110) {
  if (!transcript) return [];
  const blocks: string[] = [];
  let start = 0;
  let preferredBoundary = -1;

  for (let index = 0; index < transcript.length; index += 1) {
    if (sentenceBoundary.test(transcript[index]) || transcript[index] === "\n") preferredBoundary = index + 1;
    if (index - start + 1 < targetLength) continue;
    const end = preferredBoundary > start ? preferredBoundary : index + 1;
    blocks.push(transcript.slice(start, end));
    start = end;
    preferredBoundary = -1;
  }
  if (start < transcript.length) blocks.push(transcript.slice(start));
  return blocks;
}
