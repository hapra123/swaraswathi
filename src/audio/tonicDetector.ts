// src/audio/tonicDetector.ts
// Automatic Tonic (Sa) Detection Engine for Indian Classical & Bhajan Singing.
// Uses pitch-class duration histograms and cross-correlation with Indian modal interval templates (Sa-Pa consonance).

import type { PitchClass } from '../types/music';

const PITCH_CLASSES: PitchClass[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

export interface TonicEstimationResult {
  estimatedTonic: PitchClass;
  confidence: number; // 0.0 to 1.0
  distribution: Record<PitchClass, number>; // normalized time spent on each pitch class
  sampleCount: number;
}

export class TonicDetector {
  // Histogram of time spent on each of the 12 chromatic semitones (0=C, 1=C#, ..., 11=B)
  private semitoneDurations = new Float32Array(12);
  private totalDurationMs = 0;
  private lastTimestamp: number | null = null;

  // Sliding window: reset or decay slowly over ~45 seconds of audio
  private decayFactor = 0.998; 

  /**
   * Feed pitch information into the histogram.
   * Call this on every audio frame.
   */
  public update(midiNote: number | null, isSilent: boolean, timestamp: number): void {
    if (this.lastTimestamp !== null) {
      const dt = Math.min(100, timestamp - this.lastTimestamp); // clamp delta
      
      // Decay past history gradually to adapt to longer sessions
      for (let i = 0; i < 12; i++) {
        this.semitoneDurations[i] *= this.decayFactor;
      }
      this.totalDurationMs = this.totalDurationMs * this.decayFactor + dt;

      if (!isSilent && midiNote !== null && midiNote >= 36 && midiNote <= 84) {
        const pitchClassIndex = ((midiNote % 12) + 12) % 12;
        this.semitoneDurations[pitchClassIndex] += dt;
      }
    }

    this.lastTimestamp = timestamp;
  }

  /**
   * Estimates the most probable Tonic (Sa) by evaluating pitch distribution against
   * the universal Sa-Pa (fifth) interval dominance in Indian vocal music.
   */
  public estimate(): TonicEstimationResult {
    const sum = this.semitoneDurations.reduce((a, b) => a + b, 0);
    
    // Normalized distribution
    const norm = new Float32Array(12);
    const distribution: Partial<Record<PitchClass, number>> = {};

    for (let i = 0; i < 12; i++) {
      norm[i] = sum > 0 ? this.semitoneDurations[i] / sum : 1 / 12;
      distribution[PITCH_CLASSES[i]] = norm[i];
    }

    // Correlation with Indian classical vocal profile:
    // In bhajan and Indian singing:
    // - Sa (0) has highest weight (often ~25-35% of vocal time / phrase ending nyasa)
    // - Pa (7) is next most dominant anchor (~15-20%)
    // - Ma (5) or Ga (4/3) often follow
    const template = [
      1.00, // 0: Sa (Tonic)
      0.15, // 1: komal Re
      0.35, // 2: shuddha Re
      0.25, // 3: komal Ga
      0.40, // 4: shuddha Ga
      0.50, // 5: shuddha Ma
      0.20, // 6: tivra Ma
      0.80, // 7: Pa (Fifth)
      0.15, // 8: komal Dha
      0.35, // 9: shuddha Dha
      0.20, // 10: komal Ni
      0.35  // 11: shuddha Ni
    ];

    let bestTonicIndex = 0;
    let highestScore = -1;
    const scores = new Float32Array(12);

    for (let candidate = 0; candidate < 12; candidate++) {
      let score = 0;
      for (let offset = 0; offset < 12; offset++) {
        const semitone = (candidate + offset) % 12;
        score += norm[semitone] * template[offset];
      }
      scores[candidate] = score;

      if (score > highestScore) {
        highestScore = score;
        bestTonicIndex = candidate;
      }
    }

    // Confidence: compare highest candidate to average of other candidates
    let otherSum = 0;
    for (let i = 0; i < 12; i++) {
      if (i !== bestTonicIndex) otherSum += scores[i];
    }
    const otherAvg = otherSum / 11;
    const contrast = otherAvg > 0 ? (highestScore - otherAvg) / highestScore : 0;

    // Minimum data requirement: needs at least ~3 seconds of singing for high confidence
    const dataSufficiency = Math.min(1.0, sum / 3000);
    const confidence = Math.max(0, Math.min(0.99, contrast * 2.2 * dataSufficiency));

    return {
      estimatedTonic: PITCH_CLASSES[bestTonicIndex],
      confidence,
      distribution: distribution as Record<PitchClass, number>,
      sampleCount: Math.round(sum / 30),
    };
  }

  public reset(): void {
    this.semitoneDurations.fill(0);
    this.totalDurationMs = 0;
    this.lastTimestamp = null;
  }
}
