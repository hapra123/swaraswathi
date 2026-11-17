// src/components/AudioControls.tsx
import React, { useState } from 'react';
import type { AccompanimentMode, AccompanimentIntensity } from '../types/accompaniment';
import type { RhythmAnalysis } from '../audio/rhythmEngine';
import type { FeedbackSuppressionConfig } from '../types/audio';

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
  feedbackConfig: FeedbackSuppressionConfig;
  onFeedbackConfigChange: (cfg: Partial<FeedbackSuppressionConfig>) => void;
  isFeedbackSuppressed?: boolean;
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
  feedbackConfig,
  onFeedbackConfigChange,
  isFeedbackSuppressed = false,
}) => {
  const [showMixerSettings, setShowMixerSettings] = useState(false);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xl shadow-black/40">
      
      {/* ── Top Header & Musical Voicing Status ── */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
            <span>🪗 Accompaniment</span>
          </h3>
          {/* Live tempo & tempo category badge */}
          <span className="text-[10px] sm:text-[11px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full bg-amber-400 ${rhythm.isOnset ? 'scale-150 animate-ping' : ''}`} />
            {rhythm.estimatedBpm ? `${rhythm.estimatedBpm} BPM` : 'Free Alaap'}
            <span className="text-zinc-500 font-sans uppercase text-[9px] ml-0.5">({rhythm.tempoCategory})</span>
          </span>
        </div>

        <div className="text-[11px] text-zinc-400 truncate max-w-[200px] sm:max-w-none">
          Voicing: <span className="text-amber-400 font-medium">{voicingDescription}</span>
        </div>
      </div>

      {/* ── 3 Operating Modes: Mobile-Friendly Pill Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Mode C: Human Accompanist */}
        <button
          onClick={() => onAccompanimentModeChange('human_accompanist')}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
            accompanimentMode === 'human_accompanist'
              ? 'bg-amber-500/20 border-amber-500 text-amber-200 shadow-md shadow-amber-900/20 ring-1 ring-amber-400/40'
              : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
              <span>🪗 Accompanist</span>
            </span>
            {accompanimentMode === 'human_accompanist' && (
              <span className="text-amber-400 text-[10px] font-bold">★ Active</span>
            )}
          </div>
          <p className="text-[10px] sm:text-[11px] text-zinc-400 leading-snug">
            Drone + vocal melody tracking + supporting chords.
          </p>
        </button>

        {/* Mode B: Melody Following */}
        <button
          onClick={() => onAccompanimentModeChange('melody_following')}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
            accompanimentMode === 'melody_following'
              ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/30 text-amber-200'
              : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span>🎵 Melody Lead</span>
            </span>
            {accompanimentMode === 'melody_following' && <span className="text-amber-400 text-[10px]">● Active</span>}
          </div>
          <p className="text-[10px] sm:text-[11px] text-zinc-500 leading-snug">
            Single harmonium lead reed following your singing.
          </p>
        </button>

        {/* Mode A: Drone Only */}
        <button
          onClick={() => onAccompanimentModeChange('drone_only')}
          className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
            accompanimentMode === 'drone_only'
              ? 'bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/30 text-amber-200'
              : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span>🪕 Drone Only</span>
            </span>
            {accompanimentMode === 'drone_only' && <span className="text-amber-400 text-[10px]">● Active</span>}
          </div>
          <p className="text-[10px] sm:text-[11px] text-zinc-500 leading-snug">
            Steady acoustic Sa-Pa sur foundation for riyaz.
          </p>
        </button>
      </div>

      {/* ── Quick Sa-Pa Drone Control Bar ── */}
      <div className="flex items-center justify-between bg-zinc-950/70 p-2.5 sm:p-3 rounded-xl border border-zinc-800/70 flex-wrap gap-2.5">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleDrone}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              isDroneOn
                ? 'bg-amber-500 border-amber-400 text-black font-bold shadow-md shadow-amber-900/40'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-amber-600'
            }`}
          >
            <span>🪕</span>
            Sa-{droneUsePa ? 'Pa' : 'Ma'} Drone ({tonicName}): {isDroneOn ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => onDroneUsePaChange(!droneUsePa)}
            className="text-[11px] px-2 py-1 bg-zinc-900 border border-zinc-700/60 rounded-md text-zinc-300 hover:text-amber-300"
            title="Toggle between Fifth (Pa) and Fourth (Ma)"
          >
            {droneUsePa ? 'Pa (5th)' : 'Ma (4th)'}
          </button>
        </div>

        {/* Quick Drone Volume */}
        <div className="flex items-center gap-2 text-xs flex-1 sm:flex-initial sm:min-w-[160px] justify-end">
          <span className="text-zinc-500 text-[11px]">Vol:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={droneVolume}
            onChange={(e) => onDroneVolumeChange(parseFloat(e.target.value))}
            className="accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer w-20 sm:w-28"
          />
          <span className="font-mono text-zinc-400 text-[11px] w-8 text-right">
            {(droneVolume * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* ── Expandable Mixer & Speaker Anti-Feedback Drawer ── */}
      <div>
        <button
          onClick={() => setShowMixerSettings(prev => !prev)}
          className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors py-1"
        >
          <span>{showMixerSettings ? '▼' : '▶'}</span>
          <span>⚙️ Sound Mixer & Phone Speaker Settings</span>
          {isFeedbackSuppressed && (
            <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.2 rounded-full font-semibold animate-pulse">
              Bleed Shield Active
            </span>
          )}
        </button>

        {showMixerSettings && (
          <div className="mt-3 flex flex-col gap-4 bg-zinc-950/80 p-4 rounded-xl border border-zinc-800/80">
            {/* 3-Channel Volume Mixer */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Master Volume */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-300 font-medium">Master Volume</span>
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
              <div className="flex flex-col gap-1">
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

              {/* Voicing Intensity */}
              <div className="flex flex-col gap-1">
                <span className="text-zinc-300 text-xs font-medium">Voicing Chords</span>
                <div className="grid grid-cols-3 gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                  {(['gentle', 'standard', 'rich'] as AccompanimentIntensity[]).map((i) => (
                    <button
                      key={i}
                      onClick={() => onAccompanimentIntensityChange(i)}
                      className={`py-1 rounded text-[10px] font-semibold capitalize transition-all ${
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
            </div>

            {/* Drone Octave & Mode */}
            <div className="flex items-center justify-between text-xs border-t border-zinc-800/60 pt-3 flex-wrap gap-2">
              <span className="text-zinc-400 font-medium">Drone Octave Base:</span>
              <div className="flex gap-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                <button
                  onClick={() => onDroneOctaveChange(2)}
                  className={`px-3 py-0.5 text-xs rounded ${droneOctave === 2 ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400'}`}
                >
                  Octave 2 (Kharaj Low)
                </button>
                <button
                  onClick={() => onDroneOctaveChange(3)}
                  className={`px-3 py-0.5 text-xs rounded ${droneOctave === 3 ? 'bg-amber-500 text-black font-bold' : 'text-zinc-400'}`}
                >
                  Octave 3 (Madhya Mid)
                </button>
              </div>
            </div>

            {/* Phone Speaker Anti-Feedback Controls */}
            <div className="border-t border-zinc-800/60 pt-3 flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <span>📱 Phone Speaker Anti-Feedback</span>
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                  Hardware AEC + 4-Layer VAD
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {/* Audio Output Mode */}
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-400">Audio Output</span>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-zinc-900 rounded-lg border border-zinc-800">
                    <button
                      onClick={() => onFeedbackConfigChange({ outputMode: 'speaker', enabled: true })}
                      className={`py-1 px-1 rounded text-[11px] font-medium transition-all ${
                        feedbackConfig.outputMode === 'speaker'
                          ? 'bg-amber-500 text-black font-bold shadow'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      📱 Phone
                    </button>
                    <button
                      onClick={() => onFeedbackConfigChange({ outputMode: 'headphones', enabled: false })}
                      className={`py-1 px-1 rounded text-[11px] font-medium transition-all ${
                        feedbackConfig.outputMode === 'headphones'
                          ? 'bg-amber-500 text-black font-bold shadow'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      🎧 Earphones
                    </button>
                  </div>
                </div>

                {/* Mic Sensitivity */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Sensitivity</span>
                    <span className="font-mono text-zinc-300">{feedbackConfig.sensitivity.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={feedbackConfig.sensitivity}
                    onChange={(e) => onFeedbackConfigChange({ sensitivity: parseFloat(e.target.value) })}
                    className="accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Noise Gate */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Noise Floor</span>
                    <span className="font-mono text-zinc-300">{(feedbackConfig.noiseGateThreshold * 1000).toFixed(0)} mRMS</span>
                  </div>
                  <input
                    type="range"
                    min="0.002"
                    max="0.020"
                    step="0.001"
                    value={feedbackConfig.noiseGateThreshold}
                    onChange={(e) => onFeedbackConfigChange({ noiseGateThreshold: parseFloat(e.target.value) })}
                    className="accent-amber-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};
