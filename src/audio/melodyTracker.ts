// src/audio/melodyTracker.ts
// Advanced Indian Vocal Melody Tracking Engine.
// Distinguishes genuine melodic transitions from vocal vibrato, passing ornaments (kan-swaras),
// continuous glides (meends), and breath pauses.

import type { PitchDetectionResult } from '../types/audio';
import type { NoteInfo } from '../types/music';

export type VocalState = 
  | 'silent'
  | 'breath_pause'
  | 'onset_attack'
  | 'stable_hold'
  | 'meend_glide'
  | 'vibrato_kampa'
  | 'passing_ornament';

export interface ContourPoint {
  time: number;
  freq: number | null;
  midi: number | null;
  cents: number | null;
  confidence: number;
  rms: number;
  vocalState: VocalState;
}

export interface MelodyTrackingState {
  vocalState: VocalState;
  currentDurationMs: number;
  glideVelocitySemitonesPerSec: number;
  contourHistory: ContourPoint[];
  lastStableNote: NoteInfo | null;
  currentNote: NoteInfo | null;
  isLegatoTransition: boolean;
  isSustainedNyasa: boolean; // Held > 750ms on a structural note
}

export class MelodyTracker {
  private history: ContourPoint[] = [];
  private maxHistoryPoints = 180; // ~6 seconds at 30ms

  private lastStableNote: NoteInfo | null = null;
  private currentActiveNote: NoteInfo | null = null;
  private stateStartTime = 0;
  private noteStartTime = 0;
  private currentState: VocalState = 'silent';

  private lastFrequency: number | null = null;
  private lastTime = 0;

  private silenceStartTime: number | null = null;
  private breathTimeoutMs = 700; // In Indian singing, breath intake typically takes 300-600ms

  public update(result: PitchDetectionResult, stableNote: NoteInfo | null): MelodyTrackingState {
    const now = result.timestamp;
    const dt = this.lastTime > 0 ? (now - this.lastTime) / 1000 : 0.012;
    this.lastTime = now;

    let glideVelocity = 0;
    if (this.lastFrequency !== null && result.frequency !== null && dt > 0) {
      const semitoneDelta = 12 * Math.log2(result.frequency / this.lastFrequency);
      glideVelocity = semitoneDelta / dt; // Semitones per second
    }
    this.lastFrequency = result.frequency;

    let isLegato = false;
    let newState: VocalState = 'silent';

    if (result.isSilent || result.frequency === null) {
      if (this.silenceStartTime === null) {
        this.silenceStartTime = now;
      }
      const pauseDuration = now - this.silenceStartTime;

      // Maintain breath pause state so accompanist sustains without dropping
      if (pauseDuration <= this.breathTimeoutMs && this.lastStableNote !== null) {
        newState = 'breath_pause';
      } else {
        newState = 'silent';
        this.currentActiveNote = null;
      }
    } else {
      this.silenceStartTime = null;
      const absVelocity = Math.abs(glideVelocity);

      // Check if entering new note or gliding
      if (absVelocity >= 3.5 && absVelocity <= 28.0) {
        // Continuous vocal glide (Meend)
        newState = 'meend_glide';
      } else if (stableNote !== null) {
        const isDifferentNote = this.currentActiveNote === null || stableNote.midiNote !== this.currentActiveNote.midiNote;

        if (isDifferentNote) {
          isLegato = this.currentActiveNote !== null; // Transitioned without silence = legato
          this.currentActiveNote = stableNote;
          this.lastStableNote = stableNote;
          this.noteStartTime = now;
          newState = 'onset_attack';
        } else {
          // Sustaining the same swara: check vibrato vs steady hold
          const noteDuration = now - this.noteStartTime;
          if (noteDuration < 120) {
            newState = 'passing_ornament';
          } else if (Math.abs(stableNote.cents) > 14 && absVelocity > 0.8) {
            newState = 'vibrato_kampa';
          } else {
            newState = 'stable_hold';
          }
        }
      } else {
        newState = 'meend_glide';
      }
    }

    if (newState !== this.currentState) {
      this.currentState = newState;
      this.stateStartTime = now;
    }

    const currentDurationMs = now - this.stateStartTime;
    const isSustainedNyasa = (this.currentState === 'stable_hold' || this.currentState === 'vibrato_kampa') && (now - this.noteStartTime) >= 750;

    const point: ContourPoint = {
      time: now,
      freq: result.frequency,
      midi: result.note?.midiNote ?? null,
      cents: result.note?.cents ?? null,
      confidence: result.confidence,
      rms: result.rms,
      vocalState: this.currentState,
    };

    this.history.push(point);
    if (this.history.length > this.maxHistoryPoints) {
      this.history.shift();
    }

    return {
      vocalState: this.currentState,
      currentDurationMs,
      glideVelocitySemitonesPerSec: glideVelocity,
      contourHistory: [...this.history],
      lastStableNote: this.lastStableNote,
      currentNote: this.currentActiveNote,
      isLegatoTransition: isLegato,
      isSustainedNyasa,
    };
  }

  public reset(): void {
    this.history = [];
    this.lastStableNote = null;
    this.currentActiveNote = null;
    this.currentState = 'silent';
    this.stateStartTime = 0;
    this.noteStartTime = 0;
    this.lastFrequency = null;
    this.silenceStartTime = null;
  }
}
