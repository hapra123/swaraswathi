export type PitchClass = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

export type Saptak = 'ati-mandra' | 'mandra' | 'madhya' | 'taar' | 'ati-taar';

export interface SwaraDefinition {
  semitoneOffset: number; // 0 to 11
  name: string;          // e.g. "Shadja", "Komal Rishabh", "Shuddha Rishabh"
  shortName: string;     // e.g. "Sa", "re", "Re", "ga", "Ga", "ma", "Ma", "Pa", "dha", "Dha", "ni", "Ni"
  hindiName: string;     // e.g. "सा", "रे॒", "रे", "ग॒", "ग", "म", "म॑", "प", "ध॒", "ध", "नि॒", "नि"
  symbol: string;        // e.g. "S", "r", "R", "g", "G", "m", "Ḿ", "P", "d", "D", "n", "N"
  isKomal: boolean;
  isTivra: boolean;
  isShuddha: boolean;
}

export interface NoteInfo {
  frequency: number;       // Exact detected frequency in Hz
  targetFrequency: number; // Exact frequency of standard 12-TET note
  midiNote: number;        // e.g. 60 for C4
  pitchClass: PitchClass;  // e.g. "C"
  octave: number;          // e.g. 4
  noteName: string;        // e.g. "C4"
  cents: number;           // Tuning deviation in cents (-50 to +50)
  swara: SwaraDefinition;  // Sargam details mapped to current tonic
  saptak: Saptak;          // Octave relative to Tonic
  tonicNote: PitchClass;   // Current active tonic (Sa)
  tonicMidi: number;       // Active tonic reference MIDI
}

export interface TonicOption {
  pitchClass: PitchClass;
  display: string;
  defaultMidi: number; // e.g., C3 = 48, C4 = 60
}
