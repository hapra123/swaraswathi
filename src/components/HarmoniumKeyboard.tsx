// src/components/HarmoniumKeyboard.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { NoteInfo } from '../types/music';

interface HarmoniumKeyboardProps {
  activeNote?: NoteInfo | null;
  activeMidi?: number | null;
  supportingMidis?: number[];
  droneMidis?: number[];
  tonicMidi: number;
  onPlayNote?: (midi: number) => void;
  onStopNote?: () => void;
}

export type OctaveViewMode = 'auto' | 'madhya' | 'mandra' | 'taar' | 'all';

// Keys from C2 (MIDI 36) to B5 (MIDI 83) = 48 keys
const MIN_MIDI = 36; // C2
const MAX_MIDI = 83; // B5

interface KeyDef {
  midi: number;
  isBlack: boolean;
  pitchClass: string;
  octave: number;
  label: string;
}

function buildAllKeys(): KeyDef[] {
  const PC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const BLACK = new Set([1,3,6,8,10]);
  const keys: KeyDef[] = [];
  for (let m = MIN_MIDI; m <= MAX_MIDI; m++) {
    const idx = ((m % 12) + 12) % 12;
    const pc = PC[idx];
    const oct = Math.floor(m / 12) - 1;
    keys.push({
      midi: m,
      isBlack: BLACK.has(idx),
      pitchClass: pc,
      octave: oct,
      label: BLACK.has(idx) ? '' : `${pc}${oct}`,
    });
  }
  return keys;
}

const ALL_KEYS = buildAllKeys();

