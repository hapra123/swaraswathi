// public/audio-worklet/pitch-processor.js
// High-priority AudioWorkletProcessor for continuous, low-latency audio capture.
// Runs directly on Web Audio rendering thread, completely decoupled from React and requestAnimationFrame.

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 1024; // ~21.3 ms at 48 kHz (optimal for vocal range)
    this.hopSize = 256;     // ~5.3 ms hop interval for rapid note onset detection
    this.ringBuffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.samplesSinceLastHop = 0;
    this.isActive = true;

    this.port.onmessage = (event) => {
      if (event.data && event.data.action === 'configure') {
        if (event.data.bufferSize) this.bufferSize = event.data.bufferSize;
        if (event.data.hopSize) this.hopSize = event.data.hopSize;
        this.ringBuffer = new Float32Array(this.bufferSize);
        this.writeIndex = 0;
        this.samplesSinceLastHop = 0;
      } else if (event.data && event.data.action === 'stop') {
        this.isActive = false;
      }
    };
  }

  process(inputs) {
    if (!this.isActive) return false;

    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0];
    const len = channel.length;

    for (let i = 0; i < len; i++) {
      this.ringBuffer[this.writeIndex] = channel[i];
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      this.samplesSinceLastHop++;

      if (this.samplesSinceLastHop >= this.hopSize) {
        this.samplesSinceLastHop = 0;

        // Linearize circular ring buffer chronologically
        const linearBuffer = new Float32Array(this.bufferSize);
        let readIndex = this.writeIndex;
        for (let j = 0; j < this.bufferSize; j++) {
          linearBuffer[j] = this.ringBuffer[readIndex];
          readIndex = (readIndex + 1) % this.bufferSize;
        }

        // Post buffer using Transferable Objects for zero-copy memory transfer
        this.port.postMessage(
          {
            buffer: linearBuffer,
            timestamp: currentTime * 1000,
          },
          [linearBuffer.buffer]
        );
      }
    }

    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
