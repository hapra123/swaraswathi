// src/audio/noteStabilizer.ts
// Low-latency note stabilizer with fast-attack confirmation for high-confidence onsets
// and accurate latency measurement.

import type { PitchDetectionResult, NoteStabilizerOptions } from '../types/audio';
import type { NoteInfo } from '../types/music';

export interface StableNote {
  note: NoteInfo;
  startedAt: number;
  durationMs: number;
  avgFrequency: number;
  avgConfidence: number;
  isNew: boolean;
  stabilizationDelayMs: number; // Measured delay from candidate start to confirmation
}

const DEFAULT_OPTIONS: NoteStabilizerOptions = {
  vibratoToleranceCents: 45,
  minStableFrames: 2,           // Optimized: 2 frames at 12ms hop is ~24ms
  fastAttackConfidence: 0.85,  // Instant 1-frame trigger for very clear, high-confidence attacks
  silenceTimeoutMs: 380,        // Breath pause buffer
  suppressOctaveJumps: true,
};

export class NoteStabilizer {
  private options: NoteStabilizerOptions;
  private candidateNote: NoteInfo | null = null;
  private candidateStartTime = 0;
  private candidateFrames = 0;
  private candidateFreqSum = 0;
  private candidateConfSum = 0;

  private stableNote: NoteInfo | null = null;
  private stableStartTime = 0;
  private lastSilenceTime: number | null = null;
  private lastMeasuredDelayMs = 0;

  constructor(options: Partial<NoteStabilizerOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  public process(result: PitchDetectionResult): StableNote | null {
    const now = result.timestamp;

    // Handle silence / unconfident detection
    if (result.isSilent || result.note === null) {
      this.candidateNote = null;
      this.candidateFrames = 0;
      this.candidateFreqSum = 0;
      this.candidateConfSum = 0;

      if (this.lastSilenceTime === null) {
        this.lastSilenceTime = now;
      }

      const silenceDuration = now - this.lastSilenceTime;
      if (silenceDuration > this.options.silenceTimeoutMs) {
        this.stableNote = null;
        this.stableStartTime = 0;
      }

      if (this.stableNote) {
        return {
          note: this.stableNote,
          startedAt: this.stableStartTime,
          durationMs: now - this.stableStartTime,
          avgFrequency: this.stableNote.frequency,
          avgConfidence: result.confidence,
          isNew: false,
          stabilizationDelayMs: this.lastMeasuredDelayMs,
        };
      }
      return null;
    }

    // Active sung note
    this.lastSilenceTime = null;
    const incomingNote = result.note;

    if (this.candidateNote === null) {
      this.candidateNote = incomingNote;
      this.candidateStartTime = now;
      this.candidateFrames = 1;
      this.candidateFreqSum = incomingNote.frequency;
      this.candidateConfSum = result.confidence;
    } else {
      const centsDiff = Math.abs(this.frequencyToCents(incomingNote.frequency, this.candidateNote.frequency));
      if (centsDiff <= this.options.vibratoToleranceCents) {
        // Accumulate within vibrato window
        this.candidateFrames++;
        this.candidateFreqSum += incomingNote.frequency;
        this.candidateConfSum += result.confidence;
      } else {
        // New candidate
        this.candidateNote = incomingNote;
        this.candidateStartTime = now;
        this.candidateFrames = 1;
        this.candidateFreqSum = incomingNote.frequency;
        this.candidateConfSum = result.confidence;
      }
    }

    // Fast Attack Check:
    // If confidence is very high (> 0.85) and RMS is solid, 1 frame is enough!
    // Otherwise wait for minStableFrames (2 frames = ~24ms)
    const isFastAttack = result.confidence >= this.options.fastAttackConfidence && this.candidateFrames >= 1;
    const isNormalStable = this.candidateFrames >= this.options.minStableFrames;

    if (isFastAttack || isNormalStable) {
      const avgFrequency = this.candidateFreqSum / this.candidateFrames;
      const avgConfidence = this.candidateConfSum / this.candidateFrames;
      const isNewNote = this.stableNote === null || this.candidateNote.midiNote !== this.stableNote.midiNote;

      if (isNewNote) {
        // Octave jump check
        if (
          this.options.suppressOctaveJumps &&
          this.stableNote !== null &&
          Math.abs(this.candidateNote.midiNote - this.stableNote.midiNote) === 12
        ) {
          // If octave jump, require at least 2 frames to confirm
          if (this.candidateFrames < 2) {
            return {
              note: this.stableNote,
              startedAt: this.stableStartTime,
              durationMs: now - this.stableStartTime,
              avgFrequency: this.stableNote.frequency,
              avgConfidence: avgConfidence,
              isNew: false,
              stabilizationDelayMs: this.lastMeasuredDelayMs,
            };
          }
        }

        this.lastMeasuredDelayMs = Math.max(1, now - this.candidateStartTime);
        this.stableNote = { ...this.candidateNote, frequency: avgFrequency };
        this.stableStartTime = now;
      }

      return {
        note: this.stableNote!,
        startedAt: this.stableStartTime,
        durationMs: now - this.stableStartTime,
        avgFrequency,
        avgConfidence,
        isNew: isNewNote,
        stabilizationDelayMs: this.lastMeasuredDelayMs,
      };
    }

    // Candidate building up: sustain existing note if any
    if (this.stableNote) {
      return {
        note: this.stableNote,
        startedAt: this.stableStartTime,
        durationMs: now - this.stableStartTime,
        avgFrequency: this.stableNote.frequency,
        avgConfidence: result.confidence,
        isNew: false,
        stabilizationDelayMs: this.lastMeasuredDelayMs,
      };
    }

    return null;
  }

  public getMeasuredDelayMs(): number {
    return this.lastMeasuredDelayMs;
  }

  public reset(): void {
    this.candidateNote = null;
    this.candidateStartTime = 0;
    this.candidateFrames = 0;
    this.candidateFreqSum = 0;
    this.candidateConfSum = 0;
    this.stableNote = null;
    this.stableStartTime = 0;
    this.lastSilenceTime = null;
    this.lastMeasuredDelayMs = 0;
  }

  private frequencyToCents(f1: number, f2: number): number {
    if (f2 === 0 || f1 === 0) return 0;
    return 1200 * Math.log2(f1 / f2);
  }
}
