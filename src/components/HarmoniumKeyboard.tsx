// src/components/HarmoniumKeyboard.tsx
import React, { useState } from 'react';
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

// Keys from C2 (MIDI 36) to B5 (MIDI 83) = 48 keys
const START_MIDI = 36; // C2
const END_MIDI = 83;   // B5

interface KeyDef {
  midi: number;
  isBlack: boolean;
  pitchClass: string;
  label: string;
}

function buildKeys(): KeyDef[] {
  const PC = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const BLACK = new Set([1,3,6,8,10]);
  const keys: KeyDef[] = [];
  for (let m = START_MIDI; m <= END_MIDI; m++) {
    const idx = ((m % 12) + 12) % 12;
    const pc = PC[idx];
    const oct = Math.floor(m / 12) - 1;
    keys.push({
      midi: m,
      isBlack: BLACK.has(idx),
      pitchClass: pc,
      label: BLACK.has(idx) ? '' : `${pc}${oct}`,
    });
  }
  return keys;
}

const ALL_KEYS = buildKeys();
const WHITE_KEYS = ALL_KEYS.filter(k => !k.isBlack);
const BLACK_KEYS = ALL_KEYS.filter(k => k.isBlack);

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

  const effectiveActiveMidi = pressedMidi ?? propActiveMidi ?? activeNote?.midiNote ?? null;

  const KEY_W = 28;
  const KEY_H = 114;
  const BK_W = 18;
  const BK_H = 72;
  const totalWidth = WHITE_KEYS.length * KEY_W;

  const whiteXMap = new Map<number, number>();
  WHITE_KEYS.forEach((k, i) => whiteXMap.set(k.midi, i * KEY_W));

  function blackKeyX(midi: number): number {
    const whiteNeighbour = whiteXMap.get(midi - 1);
    if (whiteNeighbour !== undefined) return whiteNeighbour + KEY_W - BK_W / 2;
    return 0;
  }

  const handlePointerDown = (midi: number) => {
    setPressedMidi(midi);
    onPlayNote?.(midi);
  };

  const handlePointerUp = () => {
    setPressedMidi(null);
    onStopNote?.();
  };

  return (
    <div className="w-full overflow-x-auto select-none py-1">
      <div className="min-w-fit mx-auto cursor-pointer">
        <svg
          width={totalWidth}
          height={KEY_H + 24}
          viewBox={`0 0 ${totalWidth} ${KEY_H + 24}`}
          className="block mx-auto"
          style={{ maxWidth: '100%' }}
          onMouseLeave={handlePointerUp}
        >
          {/* Wooden Harmonium Frame Top Accent */}
          <rect x="0" y="0" width={totalWidth} height="4" fill="#78350f" rx="1" />

          {/* White keys */}
          {WHITE_KEYS.map(k => {
            const x = whiteXMap.get(k.midi)!;
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
                onTouchStart={() => handlePointerDown(k.midi)}
                onTouchEnd={handlePointerUp}
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
                    transition: 'fill 0.06s ease, transform 0.04s ease',
                    filter: isActive ? 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.6))' : 'none',
                  }}
                />
                <text
                  x={x + KEY_W / 2}
                  y={KEY_H - 4}
                  textAnchor="middle"
                  fontSize="7.5"
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
          {BLACK_KEYS.map(k => {
            const x = blackKeyX(k.midi);
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
                  e.stopPropagation();
                  handlePointerDown(k.midi);
                }}
                onTouchEnd={(e) => {
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

          {/* Legend bar */}
          <text x={4} y={KEY_H + 18} fontSize="9" fill="#71717a" fontFamily="system-ui">
            🎹 Click or tap any key to play • Saffron = Lead Sung Note • Warm Gold = Accompaniment Voicing • Dark Amber = Sa-Pa Drone
          </text>
        </svg>
      </div>
    </div>
  );
};
