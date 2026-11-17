// src/types/audio.ts
import type { NoteInfo } from './music';

export type MicrophoneStatus = 
  | 'idle' 
  | 'requesting' 
  | 'connected' 
  | 'denied' 
  | 'error' 
  | 'unsupported';

export type AudioOutputMode = 'speaker' | 'headphones';

export interface FeedbackSuppressionConfig {
  enabled: boolean;
  outputMode: AudioOutputMode;
  sensitivity: number;        // 0.5 to 2.0 (default 1.0)
  noiseGateThreshold: number; // 0.002 to 0.020 (default 0.006)
  speakerCouplingRatio?: number; // e.g. 0.22
}

export interface PitchDetectionResult {
  frequency: number | null;
  confidence: number;
  rms: number;
  isSilent: boolean;
  note: NoteInfo | null;
  timestamp: number;
  tau?: number;
  yinComputeTimeMs?: number;
  isFeedbackSuppressed?: boolean;
  dynamicThreshold?: number;
}

export interface PitchDetectorOptions {
  yinThreshold: number;        // Threshold for CMNDF local minimum (typically 0.10 to 0.15)
  minFrequency: number;        // e.g. 65 Hz (approx C2)
  maxFrequency: number;        // e.g. 1050 Hz (approx C6)
  silenceThresholdRms: number; // e.g. 0.012 (-38dB)
  confidenceThreshold: number; // e.g. 0.75
  bufferSize: number;          // e.g. 1024 samples (~21.3ms at 48kHz)
  analysisIntervalMs: number;  // e.g. 12-15ms hop interval
  useDecimation: boolean;      // 2x decimation for 4x faster execution
}

export interface NoteStabilizerOptions {
  vibratoToleranceCents: number; // Pitch tolerance in cents to absorb vocal vibrato (typically 40-50 cents)
  minStableFrames: number;       // Consecutive frames required (now 1-2 with 12ms hops)
  fastAttackConfidence: number;  // Confidence threshold (>0.85) to trigger instant 1-frame attack
  silenceTimeoutMs: number;      // Breathing pause window (e.g. 400-500ms)
  suppressOctaveJumps: boolean;  // Protect against spurious harmonic octave doublings
}

export interface LatencyBreakdown {
  bufferDurationMs: number;            // Physical input buffer window
  yinExecutionTimeMs: number;          // CPU time of YIN algorithm
  stabilizationDelayMs: number;        // Time from note onset to stable confirmation
  accompanimentDispatchMs: number;     // Direct engine decision & synth trigger time
  synthAttackRampMs: number;           // Attack envelope duration
  audioContextBaseLatencyMs: number;   // Audio hardware base latency
  audioContextOutputLatencyMs: number; // Audio hardware output latency
  estimatedTotalLatencyMs: number;     // End-to-end audio-to-audio latency
}
