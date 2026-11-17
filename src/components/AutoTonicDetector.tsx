// src/components/AutoTonicDetector.tsx
import React from 'react';
import type { TonicEstimationResult } from '../audio/tonicDetector';
import type { PitchClass } from '../types/music';

interface AutoTonicDetectorProps {
  isAutoDetectOn: boolean;
  onToggleAutoDetect: () => void;
  estimation: TonicEstimationResult;
  currentTonic: PitchClass;
  onApplyTonic: (tonic: PitchClass) => void;
}

export const AutoTonicDetector: React.FC<AutoTonicDetectorProps> = ({
  isAutoDetectOn,
  onToggleAutoDetect,
  estimation,
  currentTonic,
  onApplyTonic,
}) => {
  const confPercent = Math.round(estimation.confidence * 100);
  const isCandidateDifferent = estimation.estimatedTonic !== currentTonic;
  const isHighConfidence = confPercent >= 60;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
            Automatic Tonic (Sa) Identification
          </span>
          <button
            onClick={onToggleAutoDetect}
            className={`text-xs px-2.5 py-0.5 rounded-full border transition-all ${
              isAutoDetectOn
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Auto Sa: {isAutoDetectOn ? 'ACTIVE' : 'OFF'}
          </button>
        </div>

        {/* Confidence meter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Confidence:</span>
          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${confPercent}%`,
                backgroundColor: isHighConfidence ? '#10b981' : confPercent > 35 ? '#f59e0b' : '#71717a',
              }}
            />
          </div>
          <span className="font-mono text-zinc-400">{confPercent}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between bg-zinc-950/60 rounded-xl px-4 py-2.5 border border-zinc-800/60 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">Estimated Sa:</span>
          <span className="text-base font-bold text-amber-400 font-mono">
            {estimation.estimatedTonic}
          </span>
          <span className="text-xs text-zinc-500">
            (Current Sa is <span className="font-semibold text-zinc-300">{currentTonic}</span>)
          </span>
        </div>

        {isCandidateDifferent && (
          <button
            onClick={() => onApplyTonic(estimation.estimatedTonic)}
            disabled={!isHighConfidence && !isAutoDetectOn}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              isHighConfidence
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-900/30'
                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Apply Sa = {estimation.estimatedTonic}
          </button>
        )}
      </div>
    </div>
  );
};
