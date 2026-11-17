// src/tests/pitchDetection.test.ts
import { describe, it, expect } from 'vitest';
import { OptimizedYin } from '../audio/yin';

function generateSineWave(freq: number, sampleRate: number, durationSec: number): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(numSamples);
  const twoPiF = 2 * Math.PI * freq;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    buffer[i] = Math.sin(twoPiF * t);
  }
  return buffer;
}

describe('OptimizedYin Pitch Detection', () => {
  const yin = new OptimizedYin(2048, 800);
  const sampleRate = 48000;

  it('accurately detects A4 (440 Hz) with 2x decimation', () => {
    const buffer = generateSineWave(440, sampleRate, 0.05); // 50ms buffer
    const result = yin.detect(buffer, sampleRate, 0.12, 65, 1050, true);

    expect(result.frequency).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0.85);
    // Should be accurate within 1.5 Hz
    expect(Math.abs(result.frequency! - 440)).toBeLessThan(1.5);
  });

  it('accurately detects Middle C / C4 (261.63 Hz)', () => {
    const buffer = generateSineWave(261.63, sampleRate, 0.05);
    const result = yin.detect(buffer, sampleRate, 0.12, 65, 1050, true);

    expect(result.frequency).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0.85);
    expect(Math.abs(result.frequency! - 261.63)).toBeLessThan(1.0);
  });

  it('accurately detects Male Mandra Sa / C3 (130.81 Hz)', () => {
    const buffer = generateSineWave(130.81, sampleRate, 0.05);
    const result = yin.detect(buffer, sampleRate, 0.12, 65, 1050, true);

    expect(result.frequency).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0.80);
    expect(Math.abs(result.frequency! - 130.81)).toBeLessThan(1.0);
  });

  it('rejects pure silence without false triggers', () => {
    const silentBuffer = new Float32Array(2048);
    const result = yin.detect(silentBuffer, sampleRate, 0.12, 65, 1050, true);

    expect(result.frequency === null || result.confidence < 0.5).toBe(true);
  });
});
