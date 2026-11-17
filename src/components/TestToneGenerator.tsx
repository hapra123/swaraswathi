// src/components/TestToneGenerator.tsx
import React, { useState, useRef, useEffect } from 'react';
import { AudioEngine } from '../audio/audioEngine';

interface TestTone {
  name: string;
  swara: string;
  freq: number;
}

const TEST_TONES: TestTone[] = [
  { name: 'C4', swara: 'Sa (Madhya)', freq: 261.63 },
  { name: 'D4', swara: 'Re (Shuddha)', freq: 293.66 },
  { name: 'E4', swara: 'Ga (Shuddha)', freq: 329.63 },
  { name: 'G4', swara: 'Pa (Pancham)', freq: 392.00 },
  { name: 'A4', swara: 'Dha (Concert)', freq: 440.00 },
];

export const TestToneGenerator: React.FC = () => {
  const [playingFreq, setPlayingFreq] = useState<number | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const stopTone = () => {
    if (oscRef.current) {
      try {
        oscRef.current.stop();
        oscRef.current.disconnect();
      } catch {}
      oscRef.current = null;
    }
    setPlayingFreq(null);
  };

  const playTone = async (freq: number) => {
    stopTone();
    try {
      const engine = AudioEngine.getInstance();
      await engine.resume();
      
      const osc = engine.context.createOscillator();
      const gain = engine.context.createGain();
      
      // Use triangle or sine wave for clear fundamental harmonic test
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, engine.context.currentTime);
      
      // Gentle volume
      gain.gain.setValueAtTime(0.15, engine.context.currentTime);
      
      osc.connect(gain);
      gain.connect(engine.context.destination);
      
      osc.start();
      oscRef.current = osc;
      gainRef.current = gain;
      setPlayingFreq(freq);
    } catch (err) {
      console.error('Failed to play test tone:', err);
    }
  };

  useEffect(() => {
    return () => {
      stopTone();
    };
  }, []);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs uppercase tracking-widest text-amber-500 font-semibold">
            Validation Mode (Audio Test Tones)
          </span>
          <p className="text-xs text-zinc-500">
            Play standard frequencies into your mic/room to verify pitch accuracy & Sargam mapping:
          </p>
        </div>
        {playingFreq && (
          <button
            onClick={stopTone}
            className="text-xs px-3 py-1 bg-red-900/50 hover:bg-red-800 border border-red-700 text-red-200 rounded-lg transition-colors"
          >
            Stop Tone
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TEST_TONES.map(t => {
          const isPlaying = playingFreq === t.freq;
          return (
            <button
              key={t.name}
              onClick={() => isPlaying ? stopTone() : playTone(t.freq)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
                isPlaying
                  ? 'bg-amber-500 border-amber-400 text-black font-semibold ring-2 ring-amber-500/30'
                  : 'bg-zinc-800 border-zinc-700/60 text-zinc-300 hover:border-amber-600 hover:text-amber-300'
              }`}
            >
              <span className="font-bold">{t.name}</span>
              <span className="text-[10px] opacity-75">({t.freq} Hz)</span>
              <span className="text-[10px] text-amber-400/90 font-sans ml-1">{t.swara}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
