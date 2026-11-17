// src/audio/rhythmDetector.ts
// Real-time musical onset detection and tempo (BPM) estimation from vocal audio frames.

export interface RhythmState {
  isOnset: boolean;
  estimatedBpm: number | null;
  confidence: number;
  lastOnsetTime: number;
  beatCount: number;
}

export class RhythmDetector {
  private lastRms = 0;
  private onsetThreshold = 0.018; // Minimum RMS jump to qualify as an attack
  private minInterOnsetIntervalMs = 220; // Max ~270 BPM to filter noise flutter
  private maxInterOnsetIntervalMs = 1500; // Min ~40 BPM

  private lastOnsetTime = 0;
  private intervals: number[] = [];
  private maxIntervalsTracked = 8;
  private beatCount = 0;

  private currentBpm: number | null = null;
  private bpmConfidence = 0;

  /**
   * Evaluates incoming audio frame RMS for sudden attack onsets.
   */
  public process(rms: number, timestamp: number): RhythmState {
    const deltaRms = rms - this.lastRms;
    this.lastRms = rms;

    let isOnset = false;
    const timeSinceLastOnset = timestamp - this.lastOnsetTime;

    // Detect positive energy burst that exceeds threshold and respects interval refractory period
    if (deltaRms > this.onsetThreshold && timeSinceLastOnset > this.minInterOnsetIntervalMs) {
      isOnset = true;
      this.beatCount++;

      if (this.lastOnsetTime > 0 && timeSinceLastOnset < this.maxInterOnsetIntervalMs) {
        this.intervals.push(timeSinceLastOnset);
        if (this.intervals.length > this.maxIntervalsTracked) {
          this.intervals.shift();
        }
        this.calculateTempo();
      }

      this.lastOnsetTime = timestamp;
    }

    return {
      isOnset,
      estimatedBpm: this.currentBpm,
      confidence: this.bpmConfidence,
      lastOnsetTime: this.lastOnsetTime,
      beatCount: this.beatCount,
    };
  }

  private calculateTempo(): void {
    if (this.intervals.length < 3) return;

    // Median interval to resist outliers
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const medianMs = sorted[Math.floor(sorted.length / 2)];

    if (medianMs > 0) {
      const rawBpm = Math.round(60000 / medianMs);
      // Normalize to comfortable bhajan tempo range (50 - 160 BPM)
      let normalizedBpm = rawBpm;
      if (normalizedBpm > 160) normalizedBpm = Math.round(normalizedBpm / 2);
      if (normalizedBpm < 50) normalizedBpm = Math.round(normalizedBpm * 2);

      this.currentBpm = normalizedBpm;

      // Consistency of intervals determines confidence
      const variance = this.intervals.reduce((acc, val) => acc + Math.pow(val - medianMs, 2), 0) / this.intervals.length;
      const stdDev = Math.sqrt(variance);
      this.bpmConfidence = Math.max(0, Math.min(1.0, 1.0 - stdDev / 200));
    }
  }

  public reset(): void {
    this.lastRms = 0;
    this.lastOnsetTime = 0;
    this.intervals = [];
    this.beatCount = 0;
    this.currentBpm = null;
    this.bpmConfidence = 0;
  }
}
