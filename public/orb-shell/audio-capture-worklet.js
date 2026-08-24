class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(4096);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    let index = 0;
    while (index < input.length) {
      const copied = Math.min(this.buffer.length - this.offset, input.length - index);
      this.buffer.set(input.subarray(index, index + copied), this.offset);
      this.offset += copied;
      index += copied;
      if (this.offset === this.buffer.length) {
        this.port.postMessage(this.buffer.buffer, [this.buffer.buffer]);
        this.buffer = new Float32Array(4096);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-capture", PcmCaptureProcessor);
