// src/components/MelodyContour.tsx
import React from 'react';
import type { ContourPoint, VocalState } from '../audio/melodyTracker';
import type { NoteInfo } from '../types/music';

interface MelodyContourProps {
  contour: ContourPoint[];
  vocalState: VocalState;
  stateDurationMs: number;
  stableNote: NoteInfo | null;
}

const STATE_CONFIG: Record<VocalState, { label: string; color: string; badgeBg: string }> = {
  silent: { label: 'Silence', color: '#71717a', badgeBg: 'bg-zinc-800 text-zinc-400' },
  breath_pause: { label: 'Breath Pause (Sustaining)', color: '#38bdf8', badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  onset_attack: { label: 'Onset Attack', color: '#34d399', badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  stable_hold: { label: 'Stable Swara (Holding)', color: '#10b981', badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  meend_glide: { label: 'Meend (Continuous Glide)', color: '#f59e0b', badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  vibrato_kampa: { label: 'Vibrato (Kampa)', color: '#a855f7', badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  passing_ornament: { label: 'Passing Ornament (Kan)', color: '#ec4899', badgeBg: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
};

export const MelodyContour: React.FC<MelodyContourProps> = ({
  contour,
  vocalState,
  stateDurationMs,
  stableNote,
}) => {
  const cfg = STATE_CONFIG[vocalState];

  const W = 640;
  const H = 90;

  // Filter valid frequencies
  const validPoints = contour.filter(p => p.freq !== null && p.freq > 0);
  const minF = validPoints.length > 0 ? Math.min(...validPoints.map(p => p.freq!)) * 0.95 : 180;
  const maxF = validPoints.length > 0 ? Math.max(...validPoints.map(p => p.freq!)) * 1.05 : 450;
  const range = maxF - minF || 1;

  const totalPoints = contour.length;
  const step = totalPoints > 1 ? W / Math.max(60, totalPoints - 1) : 1;

  // Generate SVG path points
  const points: { x: number; y: number; state: VocalState }[] = [];
  contour.forEach((p, i) => {
    if (p.freq !== null && p.freq > 0) {
      const x = i * step;
      const y = H - ((p.freq - minF) / range) * (H - 12) - 6;
      points.push({ x, y, state: p.vocalState });
    }
  });

  const polylineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
            Melody Contour & Inflection Tracking
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${cfg.badgeBg}`}>
            {cfg.label} ({stateDurationMs > 0 ? `${(stateDurationMs / 1000).toFixed(1)}s` : '0s'})
          </span>
        </div>

        {stableNote && (
          <div className="text-xs text-amber-400 font-medium">
            Active: <span className="font-bold">{stableNote.swara.shortName}</span> ({stableNote.noteName})
          </div>
        )}
      </div>

      {/* SVG Canvas */}
      <div className="w-full h-[90px] bg-zinc-950/70 rounded-xl overflow-hidden relative border border-zinc-800/60">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Pitch Grid lines */}
          <line x1="0" y1={H * 0.25} x2={W} y2={H * 0.25} stroke="#27272a" strokeDasharray="3 3" />
          <line x1="0" y1={H * 0.50} x2={W} y2={H * 0.50} stroke="#27272a" strokeDasharray="3 3" />
          <line x1="0" y1={H * 0.75} x2={W} y2={H * 0.75} stroke="#27272a" strokeDasharray="3 3" />

          {/* Continuous Melodic Contour */}
          {points.length > 1 && (
            <polyline
              points={polylineStr}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          )}

          {/* Current Trajectory Head */}
          {points.length > 0 && (
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="4.5"
              fill={cfg.color}
              stroke="#000"
              strokeWidth="1.5"
            />
          )}
        </svg>

        {points.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-600 font-mono">
            Sing into your microphone to view vocal pitch contour & meends
          </div>
        )}
      </div>
    </div>
  );
};
