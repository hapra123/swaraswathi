// src/audio/droneEngine.ts
// Autonomous Indian Classical Continuous Sa-Pa Drone (Sur) Engine.
// Operates completely independently of melody tracking to maintain unbroken tonal foundation.

import { HarmoniumSampler } from './harmoniumSampler';

export interface DroneConfig {
  enabled: boolean;
  tonicMidi: number;        // MIDI note of reference Sa (e.g. 48 for C3, 60 for C4)
  usePa: boolean;           // true for Pa (fifth / +7 semitones), false for Ma (fourth / +5 semitones)
  includeUpperSa: boolean;  // Optional Taar Sa (+12 semitones)
  droneOctave: 2 | 3;       // Mandra (2) vs Madhya (3) register
  masterVolume: number;     // 0.0 to 1.0
  saVolume: number;         // 0.0 to 1.0
  paVolume: number;         // 0.0 to 1.0
  upperSaVolume: number;    // 0.0 to 1.0
  bellowsSwell: boolean;    // Subtle bellows pumping acoustic air oscillation (~0.18 Hz)
}

const DEFAULT_CONFIG: DroneConfig = {
  enabled: false,
  tonicMidi: 48,
  usePa: true,
  includeUpperSa: true,
  droneOctave: 3,
  masterVolume: 0.45,
  saVolume: 0.85,
  paVolume: 0.70,
  upperSaVolume: 0.40,
  bellowsSwell: true,
};

export class DroneEngine {
  private sampler: HarmoniumSampler;
  private config: DroneConfig;
  private activeDroneMidis: number[] = [];

  constructor(sampler: HarmoniumSampler, initialConfig: Partial<DroneConfig> = {}) {
    this.sampler = sampler;
    this.config = { ...DEFAULT_CONFIG, ...initialConfig };
    if (this.config.enabled) {
      this.applyDrone();
    }
  }

  public updateConfig(changes: Partial<DroneConfig>): void {
    this.config = { ...this.config, ...changes };
    this.applyDrone();
  }

  public setTonic(tonicMidi: number): void {
    this.config.tonicMidi = tonicMidi;
    if (this.config.enabled) {
      this.applyDrone();
    }
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (enabled) {
      this.applyDrone();
    } else {
      this.stop();
    }
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public getConfig(): DroneConfig {
    return { ...this.config };
  }

  public getActiveMidis(): number[] {
    return [...this.activeDroneMidis];
  }

  /**
   * Calculates the exact traditional Indian drone chord (Kharaj Sa + Pa + Taar Sa)
   * and updates the sampler drone channel.
   */
  private applyDrone(): void {
    if (!this.config.enabled) {
      this.stop();
      return;
    }

    // Base Sa note according to selected drone octave
    const semitoneOffsetFromC = ((this.config.tonicMidi % 12) + 12) % 12;
    const baseOctaveMidi = (this.config.droneOctave + 1) * 12 + semitoneOffsetFromC;

    const midis: number[] = [];

    // 1. Foundation Sa (Shadja)
    midis.push(baseOctaveMidi);

    // 2. Pancham (Fifth, +7) or Shuddha Madhyam (Fourth, +5 for ragas without Pa)
    const secondInterval = this.config.usePa ? 7 : 5;
    midis.push(baseOctaveMidi + secondInterval);

    // 3. Optional Taar Sa (+12)
    if (this.config.includeUpperSa) {
      midis.push(baseOctaveMidi + 12);
    }

    this.activeDroneMidis = midis;
    this.sampler.setDrone(midis);
    this.sampler.setDroneVolume(this.config.masterVolume);
  }

  public stop(): void {
    this.activeDroneMidis = [];
    this.sampler.stopDrone();
  }

  public reset(): void {
    this.stop();
  }
}
