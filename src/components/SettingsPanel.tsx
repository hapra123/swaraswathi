// src/components/SettingsPanel.tsx
import React from 'react';
import type { PitchClass } from '../types/music';

const TONIC_OPTIONS: { value: PitchClass; label: string }[] = [
  { value: 'C',  label: 'C  (Sa = C)' },
  { value: 'C#', label: 'C# / D♭' },
  { value: 'D',  label: 'D' },
  { value: 'D#', label: 'D# / E♭' },
  { value: 'E',  label: 'E' },
  { value: 'F',  label: 'F' },
  { value: 'F#', label: 'F# / G♭' },
  { value: 'G',  label: 'G  (most common Sa)' },
  { value: 'G#', label: 'G# / A♭' },
  { value: 'A',  label: 'A' },
  { value: 'A#', label: 'A# / B♭' },
  { value: 'B',  label: 'B' },
];

const OCTAVE_OPTIONS = [2, 3, 4] as const;

interface SettingsPanelProps {
  tonic: PitchClass;
  tonicOctave: number;
  onTonicChange: (t: PitchClass) => void;
  onOctaveChange: (o: number) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  tonic, tonicOctave, onTonicChange, onOctaveChange
}) => {
  return (
    <div className="flex flex-wrap gap-6 items-end">
      {/* Tonic / Sa selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
          Sa (Tonic)
        </label>
        <select
          value={tonic}
          onChange={e => onTonicChange(e.target.value as PitchClass)}
          className="bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
        >
          {TONIC_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Octave selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
          Sa Octave
        </label>
        <div className="flex gap-1">
          {OCTAVE_OPTIONS.map(o => (
            <button
              key={o}
              onClick={() => onOctaveChange(o)}
              className={`w-10 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                tonicOctave === o
                  ? 'bg-amber-500 border-amber-400 text-black'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-amber-600 hover:text-zinc-200'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
