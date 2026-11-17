// src/audio/accompanimentEngine.ts
// Central Musical Intelligence Engine for Swaraswathi.
// Replicates the intuition, restraint, and supportive phrasing of an experienced Indian harmonium player.

import type { MelodyTrackingState } from './melodyTracker';

export type AccompanimentMode = 'drone_only' | 'melody_following' | 'human_accompanist';
export type AccompanimentIntensity = 'gentle' | 'standard' | 'rich';

export interface AccompanimentDecision {
  melodyMidi: number | null;
  supportingMidis: number[];
  droneActive: boolean;
  sustainDuringBreath: boolean;
  voicingDescription: string;
}

export class AccompanimentEngine {
  private mode: AccompanimentMode = 'human_accompanist';
  private intensity: AccompanimentIntensity = 'standard';
  private lastSoundingMidi: number | null = null;
  private lastSoundingSupporting: number[] = [];

  public setMode(mode: AccompanimentMode): void {
    this.mode = mode;
  }

  public getMode(): AccompanimentMode {
    return this.mode;
  }

  public setIntensity(intensity: AccompanimentIntensity): void {
    this.intensity = intensity;
  }

  public getIntensity(): AccompanimentIntensity {
    return this.intensity;
  }

  /**
   * Evaluates the musical situation and decides what the harmonium should play.
   */
  public evaluate(
    melodyState: MelodyTrackingState,
    tonicMidi: number
  ): AccompanimentDecision {
    const { vocalState, currentNote, isSustainedNyasa } = melodyState;

    // ─────────────────────────────────────────────────────────────────────────
    // MODE A: DRONE ONLY
    // ─────────────────────────────────────────────────────────────────────────
    if (this.mode === 'drone_only') {
      this.lastSoundingMidi = null;
      this.lastSoundingSupporting = [];
      return {
        melodyMidi: null,
        supportingMidis: [],
        droneActive: true,
        sustainDuringBreath: false,
        voicingDescription: 'Mode A: Continuous Sa-Pa Drone Foundation',
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODE B: MELODY FOLLOWING (Unison Lead)
    // ─────────────────────────────────────────────────────────────────────────
    if (this.mode === 'melody_following') {
      if (vocalState === 'breath_pause' && this.lastSoundingMidi !== null) {
        return {
          melodyMidi: this.lastSoundingMidi,
          supportingMidis: [],
          droneActive: false,
          sustainDuringBreath: true,
          voicingDescription: 'Holding tone through breath pause',
        };
      }

      if (!currentNote || vocalState === 'silent') {
        this.lastSoundingMidi = null;
        return {
          melodyMidi: null,
          supportingMidis: [],
          droneActive: false,
          sustainDuringBreath: false,
          voicingDescription: 'Silent',
        };
      }

      this.lastSoundingMidi = currentNote.midiNote;
      return {
        melodyMidi: currentNote.midiNote,
        supportingMidis: [],
        droneActive: false,
        sustainDuringBreath: false,
        voicingDescription: `Unison melody: ${currentNote.swara.shortName} (${currentNote.noteName})`,
      };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODE C: HUMAN-LIKE ACCOMPANIST (Default Primary Experience)
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Handle Breath Pause: Sustain previous resting swara or fall back to drone
    if (vocalState === 'breath_pause') {
      if (this.lastSoundingMidi !== null) {
        return {
          melodyMidi: this.lastSoundingMidi,
          supportingMidis: this.lastSoundingSupporting,
          droneActive: true,
          sustainDuringBreath: true,
          voicingDescription: 'Accompanist sustaining through breath pause',
        };
      }
      return {
        melodyMidi: null,
        supportingMidis: [],
        droneActive: true,
        sustainDuringBreath: true,
        voicingDescription: 'Drone supporting pause',
      };
    }

    // 2. Handle Silence (Singer not singing)
    if (vocalState === 'silent' || !currentNote) {
      this.lastSoundingMidi = null;
      this.lastSoundingSupporting = [];
      return {
        melodyMidi: null,
        supportingMidis: [],
        droneActive: true,
        sustainDuringBreath: false,
        voicingDescription: 'Awaiting singer (Sa-Pa drone established)',
      };
    }

    const leadMidi = currentNote.midiNote;
    this.lastSoundingMidi = leadMidi;

    // Filter quick fleeting ornaments (kan-swaras < 80ms) to avoid jittery mechanical playing
    if (vocalState === 'passing_ornament' && this.intensity !== 'rich') {
      return {
        melodyMidi: this.lastSoundingMidi ?? leadMidi,
        supportingMidis: this.lastSoundingSupporting,
        droneActive: true,
        sustainDuringBreath: false,
        voicingDescription: `Holding through ornament (${currentNote.swara.shortName})`,
      };
    }

    // Indian classical harmonic accompaniment rules
    const semitonesFromSa = ((leadMidi - tonicMidi) % 12 + 12) % 12;
    const supporting: number[] = [];
    let desc = `Lead: ${currentNote.swara.shortName}`;

    if (this.intensity === 'gentle') {
      // Gentle: Clean lead melody with Sa-Pa drone bed
      desc += ' (Solo voice)';
    } else if (this.intensity === 'standard') {
      // Standard Bhajan accompaniment:
      // In middle/high register (>= 58), double with lower octave
      if (leadMidi >= 58 && leadMidi - 12 >= 36) {
        supporting.push(leadMidi - 12);
        desc += ' + Octave support';
      }

      // If resting on Sa or Pa (nyasa), provide tonic anchor
      if (isSustainedNyasa && semitonesFromSa === 0) {
        desc += ' (Sa nyasa held)';
      }
    } else if (this.intensity === 'rich') {
      // Rich Concert Accompaniment:
      if (leadMidi >= 56 && leadMidi - 12 >= 36) {
        supporting.push(leadMidi - 12);
      }

      // Consonance bed on resting notes
      if (semitonesFromSa === 0) {
        // Resting on Sa: add Mandra Pa (-5 semitones)
        if (leadMidi - 5 >= 36) supporting.push(leadMidi - 5);
        desc += ' + Sa-Pa consonance bed';
      } else if (semitonesFromSa === 7) {
        // Resting on Pa: add Base Sa (-7 semitones)
        if (leadMidi - 7 >= 36) supporting.push(leadMidi - 7);
        desc += ' + Pancham resting bed';
      } else if (semitonesFromSa === 5) {
        // Resting on Shuddha Ma: add tonic Sa
        if (leadMidi - 5 >= 36) supporting.push(leadMidi - 5);
        desc += ' + Madhyam chord support';
      }
    }

    this.lastSoundingSupporting = supporting;

    return {
      melodyMidi: leadMidi,
      supportingMidis: supporting,
      droneActive: true,
      sustainDuringBreath: false,
      voicingDescription: desc,
    };
  }

  public reset(): void {
    this.lastSoundingMidi = null;
    this.lastSoundingSupporting = [];
  }
}
