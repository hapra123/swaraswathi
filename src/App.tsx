// src/App.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { useMicrophone } from './hooks/useMicrophone';
import { usePitchDetection } from './hooks/usePitchDetection';
import { useHarmonium } from './hooks/useHarmonium';
import { useMelodyTracking } from './hooks/useMelodyTracking';
import { AudioStatus } from './components/AudioStatus';
import { PitchDisplay } from './components/PitchDisplay';
import { HarmoniumKeyboard } from './components/HarmoniumKeyboard';
import { SettingsPanel } from './components/SettingsPanel';
import { AudioControls } from './components/AudioControls';
import { MelodyContour } from './components/MelodyContour';
import { AutoTonicDetector } from './components/AutoTonicDetector';
import { LatencyDiagnosticsPanel } from './components/LatencyDiagnosticsPanel';
import { TestToneGenerator } from './components/TestToneGenerator';
import type { PitchClass } from './types/music';
import type { StableNote } from './audio/noteStabilizer';
import type { PitchDetectionResult } from './types/audio';
import { AudioEngine } from './audio/audioEngine';
import { midiToFrequency } from './utils/frequencyToNote';

function App() {
  const [tonic, setTonic] = useState<PitchClass>('C');
  const [tonicOctave, setTonicOctave] = useState<number>(3);
  const [isListening, setIsListening] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // 1. Microphone capture
  const { status, sourceNode, errorMessage, startMicrophone, stopMicrophone } = useMicrophone();

  const tonicMidi = (tonicOctave + 1) * 12 + ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(tonic);

  // 3. Musical Intelligence: Melody & Tonic Tracking
  const {
    vocalState,
    stateDurationMs,
    contourHistory,
    melodyState,
    tonicEstimation,
    isAutoDetectTonic,
    toggleAutoDetectTonic,
    processFrame,
  } = useMelodyTracking(tonic, (autoTonic) => {
    setTonic(autoTonic);
  });

  // 4. Harmonium Sound Engine & Accompaniment Hook (Phases 2, 3, 5, 6)
  const {
    accompanimentMode,
    accompanimentIntensity,
    setAccompanimentMode,
    setAccompanimentIntensity,
    isDroneOn,
    toggleDrone,
    setDroneUsePa,
    droneUsePa,
    droneOctave,
    setDroneOctave,
    masterVolume,
    melodyVolume,
    droneVolume,
    setMasterVolume,
    setMelodyVolume,
    setDroneVolume,
    activeMelodyMidi,
    activeSupportingMidis,
    activeDroneMidis,
    voicingDescription,
    rhythm,
    playManualNote,
    stopManualNote,
    handleDirectAction,
    processRmsFrame,
  } = useHarmonium(melodyState, tonicMidi);

  // Direct action bridge ref for the AudioWorklet loop
  const directActionRef = useRef<((res: PitchDetectionResult, note: StableNote | null) => void) | null>(null);

  // 2. Optimized AudioWorklet YIN pitch detection pipeline
  const { raw, stable, latency } = usePitchDetection(
    sourceNode,
    tonic,
    tonicOctave,
    isListening,
    (res, s) => directActionRef.current?.(res, s)
  );

  // Wire direct dispatch callback into the audio loop (synchronous, 0ms React state dependency)
  directActionRef.current = (res, stableNote) => {
    const mState = processFrame(res, stableNote?.note ?? null);
    handleDirectAction(mState, tonicMidi);
  };

  // Sync frames with melody & rhythm engine
  useEffect(() => {
    if (raw) {
      processFrame(raw, stable?.note ?? null);
      processRmsFrame(raw.rms, raw.timestamp);
    }
  }, [raw, stable, processFrame, processRmsFrame]);

  const handleStartListening = useCallback(async () => {
    const engine = AudioEngine.getInstance();
    await engine.resume();
    if (status !== 'connected') {
      await startMicrophone();
    }
    setIsListening(true);
  }, [status, startMicrophone]);

  const handleTestHarmoniumSound = useCallback(async () => {
    const engine = AudioEngine.getInstance();
    await engine.resume();
    await playManualNote(60); // C4 (Madhya Sa)
    setTimeout(() => {
      stopManualNote();
    }, 1200);
  }, [playManualNote, stopManualNote]);

  const handleStopListening = useCallback(() => {
    setIsListening(false);
    stopMicrophone();
  }, [stopMicrophone]);

  return (
    <div className="min-h-screen flex flex-col text-zinc-100 bg-[#0c0d10]">
      {/* ── Top Header ── */}
      <header className="border-b border-zinc-800/80 bg-black/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight flex items-center gap-2"
              style={{ color: '#f59e0b', fontFamily: 'Georgia, serif', letterSpacing: '0.03em' }}
            >
              <span>Swaraswathi</span>
              <span className="text-base font-normal text-amber-200/60" style={{ fontFamily: 'serif' }}>
                (ಸ್ವರಸ್ವತಿ)
              </span>
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5 tracking-wider">
              Your Virtual Harmonium Companion • Autonomous Indian Classical Accompanist
            </p>
          </div>

          <div className="flex items-center gap-3">
            <AudioStatus
              status={status}
              isListening={isListening}
              errorMessage={null}
              rms={raw?.rms ?? 0}
            />
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 flex flex-col gap-8">

        {/* ── Error banner ── */}
        {errorMessage && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-5 py-3 text-sm text-red-300">
            ⚠ {errorMessage}
          </div>
        )}

        {/* ── Centre: Pitch & Swara Display ── */}
        <section className="flex flex-col items-center gap-6">
          {/* Tonic status badge */}
          <div className="text-xs text-zinc-400 tracking-widest uppercase flex items-center gap-2 flex-wrap justify-center">
            <span>Tonic (Sa) = </span>
            <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono">
              {tonic}{tonicOctave}
            </span>
            <span className="text-zinc-500">
              ({midiToFrequency(tonicMidi).toFixed(1)} Hz)
            </span>
            <span className="ml-2 text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-semibold uppercase">
              {accompanimentMode.replace('_', ' ')}
            </span>
          </div>

          <PitchDisplay raw={raw} stable={stable} isListening={isListening} />
        </section>

        {/* ── Real-Time Latency Diagnostics Panel ── */}
        <LatencyDiagnosticsPanel latency={latency} />

        {/* ── Phase 4: Real-Time Melody Contour & Inflection Tracking ── */}
        <MelodyContour
          contour={contourHistory}
          vocalState={vocalState}
          stateDurationMs={stateDurationMs}
          stableNote={stable?.note ?? null}
        />

        {/* ── Phase 2: Interactive Virtual Harmonium Keyboard ── */}
        <section className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-5 overflow-hidden shadow-xl shadow-black/40">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-xs text-zinc-300 uppercase tracking-widest font-semibold flex items-center gap-2">
              <span>🪗 Virtual Indian Harmonium</span>
              <span className="text-[10px] text-zinc-500 normal-case font-normal">
                (Acoustic Multi-Sample Reeds • 48 Keys C2–B5)
              </span>
            </h2>

            {/* Voice status */}
            <div className="text-xs font-mono flex items-center gap-2 flex-wrap">
              {activeMelodyMidi !== null ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  Lead: MIDI {activeMelodyMidi} ({midiToFrequency(activeMelodyMidi).toFixed(1)} Hz)
                </span>
              ) : (
                <span className="text-zinc-600">Lead reed silent</span>
              )}
              {activeSupportingMidis.length > 0 && (
                <span className="text-amber-500/80 font-normal">
                  + Chords [{activeSupportingMidis.join(', ')}]
                </span>
              )}
              {activeDroneMidis.length > 0 && (
                <span className="text-amber-600 font-normal">
                  • Drone [{activeDroneMidis.join(', ')}]
                </span>
              )}
            </div>
          </div>

          <HarmoniumKeyboard
            activeNote={stable?.note ?? null}
            activeMidi={activeMelodyMidi}
            supportingMidis={activeSupportingMidis}
            droneMidis={activeDroneMidis}
            tonicMidi={tonicMidi}
            onPlayNote={playManualNote}
            onStopNote={stopManualNote}
          />
        </section>

        {/* ── Phase 3, 5, 6: Harmonium Accompaniment Intelligence Controls ── */}
        <AudioControls
          accompanimentMode={accompanimentMode}
          onAccompanimentModeChange={setAccompanimentMode}
          accompanimentIntensity={accompanimentIntensity}
          onAccompanimentIntensityChange={setAccompanimentIntensity}
          isDroneOn={isDroneOn}
          onToggleDrone={toggleDrone}
          droneUsePa={droneUsePa}
          onDroneUsePaChange={setDroneUsePa}
          droneOctave={droneOctave}
          onDroneOctaveChange={setDroneOctave}
          masterVolume={masterVolume}
          onMasterVolumeChange={setMasterVolume}
          melodyVolume={melodyVolume}
          onMelodyVolumeChange={setMelodyVolume}
          droneVolume={droneVolume}
          onDroneVolumeChange={setDroneVolume}
          rhythm={rhythm}
          voicingDescription={voicingDescription}
          tonicName={`${tonic}${tonicOctave}`}
        />

        {/* ── Automatic Tonic (Sa) Identification ── */}
        <AutoTonicDetector
          isAutoDetectOn={isAutoDetectTonic}
          onToggleAutoDetect={toggleAutoDetectTonic}
          estimation={tonicEstimation}
          currentTonic={tonic}
          onApplyTonic={(newTonic) => setTonic(newTonic)}
        />

        {/* ── Live Performance Controls & Manual Tonic Settings ── */}
        <section className="bg-zinc-900/40 border border-zinc-800/50 rounded-2xl p-5">
          <div className="flex flex-col gap-6">
            {/* Start/Stop buttons */}
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleStartListening}
                disabled={isListening || status === 'requesting'}
                className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                  isListening
                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                    : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-900/30 active:scale-95'
                }`}
              >
                <span>{status === 'requesting' ? '⏳' : '🎤'}</span>
                {status === 'requesting' ? 'Connecting Mic…' : 'Start Listening (Singing)'}
              </button>

              <button
                onClick={handleStopListening}
                disabled={!isListening && status === 'idle'}
                className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  !isListening && status === 'idle'
                    ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                    : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200 active:scale-95'
                }`}
              >
                ■ Stop Listening
              </button>

              <button
                onClick={handleTestHarmoniumSound}
                className="px-5 py-3 rounded-xl font-semibold text-sm bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-amber-500/30 transition-all duration-200 flex items-center gap-2 active:scale-95 shadow-md shadow-amber-950/20"
                title="Plays a 1-second acoustic harmonium note (C4 Sa) to verify your speakers/headphones"
              >
                <span>🔊</span> Test Harmonium Sound
              </button>
            </div>

            {/* Manual Settings */}
            <SettingsPanel
              tonic={tonic}
              tonicOctave={tonicOctave}
              onTonicChange={setTonic}
              onOctaveChange={setTonicOctave}
            />
          </div>
        </section>

        {/* ── Validation Mode: Pure Tone Generator ── */}
        <TestToneGenerator />

        {/* ── Telemetry & Pitch Debug Diagnostics ── */}
        <section>
          <button
            onClick={() => setShowDebug(d => !d)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            {showDebug ? '▼' : '▶'} Debug / Musical Telemetry Diagnostics
          </button>

          {showDebug && (
            <div className="mt-3 bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-4 font-mono text-xs text-zinc-400 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-zinc-600 mb-1">Raw Frequency</div>
                <div className="text-green-400">{raw?.frequency?.toFixed(2) ?? '—'} Hz</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Vocal State</div>
                <div className="text-green-400 uppercase">{vocalState}</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Estimated BPM</div>
                <div className="text-green-400">{rhythm.estimatedBpm ? `${rhythm.estimatedBpm} BPM` : 'Detecting…'}</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Silence Gate</div>
                <div className={raw?.isSilent ? 'text-red-400' : 'text-green-400'}>
                  {raw ? (raw.isSilent ? 'SILENT' : 'ACTIVE') : '—'}
                </div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Stable Note</div>
                <div className="text-amber-400">{stable?.note?.noteName ?? '—'}</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Indian Swara</div>
                <div className="text-amber-400">{stable?.note?.swara?.shortName ?? '—'} ({stable?.note?.swara?.name ?? '—'})</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Estimated Sa</div>
                <div className="text-amber-400">{tonicEstimation.estimatedTonic} ({(tonicEstimation.confidence * 100).toFixed(0)}%)</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Cents Deviation</div>
                <div className="text-amber-400">{stable?.note?.cents !== undefined ? `${stable.note.cents >= 0 ? '+' : ''}${stable.note.cents}¢` : '—'}</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Lead Sample Voice</div>
                <div className="text-amber-400">{activeMelodyMidi ? `MIDI ${activeMelodyMidi}` : 'Silent'}</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Harmonic Chords</div>
                <div className="text-amber-400">{activeSupportingMidis.length > 0 ? activeSupportingMidis.join(', ') : 'None'}</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Drone Stops</div>
                <div className="text-amber-400">{activeDroneMidis.length > 0 ? activeDroneMidis.join(', ') : 'Off'}</div>
              </div>
              <div>
                <div className="text-zinc-600 mb-1">Tempo Class</div>
                <div className="text-blue-400 uppercase">{rhythm.tempoCategory}</div>
              </div>
            </div>
          )}
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800/50 py-5 text-center bg-black/40">
        <p className="text-xs text-zinc-500">
          Swaraswathi (ಸ್ವರಸ್ವತಿ) • Virtual Harmonium Companion for Indian Bhajan & Devotional Vocalists
        </p>
        <p className="text-[11px] text-zinc-600 mt-1">
          100% Client-Side Local Audio Processing • Web Audio API, AudioWorklet & YIN Algorithm
        </p>
      </footer>
    </div>
  );
}

export default App;
