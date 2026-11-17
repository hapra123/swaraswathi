// src/audio/rhythmEngine.ts
// Rhythm-Aware Musical Accompaniment Engine.
// Analyzes vocal onsets, estimates singing tempo, and adapts harmonium attack/release dynamics.

export type TempoCategory = 'free_alaap' | 'vilambit' | 'madhya' | 'drut';

export interface RhythmAnalysis {
  isOnset: boolean;
  estimatedBpm: number | null;
  confidence: number;
  tempoCategory: TempoCategory;
  recommendedAttackMs: number;
  recommendedReleaseMs: number;
  beatCount: number;
  lastOnsetTime: number;
}

export class RhythmEngine {
  private lastRms = 0;
  private onsetThreshold = 0.016;
  private minIntervalMs = 200;  // Up to ~300 BPM
  private maxIntervalMs = 1600; // Down to ~37 BPM

  private lastOnsetTime = 0;
  private intervals: number[] = [];
  private maxHistoryIntervals = 10;
  private beatCount = 0;

  private currentBpm: number | null = null;
  private confidence = 0;
  private tempoCategory: TempoCategory = 'free_alaap';

  public process(rms: number, timestamp: number): RhythmAnalysis {
    const deltaRms = rms - this.lastRms;
    this.lastRms = rms;

    let isOnset = false;
    const timeSinceLastOnset = timestamp - this.lastOnsetTime;

    // Detect sudden positive energy burst
    if (deltaRms > this.onsetThreshold && timeSinceLastOnset > this.minIntervalMs) {
      isOnset = true;
      this.beatCount++;

      if (this.lastOnsetTime > 0 && timeSinceLastOnset < this.maxIntervalMs) {
        this.intervals.push(timeSinceLastOnset);
        if (this.intervals.length > this.maxHistoryIntervals) {
          this.intervals.shift();
        }
        this.analyzeTempo();
      } else if (timeSinceLastOnset >= this.maxIntervalMs) {
        // Long pause indicates free singing or pause
        this.tempoCategory = 'free_alaap';
        this.confidence = Math.max(0, this.confidence - 0.2);
      }

      this.lastOnsetTime = timestamp;
    }

    // Determine adaptive envelope dynamics based on tempo
    let recommendedAttackMs = 20;
    let recommendedReleaseMs = 120;

    if (this.tempoCategory === 'drut') {
      // Snappy attack for fast kirtans to avoid blurred notes
      recommendedAttackMs = 14;
      recommendedReleaseMs = 80;
    } else if (this.tempoCategory === 'vilambit' || this.tempoCategory === 'free_alaap') {
      // Softer, breathy attack for meditative singing
      recommendedAttackMs = 26;
      recommendedReleaseMs = 160;
    }

    return {
      isOnset,
      estimatedBpm: this.currentBpm,
      confidence: this.confidence,
      tempoCategory: this.tempoCategory,
      recommendedAttackMs,
      recommendedReleaseMs,
      beatCount: this.beatCount,
      lastOnsetTime: this.lastOnsetTime,
    };
  }

  private analyzeTempo(): void {
    if (this.intervals.length < 3) {
      this.tempoCategory = 'free_alaap';
      return;
    }

    // Median interval to reject coughs/vocal artifacts
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const medianMs = sorted[Math.floor(sorted.length / 2)];

    if (medianMs > 0) {
      let rawBpm = Math.round(60000 / medianMs);

      // Fold octave tempo into comfortable bhajan range (50-160 BPM)
      if (rawBpm > 170) rawBpm = Math.round(rawBpm / 2);
      if (rawBpm < 45) rawBpm = Math.round(rawBpm * 2);

      this.currentBpm = rawBpm;

      // Variance calculation
      const variance = this.intervals.reduce((acc, val) => acc + Math.pow(val - medianMs, 2), 0) / this.intervals.length;
      const stdDev = Math.sqrt(variance);

      // Low standard deviation = steady rhythm
      if (stdDev < 65) {
        this.confidence = Math.min(0.95, 1.0 - stdDev / 120);
        if (this.currentBpm < 75) this.tempoCategory = 'vilambit';
        else if (this.currentBpm <= 115) this.tempoCategory = 'madhya';
        else this.tempoCategory = 'drut';
      } else {
        this.confidence = 0.25;
        this.tempoCategory = 'free_alaap';
      }
    }
  }

  public reset(): void {
    this.lastRms = 0;
    this.lastOnsetTime = 0;
    this.intervals = [];
    this.beatCount = 0;
    this.currentBpm = null;
    this.confidence = 0;
    this.tempoCategory = 'free_alaap';
  }
}
