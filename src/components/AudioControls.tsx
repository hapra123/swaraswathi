// src/components/AudioControls.tsx
import React from 'react';
import type { AccompanimentMode, AccompanimentIntensity } from '../types/accompaniment';
import type { RhythmAnalysis } from '../audio/rhythmEngine';

interface AudioControlsProps {
  accompanimentMode: AccompanimentMode;
  onAccompanimentModeChange: (m: AccompanimentMode) => void;
  accompanimentIntensity: AccompanimentIntensity;
  onAccompanimentIntensityChange: (i: AccompanimentIntensity) => void;
  isDroneOn: boolean;
  onToggleDrone: () => void;
  droneUsePa: boolean;
  onDroneUsePaChange: (usePa: boolean) => void;
  droneOctave: 2 | 3;
  onDroneOctaveChange: (oct: 2 | 3) => void;
  masterVolume: number;
  onMasterVolumeChange: (v: number) => void;
  melodyVolume: number;
  onMelodyVolumeChange: (v: number) => void;
  droneVolume: number;
  onDroneVolumeChange: (v: number) => void;
  rhythm: RhythmAnalysis;
  voicingDescription: string;
  tonicName: string;
}

export const AudioControls: React.FC<AudioControlsProps> = ({
  accompanimentMode,
  onAccompanimentModeChange,
  accompanimentIntensity,
  onAccompanimentIntensityChange,
  isDroneOn,
  onToggleDrone,
  droneUsePa,
  onDroneUsePaChange,
  droneOctave,
  onDroneOctaveChange,
  masterVolume,
  onMasterVolumeChange,
  melodyVolume,
  onMelodyVolumeChange,
  droneVolume,
  onDroneVolumeChange,
  rhythm,
  voicingDescription,
  tonicName,
}) => {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-5 flex flex-col gap-6 shadow-xl shadow-black/40">
      
      {/* ── Top Header & Musical Status ── */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-zinc-100 tracking-wide flex items-center gap-2">
              <span>🪗 Accompaniment Intelligence</span>
            </h3>
            {/* Live tempo & tempo category badge */}
            <span className="text-[11px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full bg-amber-400 ${rhythm.isOnset ? 'scale-150 animate-ping' : ''}`} />
              {rhythm.estimatedBpm ? `${rhythm.estimatedBpm} BPM` : 'Free Alaap'}
              <span className="text-zinc-500 font-sans uppercase text-[9px] ml-0.5">({rhythm.tempoCategory})</span>
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Musical Voicing: <span className="text-amber-400 font-medium">{voicingDescription}</span>
          </p>
        </div>

        {/* Sa-Pa Drone Master Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleDrone}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
              isDroneOn
                ? 'bg-amber-500 border-amber-400 text-black font-bold shadow-lg shadow-amber-900/40 ring-1 ring-amber-400/50'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-amber-600'
            }`}
          >
            <span>🪗</span>
            Sa-{droneUsePa ? 'Pa' : 'Ma'} Drone ({tonicName}): {isDroneOn ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* ── 3 Operating Modes Selection ── */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
          Accompaniment Operating Mode
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Mode A: Drone Only */}
          <button
            onClick={() => onAccompanimentModeChange('drone_only')}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
              accompanimentMode === 'drone_only'
                ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/30 text-amber-200'
                : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">Mode A: Drone Only</span>
              {accompanimentMode === 'drone_only' && <span className="text-amber-400 text-xs">● Active</span>}
            </div>
            <p className="text-[11px] text-zinc-500 leading-snug">
              Continuous Sa-Pa tonal foundation. Perfect for meditation or pure vocal practice.
            </p>
          </button>

          {/* Mode B: Melody Following */}
          <button
            onClick={() => onAccompanimentModeChange('melody_following')}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
              accompanimentMode === 'melody_following'
                ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/30 text-amber-200'
                : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">Mode B: Melody Following</span>
              {accompanimentMode === 'melody_following' && <span className="text-amber-400 text-xs">● Active</span>}
            </div>
            <p className="text-[11px] text-zinc-500 leading-snug">
              Plays unison lead harmonium following the vocal line with natural legato.
            </p>
          </button>

          {/* Mode C: Human-like Accompanist */}
          <button
            onClick={() => onAccompanimentModeChange('human_accompanist')}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
              accompanimentMode === 'human_accompanist'
                ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-md shadow-amber-900/20 ring-1 ring-amber-400/40'
                : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Mode C: Human Accompanist
              </span>
              {accompanimentMode === 'human_accompanist' && (
                <span className="text-amber-400 text-xs font-bold">★ Primary</span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 leading-snug">
              Establishes drone, tracks melody, supports resting swaras, & breathes with the singer.
            </p>
          </button>
        </div>
      </div>

      {/* ── Accompaniment Voicing & Drone Settings ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950/70 p-4 rounded-xl border border-zinc-800/70">
        
        {/* Voicing Intensity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
            Accompaniment Voicing Intensity
          </label>
          <div className="grid grid-cols-3 gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
            {(['gentle', 'standard', 'rich'] as AccompanimentIntensity[]).map((i) => (
              <button
                key={i}
                onClick={() => onAccompanimentIntensityChange(i)}
                className={`py-1.5 rounded text-[11px] font-semibold capitalize transition-all ${
                  accompanimentIntensity === i
                    ? 'bg-amber-500 text-black shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* Drone Fifth vs Fourth & Octave */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-zinc-400 uppercase tracking-wider font-medium">
            Drone Tuning (Sur Stops)
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => onDroneUsePaChange(true)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                droneUsePa
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Sa-Pa (Fifth)
            </button>
            <button
              onClick={() => onDroneUsePaChange(false)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                !droneUsePa
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Sa-Ma (Fourth)
            </button>
            <div className="flex gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 items-center px-1">
              <span className="text-[10px] text-zinc-500">Oct:</span>
              <button
                onClick={() => onDroneOctaveChange(2)}
                className={`px-2 py-0.5 text-xs rounded ${droneOctave === 2 ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400'}`}
              >
                2
              </button>
              <button
                onClick={() => onDroneOctaveChange(3)}
                className={`px-2 py-0.5 text-xs rounded ${droneOctave === 3 ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400'}`}
              >
                3
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3-Channel Volume Mixer ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Master Volume */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-300 font-medium">Master Harmonium</span>
            <span className="font-mono text-zinc-400">{(masterVolume * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            className="accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Melody Reed Volume */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-300 font-medium">Melody Reeds</span>
            <span className="font-mono text-zinc-400">{(melodyVolume * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={melodyVolume}
            onChange={(e) => onMelodyVolumeChange(parseFloat(e.target.value))}
            className="accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Drone (Sur) Volume */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-zinc-300 font-medium">Continuous Sa-Pa Drone</span>
            <span className="font-mono text-zinc-400">{(droneVolume * 100).toFixed(0)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={droneVolume}
            onChange={(e) => onDroneVolumeChange(parseFloat(e.target.value))}
            className="accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
