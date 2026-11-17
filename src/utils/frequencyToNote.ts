import type { PitchClass } from '../types/music';

export const PITCH_CLASSES: PitchClass[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

export const A4_FREQUENCY = 440.0;
export const A4_MIDI = 69;

/**
 * Converts a frequency in Hz to its exact floating-point MIDI number.
 */
export function frequencyToExactMidi(frequency: number, a4 = A4_FREQUENCY): number {
  if (frequency <= 0) return 0;
  return A4_MIDI + 12 * Math.log2(frequency / a4);
}

/**
 * Converts a MIDI note number to its exact standard frequency in Hz.
 */
export function midiToFrequency(midi: number, a4 = A4_FREQUENCY): number {
  return a4 * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Converts frequency in Hz to Western note parameters (pitch class, octave, cents, target frequency).
 */
export function frequencyToWesternNote(frequency: number, a4 = A4_FREQUENCY) {
  if (!frequency || frequency <= 0 || !isFinite(frequency)) {
    return null;
  }

  const exactMidi = frequencyToExactMidi(frequency, a4);
  const roundedMidi = Math.round(exactMidi);
  const cents = Math.round((exactMidi - roundedMidi) * 100);
  const targetFrequency = midiToFrequency(roundedMidi, a4);

  // MIDI 60 is C4. 60 % 12 = 0 -> 'C'. Math.floor(60 / 12) - 1 = 4.
  const pitchIndex = ((roundedMidi % 12) + 12) % 12;
  const pitchClass = PITCH_CLASSES[pitchIndex];
  const octave = Math.floor(roundedMidi / 12) - 1;
  const noteName = `${pitchClass}${octave}`;

  return {
    exactMidi,
    midiNote: roundedMidi,
    pitchClass,
    octave,
    noteName,
    cents,
    targetFrequency
  };
}

/**
 * Parses note string like "C4", "G#3", "Bb4" to MIDI number.
 */
export function noteNameToMidi(noteName: string): number {
  const match = noteName.match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) return 60; // Default C4

  let base = match[1].toUpperCase();
  const acc = match[2];
  const octave = parseInt(match[3], 10);

  let index = PITCH_CLASSES.indexOf(base as PitchClass);
  if (acc === '#') {
    index = (index + 1) % 12;
  } else if (acc === 'b') {
    index = (index - 1 + 12) % 12;
  }

  return (octave + 1) * 12 + index;
}
