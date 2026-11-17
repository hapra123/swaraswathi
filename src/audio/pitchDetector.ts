// src/audio/pitchDetector.ts
// Real-time streaming pitch detection pipeline powered by AudioWorklet.
// Completely decouples audio processing from React and requestAnimationFrame.
// Incorporates multi-layered acoustic feedback cancellation and adaptive VAD for speaker playback.

import { OptimizedYin } from './yin';
import { calculateRms } from './microphone';
import type { PitchDetectionResult, PitchDetectorOptions, FeedbackSuppressionConfig } from '../types/audio';
import { mapFrequencyToNoteInfo } from '../utils/sargamMapper';
import { frequencyToWesternNote } from '../utils/frequencyToNote';
import type { PitchClass } from '../types/music';

export interface OutputAcousticReference {
  getOutputRms: () => number;
  getActiveMidis: () => number[];
}

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

  // ── Acoustic Feedback & Adaptive VAD Subsystem ─────────────────────────────
  private acousticRef: OutputAcousticReference | null = null;
  private adaptiveNoiseFloor = 0.004;
  private feedbackSuppressionEnabled = true;
  private sensitivity = 1.0;            // 0.5 (low sensitivity) to 2.0 (high sensitivity)
  private baseNoiseGateThreshold = 0.005; // Base noise gate RMS
  private speakerCouplingRatio = 0.22;   // Typical mobile phone speaker-to-mic acoustic coupling (18%–25%)

  // Jitter tracking buffer for electronic tone rejection
  private recentFrequencies: number[] = [];
  private maxJitterHistory = 7;

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

  public setAcousticReference(ref: OutputAcousticReference | null): void {
    this.acousticRef = ref;
  }

  public setFeedbackSuppressionConfig(config: Partial<FeedbackSuppressionConfig>): void {
    if (config.enabled !== undefined) this.feedbackSuppressionEnabled = config.enabled;
    if (config.sensitivity !== undefined) this.sensitivity = Math.max(0.4, Math.min(2.5, config.sensitivity));
    if (config.noiseGateThreshold !== undefined) this.baseNoiseGateThreshold = Math.max(0.001, config.noiseGateThreshold);
    if (config.speakerCouplingRatio !== undefined) this.speakerCouplingRatio = config.speakerCouplingRatio;
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
      const silentGain = this.audioContext.createGain();
      silentGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.scriptNode.connect(silentGain);
      silentGain.connect(this.audioContext.destination);
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
   * Runs advanced 4-layer VAD & Output-Reference Self-Feedback Rejection.
   */
  private processAudioBuffer(buffer: Float32Array, timestamp: number): void {
    const rms = calculateRms(buffer);

    // 1. Query instantaneous speaker output reference
    const outputRms = this.acousticRef?.getOutputRms() ?? 0;
    const activeOutputMidis = this.acousticRef?.getActiveMidis() ?? [];

    // 2. Adaptive Noise-Floor Tracking (only update when speakers are quiet to avoid contamination)
    if (outputRms < 0.015) {
      if (rms < this.adaptiveNoiseFloor) {
        this.adaptiveNoiseFloor = this.adaptiveNoiseFloor * 0.95 + rms * 0.05; // Quick downward tracking
      } else if (rms < this.adaptiveNoiseFloor * 2.0) {
        this.adaptiveNoiseFloor = this.adaptiveNoiseFloor * 0.998 + rms * 0.002; // Slow upward tracking
      }
    }
    this.adaptiveNoiseFloor = Math.max(0.002, Math.min(0.035, this.adaptiveNoiseFloor));

    // 3. Compute dynamic VAD threshold with expected speaker acoustic coupling
    const expectedBleed = this.feedbackSuppressionEnabled ? outputRms * this.speakerCouplingRatio : 0;
    const dynamicThreshold = Math.max(
      this.baseNoiseGateThreshold,
      this.adaptiveNoiseFloor * 1.45,
      expectedBleed * 1.20
    ) / this.sensitivity;

    const isSilent = rms < dynamicThreshold;

    if (isSilent) {
      this.recentFrequencies = [];
      const silentResult: PitchDetectionResult = {
        frequency: null,
        confidence: 0,
        rms,
        isSilent: true,
        note: null,
        timestamp,
        yinComputeTimeMs: 0,
        isFeedbackSuppressed: false,
        dynamicThreshold,
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

    // 4. High performance YIN pitch estimation (singer level exceeds noise gate & speaker bleed)
    const yinRes = this.yinDetector.detect(
      buffer,
      this.audioContext.sampleRate,
      this.options.yinThreshold,
      this.options.minFrequency,
      this.options.maxFrequency,
      this.options.useDecimation
    );

    const isConfident = yinRes.frequency !== null && yinRes.confidence >= this.options.confidenceThreshold;

    if (!isConfident || !yinRes.frequency) {
      this.recentFrequencies = [];
      const unvoicedResult: PitchDetectionResult = {
        frequency: null,
        confidence: yinRes.confidence,
        rms,
        isSilent: true,
        note: null,
        timestamp,
        tau: yinRes.tau,
        yinComputeTimeMs: yinRes.computeTimeMs,
        isFeedbackSuppressed: false,
        dynamicThreshold,
      };
      this.onDirectAudio?.(unvoicedResult);
      if (timestamp - this.lastUiDispatchTime >= this.uiDispatchIntervalMs) {
        this.lastUiDispatchTime = timestamp;
        this.onUiTelemetry?.(unvoicedResult);
      }
      return;
    }

    const detectedFreq = yinRes.frequency;

    // 5. Track pitch jitter for human vocal cord vs electronic speaker discrimination
    this.recentFrequencies.push(detectedFreq);
    if (this.recentFrequencies.length > this.maxJitterHistory) {
      this.recentFrequencies.shift();
    }

    // 6. Output-Reference Acoustic Feedback Discriminator
    let isFeedback = false;
    if (this.feedbackSuppressionEnabled && activeOutputMidis.length > 0) {
      const western = frequencyToWesternNote(detectedFreq);
      if (western) {
        // Is candidate note identical to any currently sounding harmonium note (drone or melody)?
        const matchesActiveHarmoniumNote = activeOutputMidis.includes(western.midiNote);

        if (matchesActiveHarmoniumNote) {
          // Calculate pitch variance (jitter) over recent frames
          let jitterHz = 1.0;
          if (this.recentFrequencies.length >= 4) {
            const avg = this.recentFrequencies.reduce((a, b) => a + b, 0) / this.recentFrequencies.length;
            const variance = this.recentFrequencies.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / this.recentFrequencies.length;
            jitterHz = Math.sqrt(variance);
          }

          // An electronic oscillator from the phone speaker has virtually 0 Hz jitter (< 0.28 Hz)
          // A human vocal cord always exhibits natural micro-tremor and breath unsteadiness (jitter >= 0.45 Hz)
          const isStationarySpeakerTone = jitterHz < 0.28;

          // If the pitch is a stationary speaker tone AND input volume is not significantly louder than speaker bleed
          const isBelowSingingHeadroom = rms < expectedBleed * 2.1;

          if (isStationarySpeakerTone && isBelowSingingHeadroom) {
            isFeedback = true;
          }
        }
      }
    }

    if (isFeedback) {
      // Acoustic feedback from phone speaker successfully suppressed!
      const suppressedResult: PitchDetectionResult = {
        frequency: null,
        confidence: yinRes.confidence,
        rms,
        isSilent: true,
        note: null,
        timestamp,
        tau: yinRes.tau,
        yinComputeTimeMs: yinRes.computeTimeMs,
        isFeedbackSuppressed: true,
        dynamicThreshold,
      };

      this.onDirectAudio?.(suppressedResult);

      if (timestamp - this.lastUiDispatchTime >= this.uiDispatchIntervalMs) {
        this.lastUiDispatchTime = timestamp;
        this.onUiTelemetry?.(suppressedResult);
      }
      return;
    }

    // 7. Legitimate human vocal note confirmed
    const note = mapFrequencyToNoteInfo(detectedFreq, this.tonicPitchClass, this.tonicOctave);

    const result: PitchDetectionResult = {
      frequency: detectedFreq,
      confidence: yinRes.confidence,
      rms,
      isSilent: false,
      note,
      timestamp,
      tau: yinRes.tau,
      yinComputeTimeMs: yinRes.computeTimeMs,
      isFeedbackSuppressed: false,
      dynamicThreshold,
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
