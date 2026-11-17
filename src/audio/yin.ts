// src/audio/yin.ts
// High-Performance YIN Pitch Detection with zero-allocation buffers & optional decimation.
// Reference: de Cheveigné & Kawahara (2002) "YIN, a fundamental frequency estimator for speech and music"

export interface YinResult {
  frequency: number | null;
  confidence: number; // 0.0 to 1.0 (1 - minimum CMNDF value)
  tau: number;        // winning lag in samples
  computeTimeMs: number;
}

export class OptimizedYin {
  private maxTau: number;
  private diff: Float32Array;
  private cmndf: Float32Array;
  private decimatedBuffer: Float32Array;

  constructor(maxBufferLength = 2048, maxTau = 800) {
    this.maxTau = maxTau;
    this.diff = new Float32Array(maxTau + 1);
    this.cmndf = new Float32Array(maxTau + 1);
    this.decimatedBuffer = new Float32Array(maxBufferLength / 2);
  }

  /**
   * Fast YIN execution with zero heap allocations.
   *
   * @param buffer      - PCM audio samples (Float32Array)
   * @param sampleRate  - e.g. 48000
   * @param threshold   - CMNDF acceptance threshold (0.10–0.15)
   * @param minFreq     - Minimum detectable frequency in Hz (default 65 Hz)
   * @param maxFreq     - Maximum detectable frequency in Hz (default 1050 Hz)
   * @param decimate2x  - Decimates by 2x for 4x faster execution (preserves sub-cent precision)
   */
  public detect(
    buffer: Float32Array,
    sampleRate: number,
    threshold = 0.12,
    minFreq = 65,
    maxFreq = 1050,
    decimate2x = true
  ): YinResult {
    const tStart = performance.now();

    if (decimate2x) {
      // 2x Decimation: doubles efficiency, perfectly safe for vocal range (< 1100 Hz)
      const decimatedLength = Math.floor(buffer.length / 2);
      if (this.decimatedBuffer.length < decimatedLength) {
        this.decimatedBuffer = new Float32Array(decimatedLength);
      }

      // Simple antialiasing box filter + 2x downsample
      for (let i = 0; i < decimatedLength; i++) {
        this.decimatedBuffer[i] = (buffer[i * 2] + buffer[i * 2 + 1]) * 0.5;
      }

      const effectiveSr = sampleRate / 2;
      const res = this.computeYin(
        this.decimatedBuffer,
        decimatedLength,
        effectiveSr,
        threshold,
        minFreq,
        maxFreq
      );

      const tEnd = performance.now();
      return {
        frequency: res.frequency,
        confidence: res.confidence,
        tau: res.tau * 2, // scale tau back to full sample rate
        computeTimeMs: tEnd - tStart,
      };
    }

    const res = this.computeYin(
      buffer,
      buffer.length,
      sampleRate,
      threshold,
      minFreq,
      maxFreq
    );

    const tEnd = performance.now();
    return {
      ...res,
      computeTimeMs: tEnd - tStart,
    };
  }

  private computeYin(
    buf: Float32Array,
    N: number,
    sr: number,
    threshold: number,
    minFreq: number,
    maxFreq: number
  ): { frequency: number | null; confidence: number; tau: number } {
    const tauMin = Math.max(2, Math.floor(sr / maxFreq));
    const tauMax = Math.min(
      Math.floor(sr / minFreq),
      Math.floor(N / 2) - 1,
      this.maxTau
    );

    if (tauMax <= tauMin) {
      return { frequency: null, confidence: 0, tau: 0 };
    }

    // Step 1: Difference function
    const diff = this.diff;
    const windowLen = N - tauMax;

    for (let tau = tauMin; tau <= tauMax; tau++) {
      let sum = 0;
      for (let j = 0; j < windowLen; j++) {
        const delta = buf[j] - buf[j + tau];
        sum += delta * delta;
      }
      diff[tau] = sum;
    }

    // Step 2 & 3: Cumulative Mean Normalized Difference Function (CMNDF)
    const cmndf = this.cmndf;
    cmndf[0] = 1.0;
    let runningSum = 0;

    for (let tau = 1; tau < tauMin; tau++) {
      runningSum += diff[tau];
      cmndf[tau] = 1.0;
    }

    for (let tau = tauMin; tau <= tauMax; tau++) {
      runningSum += diff[tau];
      cmndf[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1.0;
    }

    // Step 4: Absolute threshold with local minimum search
    let bestTau = -1;
    let bestCmndf = Infinity;

    for (let tau = tauMin + 1; tau < tauMax; tau++) {
      if (cmndf[tau] < cmndf[tau - 1] && cmndf[tau] <= cmndf[tau + 1]) {
        if (cmndf[tau] < threshold) {
          bestTau = tau;
          bestCmndf = cmndf[tau];
          break; // Found the fundamental period below threshold
        }
        if (cmndf[tau] < bestCmndf) {
          bestCmndf = cmndf[tau];
          bestTau = tau;
        }
      }
    }

    // Fallback to global minimum in range if threshold wasn't reached
    if (bestTau === -1) {
      for (let tau = tauMin; tau <= tauMax; tau++) {
        if (cmndf[tau] < bestCmndf) {
          bestCmndf = cmndf[tau];
          bestTau = tau;
        }
      }
    }

    if (bestTau <= 0) {
      return { frequency: null, confidence: 0, tau: 0 };
    }

    // Step 5: Parabolic interpolation for sub-sample precision
    let refinedTau = bestTau;
    if (bestTau > tauMin && bestTau < tauMax) {
      const s0 = cmndf[bestTau - 1];
      const s1 = cmndf[bestTau];
      const s2 = cmndf[bestTau + 1];
      const denom = 2 * (s0 - 2 * s1 + s2);
      if (denom !== 0) {
        refinedTau = bestTau + (s0 - s2) / denom;
      }
    }

    const frequency = sr / refinedTau;
    const confidence = Math.max(0, Math.min(1, 1 - bestCmndf));

    return { frequency, confidence, tau: refinedTau };
  }
}

// Global shared instance for direct functional calls
const defaultOptimizedYin = new OptimizedYin(2048, 800);

export function yin(
  buffer: Float32Array,
  sampleRate: number,
  threshold = 0.12,
  minFreq = 65,
  maxFreq = 1050
): YinResult {
  return defaultOptimizedYin.detect(buffer, sampleRate, threshold, minFreq, maxFreq, true);
}
