// src/audio/audioEngine.ts
// Central AudioContext manager. Creates and owns the Web Audio context with low-latency hints.

export class AudioEngine {
  private static instance: AudioEngine | null = null;
  public context: AudioContext;

  private constructor() {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    try {
      this.context = new AudioCtx({ latencyHint: 'interactive' });
    } catch {
      this.context = new AudioCtx();
    }
  }

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  async resume(): Promise<void> {
    if (this.context && this.context.state !== 'running') {
      await this.context.resume();
    }
  }

  async suspend(): Promise<void> {
    if (this.context.state === 'running') {
      await this.context.suspend();
    }
  }

  get sampleRate(): number {
    return this.context.sampleRate;
  }

  get baseLatencyMs(): number {
    return (this.context.baseLatency ?? 0.01) * 1000;
  }

  get outputLatencyMs(): number {
    return ((this.context as AudioContext & { outputLatency?: number }).outputLatency ?? 0.02) * 1000;
  }

  destroy(): void {
    this.context.close();
    AudioEngine.instance = null;
  }
}
