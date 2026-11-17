// src/types/accompaniment.ts

export type AccompanimentMode = 
  | 'drone_only'          // Mode A: Pure Sa-Pa drone foundation
  | 'melody_following'    // Mode B: Unison vocal melody following
  | 'human_accompanist';  // Mode C: Primary autonomous Indian harmonium accompanist

export type AccompanimentIntensity = 'gentle' | 'standard' | 'rich';

export interface DroneSettings {
  enabled: boolean;
  masterVolume: number;
  usePa: boolean;
  includeUpperSa: boolean;
  droneOctave: 2 | 3;
}
