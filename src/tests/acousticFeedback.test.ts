// src/tests/acousticFeedback.test.ts
import { describe, it, expect } from 'vitest';
import { PitchDetector } from '../audio/pitchDetector';
import type { PitchDetectionResult } from '../types/audio';

function generateSineWave(freq: number, sampleRate: number, durationSec: number, amplitude = 0.05): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(numSamples);
  const twoPiF = 2 * Math.PI * freq;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    buffer[i] = Math.sin(twoPiF * t) * amplitude;
  }
  return buffer;
}

// Generates wave with natural vocal jitter (0.8 Hz micro-tremor)
function generateVocalWaveWithJitter(baseFreq: number, sampleRate: number, durationSec: number, amplitude = 0.05): Float32Array {
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // 5 Hz vibrato / jitter with 1.2 Hz depth
    const instantFreq = baseFreq + Math.sin(2 * Math.PI * 5.0 * t) * 1.2;
    buffer[i] = Math.sin(2 * Math.PI * instantFreq * t) * amplitude;
  }
  return buffer;
}

describe('Acoustic Feedback Cancellation & Adaptive VAD', () => {
  const sampleRate = 48000;

  it('rejects stationary electronic speaker tone matching active harmonium drone (Acoustic Feedback)', () => {
    let lastResult: PitchDetectionResult | null = null;
    const detector = new PitchDetector(
      { sampleRate } as unknown as AudioContext,
      (res) => { lastResult = res; },
      undefined,
      { bufferSize: 1024, analysisIntervalMs: 10 }
    );

    // Active harmonium notes: C3 (Sa = MIDI 48 = 130.81 Hz), G3 (Pa = MIDI 55 = 196.00 Hz)
    detector.setAcousticReference({
      getOutputRms: () => 0.05, // Harmonium is playing through phone speaker
      getActiveMidis: () => [48, 55],
    });

    detector.setFeedbackSuppressionConfig({
      enabled: true,
      sensitivity: 1.0,
      noiseGateThreshold: 0.005,
      speakerCouplingRatio: 0.22,
    });

    // Feed 6 consecutive frames of pure 130.81 Hz sine wave (simulating speaker output leaking into mic)
    // with amplitude = 0.020 (passes initial gate RMS ~0.014, but caught by self-pitch & zero-jitter discriminator)
    for (let frame = 0; frame < 6; frame++) {
      const buffer = generateSineWave(130.81, sampleRate, 0.021, 0.020);
      (detector as unknown as { processAudioBuffer: (b: Float32Array, t: number) => void }).processAudioBuffer(buffer, frame * 20);
    }

    expect(lastResult).not.toBeNull();
    // Must be suppressed as acoustic feedback!
    expect(lastResult!.isSilent).toBe(true);
    expect(lastResult!.isFeedbackSuppressed).toBe(true);
    expect(lastResult!.note).toBeNull();
  });

  it('detects a human singing a different note (Ga = E3) even while harmonium drone is playing', () => {
    let lastResult: PitchDetectionResult | null = null;
    const detector = new PitchDetector(
      { sampleRate } as unknown as AudioContext,
      (res) => { lastResult = res; },
      undefined,
      { bufferSize: 1024, analysisIntervalMs: 10 }
    );

    // Drone is playing Sa (48) and Pa (55)
    detector.setAcousticReference({
      getOutputRms: () => 0.04,
      getActiveMidis: () => [48, 55],
    });

    detector.setFeedbackSuppressionConfig({
      enabled: true,
      sensitivity: 1.0,
      noiseGateThreshold: 0.005,
    });

    // Singer sings Ga (E3 = 164.81 Hz, MIDI 52) at vocal level (amplitude = 0.035)
    for (let frame = 0; frame < 5; frame++) {
      const buffer = generateSineWave(164.81, sampleRate, 0.021, 0.035);
      (detector as unknown as { processAudioBuffer: (b: Float32Array, t: number) => void }).processAudioBuffer(buffer, frame * 20);
    }

    expect(lastResult).not.toBeNull();
    expect(lastResult!.isSilent).toBe(false);
    expect(lastResult!.isFeedbackSuppressed).toBe(false);
    expect(lastResult!.note).not.toBeNull();
    expect(lastResult!.note!.swara.shortName).toBe('Ga');
  });

  it('detects a human singing Sa when voice has vocal micro-jitter and exceeds bleed level', () => {
    let lastResult: PitchDetectionResult | null = null;
    const detector = new PitchDetector(
      { sampleRate } as unknown as AudioContext,
      (res) => { lastResult = res; },
      undefined,
      { bufferSize: 1024, analysisIntervalMs: 10 }
    );

    // Drone is playing Sa (48)
    detector.setAcousticReference({
      getOutputRms: () => 0.03,
      getActiveMidis: () => [48],
    });

    detector.setFeedbackSuppressionConfig({
      enabled: true,
      sensitivity: 1.0,
      noiseGateThreshold: 0.005,
    });

    // Singer sings Sa into phone mic with vocal micro-jitter at healthy vocal amplitude (0.05)
    for (let frame = 0; frame < 6; frame++) {
      const buffer = generateVocalWaveWithJitter(130.81, sampleRate, 0.021, 0.05);
      (detector as unknown as { processAudioBuffer: (b: Float32Array, t: number) => void }).processAudioBuffer(buffer, frame * 20);
    }

    expect(lastResult).not.toBeNull();
    expect(lastResult!.isSilent).toBe(false);
    expect(lastResult!.note).not.toBeNull();
    expect(lastResult!.note!.swara.shortName).toBe('Sa');
  });

  it('drops to silence when input RMS is below the dynamic noise gate threshold', () => {
    let lastResult: PitchDetectionResult | null = null;
    const detector = new PitchDetector(
      { sampleRate } as unknown as AudioContext,
      (res) => { lastResult = res; },
      undefined,
      { bufferSize: 1024 }
    );

    // Quiet ambient room buffer
    const quietBuffer = generateSineWave(130.81, sampleRate, 0.021, 0.002);
    (detector as unknown as { processAudioBuffer: (b: Float32Array, t: number) => void }).processAudioBuffer(quietBuffer, 100);

    expect(lastResult).not.toBeNull();
    expect(lastResult!.isSilent).toBe(true);
    expect(lastResult!.note).toBeNull();
  });
});
