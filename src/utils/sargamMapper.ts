// src/utils/sargamMapper.ts
// Maps a detected MIDI note number to Indian Sargam notation relative to the user's chosen tonic.

import type { SwaraDefinition, NoteInfo, PitchClass, Saptak } from '../types/music';
import { frequencyToWesternNote } from './frequencyToNote';

// All 12 swaras in Indian classical music, indexed by semitone offset from Sa (0–11)
export const SWARA_TABLE: SwaraDefinition[] = [
  { semitoneOffset: 0,  name: 'Shadja',           shortName: 'Sa',   hindiName: 'सा',   symbol: 'S',  isKomal: false, isTivra: false, isShuddha: true  },
  { semitoneOffset: 1,  name: 'Komal Rishabh',    shortName: 're',   hindiName: 'रे॒',  symbol: 'r',  isKomal: true,  isTivra: false, isShuddha: false },
  { semitoneOffset: 2,  name: 'Shuddha Rishabh',  shortName: 'Re',   hindiName: 'रे',   symbol: 'R',  isKomal: false, isTivra: false, isShuddha: true  },
  { semitoneOffset: 3,  name: 'Komal Gandhar',    shortName: 'ga',   hindiName: 'ग॒',   symbol: 'g',  isKomal: true,  isTivra: false, isShuddha: false },
  { semitoneOffset: 4,  name: 'Shuddha Gandhar',  shortName: 'Ga',   hindiName: 'ग',    symbol: 'G',  isKomal: false, isTivra: false, isShuddha: true  },
  { semitoneOffset: 5,  name: 'Shuddha Madhyam',  shortName: 'Ma',   hindiName: 'म',    symbol: 'M',  isKomal: false, isTivra: false, isShuddha: true  },
  { semitoneOffset: 6,  name: 'Tivra Madhyam',    shortName: "Ma'",  hindiName: 'म॑',   symbol: 'Ḿ',  isKomal: false, isTivra: true,  isShuddha: false },
  { semitoneOffset: 7,  name: 'Pancham',          shortName: 'Pa',   hindiName: 'प',    symbol: 'P',  isKomal: false, isTivra: false, isShuddha: true  },
  { semitoneOffset: 8,  name: 'Komal Dhaivat',    shortName: 'dha',  hindiName: 'ध॒',   symbol: 'd',  isKomal: true,  isTivra: false, isShuddha: false },
  { semitoneOffset: 9,  name: 'Shuddha Dhaivat',  shortName: 'Dha',  hindiName: 'ध',    symbol: 'D',  isKomal: false, isTivra: false, isShuddha: true  },
  { semitoneOffset: 10, name: 'Komal Nishad',     shortName: 'ni',   hindiName: 'नि॒',  symbol: 'n',  isKomal: true,  isTivra: false, isShuddha: false },
  { semitoneOffset: 11, name: 'Shuddha Nishad',   shortName: 'Ni',   hindiName: 'नि',   symbol: 'N',  isKomal: false, isTivra: false, isShuddha: true  },
];

// Map pitch class string to semitone (0=C)
const PITCH_CLASS_SEMITONE: Record<PitchClass, number> = {
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
};

function getSaptak(semitonesFromSa: number): Saptak {
  if (semitonesFromSa < -24) return 'ati-mandra';
  if (semitonesFromSa < -12) return 'mandra';
  if (semitonesFromSa < 0)   return 'mandra';
  if (semitonesFromSa < 12)  return 'madhya';
  if (semitonesFromSa < 24)  return 'taar';
  return 'ati-taar';
}

/**
 * Map a detected frequency to full NoteInfo with Indian Sargam.
 * @param frequency - Detected frequency in Hz
 * @param tonicPitchClass - Current tonic (Sa) pitch class, e.g. 'C', 'G#'
 * @param tonicOctave - Octave of the reference Sa (default 3 for C3)
 */
export function mapFrequencyToNoteInfo(
  frequency: number,
  tonicPitchClass: PitchClass,
  tonicOctave = 3
): NoteInfo | null {
  const western = frequencyToWesternNote(frequency);
  if (!western) return null;

  const tonicSemitone = PITCH_CLASS_SEMITONE[tonicPitchClass];
  // MIDI of tonic reference
  const tonicMidi = (tonicOctave + 1) * 12 + tonicSemitone;

  const semitonesFromSa = western.midiNote - tonicMidi;
  // Normalize to 0–11 within an octave
  const swaraIndex = ((semitonesFromSa % 12) + 12) % 12;
  const swara = SWARA_TABLE[swaraIndex];
  const saptak = getSaptak(semitonesFromSa);

  return {
    frequency,
    targetFrequency: western.targetFrequency,
    midiNote: western.midiNote,
    pitchClass: western.pitchClass,
    octave: western.octave,
    noteName: western.noteName,
    cents: western.cents,
    swara,
    saptak,
    tonicNote: tonicPitchClass,
    tonicMidi,
  };
}

export { SWARA_TABLE as SWARAS };
