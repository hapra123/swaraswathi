// src/audio/pitchDetector.ts
// Real-time streaming pitch detection pipeline powered by AudioWorklet.
// Completely decouples audio processing from React and requestAnimationFrame.

import { OptimizedYin } from './yin';
import { calculateRms } from './microphone';
import type { PitchDetectionResult, PitchDetectorOptions } from '../types/audio';
import { mapFrequencyToNoteInfo } from '../utils/sargamMapper';
import type { PitchClass } from '../types/music';

const DEFAULT_OPTIONS: PitchDetectorOptions = {
  yinThreshold: 0.12,
  minFrequency: 65,       // ~C2 (male vocal range)
  maxFrequency: 1050,     // ~C6 (female vocal range)
  silenceThresholdRms: 0.006, // Sensitive to normal conversational singing level
  confidenceThreshold: 0.65, // Responsive to vocal harmonics while rejecting noise
  bufferSize: 1024,       // 1024 samples @ 48kHz = 21.3 ms
  analysisIntervalMs: 10, // ~10 ms hop interval
  useDecimation: true,
};

export class PitchDetector {
  private audioContext: AudioContext;
  private sourceNode: AudioNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private scriptNode: ScriptProcessorNode | null = null; // Robust fallback
  private options: PitchDetectorOptions;

  // Direct synchronous audio callback (runs in high-priority audio pipeline)
  private onDirectAudio: ((result: PitchDetectionResult) => void) | null = null;
  // Throttled UI telemetry callback (~30 FPS, decoupled from audio thread)
  private onUiTelemetry: ((result: PitchDetectionResult) => void) | null = null;

  private tonicPitchClass: PitchClass = 'C';
  private tonicOctave: number = 3;
  private isRunning = false;
  private lastUiDispatchTime = 0;
  private uiDispatchIntervalMs = 33; // 30 FPS visual refresh rate

  private yinDetector: OptimizedYin;

  constructor(
    audioContext: AudioContext,
    onDirectAudio?: (result: PitchDetectionResult) => void,
    onUiTelemetry?: (result: PitchDetectionResult) => void,
    options: Partial<PitchDetectorOptions> = {}
  ) {
    this.audioContext = audioContext;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.onDirectAudio = onDirectAudio ?? null;
    this.onUiTelemetry = onUiTelemetry ?? null;
    this.yinDetector = new OptimizedYin(this.options.bufferSize, 800);
  }

  public setTonic(pitchClass: PitchClass, octave = 3): void {
    this.tonicPitchClass = pitchClass;
    this.tonicOctave = octave;
  }

  public setDirectCallback(cb: (result: PitchDetectionResult) => void): void {
    this.onDirectAudio = cb;
  }

  public setUiCallback(cb: (result: PitchDetectionResult) => void): void {
    this.onUiTelemetry = cb;
  }

  public async connect(sourceNode: AudioNode): Promise<void> {
    this.sourceNode = sourceNode;

    try {
      // 1. Attempt high-priority AudioWorklet setup
      await this.audioContext.audioWorklet.addModule('/audio-worklet/pitch-processor.js');

      this.workletNode = new AudioWorkletNode(this.audioContext, 'pitch-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
      });

      this.workletNode.port.onmessage = (event) => {
        if (!this.isRunning) return;
        const { buffer, timestamp } = event.data;
        if (buffer instanceof Float32Array) {
          this.processAudioBuffer(buffer, timestamp || performance.now());
        }
      };

      this.sourceNode.connect(this.workletNode);
      // Connect to destination via silent gain to keep worklet active in Web Audio graph
      const silentGain = this.audioContext.createGain();
      silentGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.workletNode.connect(silentGain);
      silentGain.connect(this.audioContext.destination);
    } catch {
      // 2. Reliable ScriptProcessor fallback if AudioWorklet module fails to load (e.g. strict origin)
      const bufSize = this.options.bufferSize;
      this.scriptNode = this.audioContext.createScriptProcessor(bufSize, 1, 1);
      this.scriptNode.onaudioprocess = (e) => {
        if (!this.isRunning) return;
        const channelData = e.inputBuffer.getChannelData(0);
        this.processAudioBuffer(channelData, performance.now());
      };
      this.sourceNode.connect(this.scriptNode);
      this.scriptNode.connect(this.audioContext.destination);
    }
  }

  public start(): void {
    this.isRunning = true;
  }

  public stop(): void {
    this.isRunning = false;
  }

  public disconnect(): void {
    this.stop();

    if (this.workletNode) {
      try {
        this.workletNode.port.postMessage({ action: 'stop' });
        this.workletNode.disconnect();
      } catch {}
      this.workletNode = null;
    }

    if (this.scriptNode) {
      try {
        this.scriptNode.disconnect();
      } catch {}
      this.scriptNode = null;
    }

    this.sourceNode = null;
  }

  public getBufferDurationMs(): number {
    return (this.options.bufferSize / this.audioContext.sampleRate) * 1000;
  }

  /**
   * Continuous PCM buffer processing callback directly from AudioWorklet.
   */
  private processAudioBuffer(buffer: Float32Array, timestamp: number): void {
    const rms = calculateRms(buffer);
    const isSilent = rms < this.options.silenceThresholdRms;

    if (isSilent) {
      const silentResult: PitchDetectionResult = {
        frequency: null,
        confidence: 0,
        rms,
        isSilent: true,
        note: null,
        timestamp,
        yinComputeTimeMs: 0,
      };

      // Direct audio dispatch (zero latency)
      this.onDirectAudio?.(silentResult);

      // Throttled UI telemetry
      if (timestamp - this.lastUiDispatchTime >= this.uiDispatchIntervalMs) {
        this.lastUiDispatchTime = timestamp;
        this.onUiTelemetry?.(silentResult);
      }
      return;
    }

    // High performance YIN pitch estimation
    const yinRes = this.yinDetector.detect(
      buffer,
      this.audioContext.sampleRate,
      this.options.yinThreshold,
      this.options.minFrequency,
      this.options.maxFrequency,
      this.options.useDecimation
    );

    const isConfident = yinRes.frequency !== null && yinRes.confidence >= this.options.confidenceThreshold;

    const note = isConfident && yinRes.frequency
      ? mapFrequencyToNoteInfo(yinRes.frequency, this.tonicPitchClass, this.tonicOctave)
      : null;

    const result: PitchDetectionResult = {
      frequency: isConfident ? yinRes.frequency : null,
      confidence: yinRes.confidence,
      rms,
      isSilent: false,
      note,
      timestamp,
      tau: yinRes.tau,
      yinComputeTimeMs: yinRes.computeTimeMs,
    };

    // 1. Direct audio dispatch (runs synchronously without touching React)
    this.onDirectAudio?.(result);

    // 2. Throttled UI telemetry
    if (timestamp - this.lastUiDispatchTime >= this.uiDispatchIntervalMs) {
      this.lastUiDispatchTime = timestamp;
      this.onUiTelemetry?.(result);
    }
  }
}
