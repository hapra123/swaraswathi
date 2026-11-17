// src/tests/accompanimentEngine.test.ts
import { describe, it, expect } from 'vitest';
import { AccompanimentEngine } from '../audio/accompanimentEngine';
import type { MelodyTrackingState } from '../audio/melodyTracker';
import { mapFrequencyToNoteInfo } from '../utils/sargamMapper';

describe('AccompanimentEngine (Musical Intelligence)', () => {
  const engine = new AccompanimentEngine();
  const tonicMidi = 48; // C3 (Sa)

  const sampleSaNote = mapFrequencyToNoteInfo(130.81, 'C', 3)!; // MIDI 48
  const samplePaNote = mapFrequencyToNoteInfo(196.00, 'C', 3)!; // MIDI 55
  const sampleTaarSaNote = mapFrequencyToNoteInfo(261.63, 'C', 3)!; // MIDI 60

  it('Mode A (Drone Only): keeps drone active and plays no melody keys', () => {
    engine.setMode('drone_only');
    const state: MelodyTrackingState = {
      vocalState: 'stable_hold',
      currentDurationMs: 800,
      currentNote: sampleSaNote,
      lastStableNote: sampleSaNote,
      contourHistory: [],
      isLegatoTransition: false,
      isSustainedNyasa: true,
      glideVelocitySemitonesPerSec: 0,
    };

    const decision = engine.evaluate(state, tonicMidi);
    expect(decision.droneActive).toBe(true);
    expect(decision.melodyMidi).toBeNull();
    expect(decision.supportingMidis).toEqual([]);
    expect(decision.voicingDescription).toContain('Mode A');
  });

  it('Mode B (Melody Following): follows singer melody in unison and sustains during breath pause', () => {
    engine.setMode('melody_following');

    // 1. Singer sings Sa
    const singingState: MelodyTrackingState = {
      vocalState: 'stable_hold',
      currentDurationMs: 400,
      currentNote: samplePaNote,
      lastStableNote: samplePaNote,
      contourHistory: [],
      isLegatoTransition: false,
      isSustainedNyasa: false,
      glideVelocitySemitonesPerSec: 0,
    };

    let decision = engine.evaluate(singingState, tonicMidi);
    expect(decision.melodyMidi).toBe(samplePaNote.midiNote);
    expect(decision.droneActive).toBe(false);

    // 2. Singer takes a breath pause: accompaniment sustains previous note
    const breathState: MelodyTrackingState = {
      vocalState: 'breath_pause',
      currentDurationMs: 150,
      currentNote: null,
      lastStableNote: samplePaNote,
      contourHistory: [],
      isLegatoTransition: false,
      isSustainedNyasa: false,
      glideVelocitySemitonesPerSec: 0,
    };

    decision = engine.evaluate(breathState, tonicMidi);
    expect(decision.melodyMidi).toBe(samplePaNote.midiNote);
    expect(decision.sustainDuringBreath).toBe(true);
  });

  it('Mode C (Human-like Accompanist): plays melody and adds lower octave doubling on upper register sustained notes', () => {
    engine.setMode('human_accompanist');
    engine.setIntensity('standard');

    // High note: Taar Sa (MIDI 60 >= 58) sustained
    const taarSaState: MelodyTrackingState = {
      vocalState: 'stable_hold',
      currentDurationMs: 900,
      currentNote: sampleTaarSaNote,
      lastStableNote: sampleTaarSaNote,
      contourHistory: [],
      isLegatoTransition: false,
      isSustainedNyasa: true,
      glideVelocitySemitonesPerSec: 0,
    };

    const decision = engine.evaluate(taarSaState, tonicMidi);
    expect(decision.melodyMidi).toBe(sampleTaarSaNote.midiNote);
    // Should double in lower octave (60 - 12 = 48)
    expect(decision.supportingMidis).toContain(sampleTaarSaNote.midiNote - 12);
    expect(decision.droneActive).toBe(true);
  });

  it('Mode C (Human-like Accompanist): sustains harmonium tone during breath pause and does not cut out abruptly', () => {
    engine.setMode('human_accompanist');

    // Establish note first
    const singingState: MelodyTrackingState = {
      vocalState: 'stable_hold',
      currentDurationMs: 600,
      currentNote: sampleSaNote,
      lastStableNote: sampleSaNote,
      contourHistory: [],
      isLegatoTransition: false,
      isSustainedNyasa: true,
      glideVelocitySemitonesPerSec: 0,
    };
    engine.evaluate(singingState, tonicMidi);

    // Singer takes a breath
    const breathState: MelodyTrackingState = {
      vocalState: 'breath_pause',
      currentDurationMs: 180,
      currentNote: null,
      lastStableNote: sampleSaNote,
      contourHistory: [],
      isLegatoTransition: false,
      isSustainedNyasa: false,
      glideVelocitySemitonesPerSec: 0,
    };

    const decision = engine.evaluate(breathState, tonicMidi);
    expect(decision.melodyMidi).toBe(sampleSaNote.midiNote);
    expect(decision.sustainDuringBreath).toBe(true);
    expect(decision.droneActive).toBe(true);
  });

  it('Mode C (Human-like Accompanist): filters rapid passing ornaments to prevent chaotic jumping', () => {
    engine.setMode('human_accompanist');

    const ornamentState: MelodyTrackingState = {
      vocalState: 'passing_ornament',
      currentDurationMs: 40,
      currentNote: samplePaNote,
      lastStableNote: sampleSaNote,
      contourHistory: [],
      isLegatoTransition: false,
      isSustainedNyasa: false,
      glideVelocitySemitonesPerSec: 0,
    };

    const decision = engine.evaluate(ornamentState, tonicMidi);
    expect(decision.voicingDescription).toContain('Holding through ornament');
  });
});
