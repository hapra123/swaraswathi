// src/components/AudioStatus.tsx
import React from 'react';
import type { MicrophoneStatus } from '../types/audio';

interface AudioStatusProps {
  status: MicrophoneStatus;
  isListening: boolean;
  errorMessage: string | null;
  rms?: number;
}

const STATUS_CONFIG: Record<MicrophoneStatus, { label: string; color: string; dot: string }> = {
  idle:        { label: 'Not connected',      color: 'text-zinc-400',   dot: 'bg-zinc-500' },
  requesting:  { label: 'Requesting access…', color: 'text-amber-400',  dot: 'bg-amber-400 animate-pulse' },
  connected:   { label: 'Microphone ready',   color: 'text-emerald-400',dot: 'bg-emerald-400' },
  denied:      { label: 'Permission denied',  color: 'text-red-400',    dot: 'bg-red-500' },
  error:       { label: 'Microphone error',   color: 'text-red-400',    dot: 'bg-red-500' },
  unsupported: { label: 'Not supported',      color: 'text-red-400',    dot: 'bg-red-500' },
};

export const AudioStatus: React.FC<AudioStatusProps> = ({ status, isListening, errorMessage, rms = 0 }) => {
  const cfg = STATUS_CONFIG[status];
  const rmsPercent = Math.min(100, rms * 500); // scale for display

  return (
    <div className="flex flex-col gap-2">
      {/* Status pill */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
        <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
        {isListening && (
          <span className="ml-2 text-xs text-amber-400 animate-pulse font-semibold tracking-widest uppercase">
            ● Listening
          </span>
        )}
      </div>

      {/* Error message */}
      {errorMessage && (
        <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2 max-w-sm">
          {errorMessage}
        </p>
      )}

      {/* Input level meter */}
      {status === 'connected' && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-zinc-500 w-16 flex-shrink-0">Input level</span>
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden max-w-[160px]">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${rmsPercent}%`,
                background: rmsPercent > 80
                  ? '#ef4444'
                  : rmsPercent > 50
                  ? '#f59e0b'
                  : '#10b981',
              }}
            />
          </div>
          <span className="text-xs text-zinc-600 w-10 text-right">{rmsPercent.toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
};