export const HarmoniumKeyboard: React.FC<HarmoniumKeyboardProps> = ({
  activeNote,
  activeMidi: propActiveMidi,
  supportingMidis = [],
  droneMidis = [],
  tonicMidi,
  onPlayNote,
  onStopNote,
}) => {
  const [pressedMidi, setPressedMidi] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<OctaveViewMode>('madhya');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const effectiveActiveMidi = pressedMidi ?? propActiveMidi ?? activeNote?.midiNote ?? null;

  // Determine active range based on viewMode
  const { startMidi, endMidi } = useMemo(() => {
    if (viewMode === 'all') {
      return { startMidi: MIN_MIDI, endMidi: MAX_MIDI };
    }
    if (viewMode === 'mandra') {
      return { startMidi: 36, endMidi: 60 }; // C2 to C4
    }
    if (viewMode === 'taar') {
      return { startMidi: 60, endMidi: 83 }; // C4 to B5
    }
    if (viewMode === 'auto') {
      // Center around effective active note or tonic
      const center = effectiveActiveMidi ?? tonicMidi;
      const lower = Math.max(MIN_MIDI, center - 10);
      const upper = Math.min(MAX_MIDI, center + 14);
      return { startMidi: lower, endMidi: upper };
    }
    // Default 'madhya' (middle saptak: C3 to C5)
    return { startMidi: 48, endMidi: 72 };
  }, [viewMode, effectiveActiveMidi, tonicMidi]);

  // Filter keys for current view
  const visibleWhiteKeys = useMemo(
    () => ALL_KEYS.filter(k => !k.isBlack && k.midi >= startMidi && k.midi <= endMidi),
    [startMidi, endMidi]
  );

  const visibleBlackKeys = useMemo(
    () => ALL_KEYS.filter(k => k.isBlack && k.midi >= startMidi && k.midi <= endMidi),
    [startMidi, endMidi]
  );

  // Responsive dimensions
  const isAllKeys = viewMode === 'all';
  const KEY_W = isAllKeys ? 28 : 36;
  const KEY_H = isAllKeys ? 112 : 120;
  const BK_W = isAllKeys ? 18 : 22;
  const BK_H = isAllKeys ? 70 : 76;
  const totalWidth = visibleWhiteKeys.length * KEY_W;

  const whiteXMap = useMemo(() => {
    const map = new Map<number, number>();
    visibleWhiteKeys.forEach((k, i) => map.set(k.midi, i * KEY_W));
    return map;
  }, [visibleWhiteKeys, KEY_W]);

  function getBlackKeyX(midi: number): number {
    const whiteLeft = whiteXMap.get(midi - 1);
    if (whiteLeft !== undefined) {
      return whiteLeft + KEY_W - BK_W / 2;
    }
    const whiteRight = whiteXMap.get(midi + 1);
    if (whiteRight !== undefined) {
      return whiteRight - BK_W / 2;
    }
    return 0;
  }

  // Auto-scroll when active note changes and is in view
  useEffect(() => {
    if (!effectiveActiveMidi || !scrollContainerRef.current) return;
    const x = whiteXMap.get(effectiveActiveMidi) ?? getBlackKeyX(effectiveActiveMidi);
    if (x !== undefined && x > 0) {
      const container = scrollContainerRef.current;
      const scrollTarget = x - container.clientWidth / 2 + KEY_W / 2;
      container.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
    }
  }, [effectiveActiveMidi, whiteXMap]);

  const handlePointerDown = (midi: number) => {
    setPressedMidi(midi);
    onPlayNote?.(midi);
  };

  const handlePointerUp = () => {
    setPressedMidi(null);
    onStopNote?.();
  };

  return (
    <div className="w-full flex flex-col gap-2.5">
      {/* Octave Range Tabs (Mobile-Friendly) */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider px-2 font-semibold">
            Octave
          </span>
          {(
            [
              { id: 'madhya', label: 'Madhya (Mid)' },
              { id: 'mandra', label: 'Mandra (Low)' },
              { id: 'taar',   label: 'Taar (High)' },
              { id: 'all',    label: 'All (48)' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setViewMode(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === tab.id
                  ? 'bg-amber-500 text-black shadow-sm font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Note indicator badge */}
        <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5">
          {effectiveActiveMidi ? (
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              MIDI {effectiveActiveMidi}
            </span>
          ) : (
            <span className="text-zinc-600">Tap key to play</span>
          )}
        </div>
      </div>

      {/* SVG Harmonium Keyboard with Horizontal Scroll */}
      <div
        ref={scrollContainerRef}
        className="w-full overflow-x-auto select-none py-1 scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
      >
        <div className="min-w-fit mx-auto cursor-pointer">
          <svg
            width={totalWidth}
            height={KEY_H + 20}
            viewBox={`0 0 ${totalWidth} ${KEY_H + 20}`}
            className="block mx-auto"
            style={{ maxWidth: '100%', touchAction: 'none' }}
            onMouseLeave={handlePointerUp}
          >
            {/* Wooden Harmonium Frame Top Accent */}
            <rect x="0" y="0" width={totalWidth} height="4" fill="#78350f" rx="1" />

            {/* White keys */}
            {visibleWhiteKeys.map(k => {
              const x = whiteXMap.get(k.midi);
              if (x === undefined) return null;
              const isActive = k.midi === effectiveActiveMidi;
              const isSupporting = supportingMidis.includes(k.midi);
              const isDrone = droneMidis.includes(k.midi);
              const isTonic = (k.midi - tonicMidi) % 12 === 0;

              let fill = '#fcf8ee';
              if (isActive) fill = '#f59e0b';
              else if (isSupporting) fill = '#fbbf24';
              else if (isDrone) fill = '#d97706';
              else if (isTonic) fill = '#fef3c7';

              return (
                <g
                  key={k.midi}
                  onMouseDown={() => handlePointerDown(k.midi)}
                  onMouseUp={handlePointerUp}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handlePointerDown(k.midi);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handlePointerUp();
                  }}
                >
                  <rect
                    x={x + 1}
                    y={4}
                    width={KEY_W - 2}
                    height={KEY_H}
                    rx={3}
                    fill={fill}
                    stroke={isActive ? '#b45309' : '#857870'}
                    strokeWidth={1}
                    style={{
                      transition: 'fill 0.06s ease',
                      filter: isActive ? 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.6))' : 'none',
                    }}
                  />
                  <text
                    x={x + KEY_W / 2}
                    y={KEY_H - 4}
                    textAnchor="middle"
                    fontSize={isAllKeys ? "7.5" : "9"}
                    fontWeight={isTonic || isActive ? 'bold' : 'normal'}
                    fill={isActive ? '#451a03' : isTonic ? '#92400e' : '#78716c'}
                    fontFamily="monospace"
                  >
                    {k.label}
                  </text>
                </g>
              );
            })}

            {/* Black keys */}
            {visibleBlackKeys.map(k => {
              const x = getBlackKeyX(k.midi);
              const isActive = k.midi === effectiveActiveMidi;
              const isSupporting = supportingMidis.includes(k.midi);
              const isDrone = droneMidis.includes(k.midi);

              let fill = '#1c1917';
              if (isActive) fill = '#f59e0b';
              else if (isSupporting) fill = '#d97706';
              else if (isDrone) fill = '#b45309';

              return (
                <rect
                  key={k.midi}
                  x={x}
                  y={4}
                  width={BK_W}
                  height={BK_H}
                  rx={2}
                  fill={fill}
                  stroke={isActive ? '#d97706' : '#0c0a09'}
                  strokeWidth={1}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handlePointerDown(k.midi);
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    handlePointerUp();
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePointerDown(k.midi);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePointerUp();
                  }}
                  style={{
                    transition: 'fill 0.06s ease',
                    filter: isActive ? 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.7))' : 'none',
                  }}
                />
              );
            })}

            {/* Subtle legend */}
            <text x={4} y={KEY_H + 15} fontSize="8.5" fill="#71717a" fontFamily="system-ui">
              🎹 Tap keys to play harmonium • Amber = Sung Note • Gold = Supporting Voicing
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};
