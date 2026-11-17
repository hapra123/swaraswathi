// src/components/PitchDisplay.tsx
import React from 'react';
import type { PitchDetectionResult } from '../types/audio';
import type { StableNote } from '../audio/noteStabilizer';

interface PitchDisplayProps {
  raw: PitchDetectionResult | null;
  stable: StableNote | null;
  isListening: boolean;
}

const SAPTAK_LABELS: Record<string, string> = {
  'mandra':    'Mandra (lower octave)',
  'madhya':    'Madhya (middle octave)',
  'taar':      'Taar (upper octave)',
  'ati-mandra':'Ati-Mandra',
  'ati-taar':  'Ati-Taar',
};

export const PitchDisplay: React.FC<PitchDisplayProps> = ({ raw, stable, isListening }) => {
  const freq = raw?.frequency ?? null;
  const confidence = raw?.confidence ?? 0;
  const cents = stable?.note?.cents ?? 0;

  // Confidence arc stroke values
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const confArc = confidence * circumference * 0.75;

  const centsColor = Math.abs(cents) < 10 ? '#10b981' : Math.abs(cents) < 25 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Primary swara display */}
      <div className="relative flex flex-col items-center">
        {/* Confidence ring */}
        <svg width="140" height="140" className="absolute top-0 left-1/2 -translate-x-1/2 -rotate-[135deg]">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#1f2937" strokeWidth="4" />
          <circle
            cx="70" cy="70" r={radius} fill="none"
            stroke={confidence > 0.8 ? '#f59e0b' : confidence > 0.5 ? '#d97706' : '#374151'}
            strokeWidth="4"
            strokeDasharray={`${confArc} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.1s ease' }}
          />
        </svg>

        {/* Large swara letter */}
        <div className="w-[140px] h-[140px] flex flex-col items-center justify-center relative z-10">
          {stable?.note ? (
            <>
              <div
                className="text-6xl font-bold leading-none"
                style={{ color: '#f59e0b', fontFamily: 'Georgia, serif', textShadow: '0 0 32px rgba(245,158,11,0.4)' }}
              >
                {stable.note.swara.shortName}
              </div>
              <div className="text-lg text-amber-200/70 mt-1" style={{ fontFamily: 'serif' }}>
                {stable.note.swara.hindiName}
              </div>
            </>
          ) : (
            <div className="text-4xl text-zinc-700 font-light select-none">
              {isListening ? '…' : '—'}
            </div>
          )}
        </div>
      </div>

      {/* Western note + octave */}
      {stable?.note && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-semibold text-zinc-200 tracking-wider">
            {stable.note.noteName}
          </span>
          <span className="text-xs text-zinc-500 uppercase tracking-widest">
            {SAPTAK_LABELS[stable.note.saptak] ?? stable.note.saptak}
          </span>
        </div>
      )}

      {/* Frequency + cents + confidence row */}
      <div className="flex gap-6 items-center flex-wrap justify-center">
        {/* Frequency */}
        <div className="text-center">
          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Frequency</div>
          <div className="text-xl font-mono font-semibold text-zinc-200">
            {freq ? `${freq.toFixed(1)} Hz` : '—'}
          </div>
        </div>

        {/* Cents deviation */}
        <div className="text-center">
          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Tuning</div>
          <div className="text-xl font-mono font-semibold" style={{ color: centsColor }}>
            {stable?.note ? `${cents >= 0 ? '+' : ''}${cents}¢` : '—'}
          </div>
        </div>

        {/* Confidence */}
        <div className="text-center">
          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Confidence</div>
          <div className="text-xl font-mono font-semibold text-zinc-200">
            {raw ? `${(confidence * 100).toFixed(0)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Full swara name */}
      {stable?.note && (
        <div className="text-sm text-zinc-500 italic">{stable.note.swara.name}</div>
      )}

      {/* Pitch timeline mini-visualiser */}
      <PitchTimeline frequency={freq} />
    </div>
  );
};

// --- Mini pitch history bar ---
const HISTORY_LEN = 60;

const PitchTimeline: React.FC<{ frequency: number | null }> = ({ frequency }) => {
  const historyRef = React.useRef<(number | null)[]>(Array(HISTORY_LEN).fill(null));

  React.useEffect(() => {
    historyRef.current.push(frequency);
    if (historyRef.current.length > HISTORY_LEN) historyRef.current.shift();
  });

  const history = historyRef.current;
  const validFreqs = history.filter((f): f is number => f !== null);
  const minF = validFreqs.length > 0 ? Math.min(...validFreqs) * 0.97 : 200;
  const maxF = validFreqs.length > 0 ? Math.max(...validFreqs) * 1.03 : 1000;
  const range = maxF - minF || 1;

  const W = 300;
  const H = 48;
  const step = W / HISTORY_LEN;

  const points = history
    .map((f, i) => {
      if (f === null) return null;
      const x = i * step;
      const y = H - ((f - minF) / range) * (H - 4) - 2;
      return `${x},${y}`;
    })
    .filter(Boolean);

  if (points.length < 2) {
    return (
      <div className="w-full max-w-[300px] h-12 bg-zinc-900/50 rounded-lg border border-zinc-800/50 flex items-center justify-center">
        <span className="text-xs text-zinc-700">Pitch timeline</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[300px] h-12 bg-zinc-900/50 rounded-lg border border-zinc-800/50 overflow-hidden">
      <svg width={W} height={H} className="w-full h-full">
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.8"
        />
        {/* Current point */}
        {frequency && (() => {
          const x = (HISTORY_LEN - 1) * step;
          const y = H - ((frequency - minF) / range) * (H - 4) - 2;
          return <circle cx={x} cy={y} r={2.5} fill="#f59e0b" />;
        })()}
      </svg>
    </div>
  );
};
