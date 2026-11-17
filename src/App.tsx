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
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [showDiagnosticsDrawer, setShowDiagnosticsDrawer] = useState(false);
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
      {/* ── Top Header (Clean & Mobile-Compact) ── */}
      <header className="border-b border-zinc-800/80 bg-black/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
          <div>
            <h1
              className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-1.5"
              style={{ color: '#f59e0b', fontFamily: 'Georgia, serif', letterSpacing: '0.02em' }}
            >
              <span>Swaraswathi</span>
              <span className="text-sm font-normal text-amber-200/60" style={{ fontFamily: 'serif' }}>
                (ಸ್ವರಸ್ವತಿ)
              </span>
            </h1>
            <p className="text-[10px] sm:text-xs text-zinc-400">
              Virtual Harmonium Accompanist
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Sa Badge & Toggle */}
            <button
              onClick={() => setShowSettingsDrawer(prev => !prev)}
              className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg flex items-center gap-1 hover:bg-amber-500/20 transition-all font-mono cursor-pointer"
              title="Click to change Tonic Sa"
            >
              <span className="text-[10px] text-zinc-400 font-sans">Sa:</span>
              <span className="font-bold">{tonic}{tonicOctave}</span>
              <span className="text-[9px] text-zinc-500">⚙️</span>
            </button>

            <AudioStatus
              status={status}
              isListening={isListening}
              errorMessage={null}
              rms={raw?.rms ?? 0}
            />
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4 sm:gap-6">

        {/* ── Error Banner ── */}
        {errorMessage && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-xl px-4 py-2.5 text-xs text-red-300">
            ⚠ {errorMessage}
          </div>
        )}

        {/* ── PRIMARY HERO: Start / Stop Accompaniment Button ── */}
        <section className="flex flex-col items-center gap-3">
          <div className="w-full flex items-center justify-center gap-2.5">
            {!isListening ? (
              <button
                onClick={handleStartListening}
                disabled={status === 'requesting'}
                className="flex-1 sm:flex-initial sm:min-w-[280px] py-3.5 px-6 rounded-2xl font-bold text-base bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-900/30 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer ring-2 ring-amber-400/40"
              >
                <span className="text-xl">{status === 'requesting' ? '⏳' : '🎤'}</span>
                <span>{status === 'requesting' ? 'Connecting Mic…' : 'Start Accompaniment'}</span>
              </button>
            ) : (
              <button
                onClick={handleStopListening}
                className="flex-1 sm:flex-initial sm:min-w-[280px] py-3.5 px-6 rounded-2xl font-bold text-base bg-red-600/90 hover:bg-red-500 text-white shadow-lg shadow-red-950/40 active:scale-95 transition-all flex items-center justify-center gap-2.5 cursor-pointer ring-2 ring-red-400/40"
              >
                <span className="w-3 h-3 rounded-sm bg-white" />
                <span>Stop Accompaniment</span>
              </button>
            )}

            <button
              onClick={handleTestHarmoniumSound}
              className="py-3 px-3.5 rounded-2xl font-semibold text-xs bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/30 transition-all flex items-center gap-1.5 active:scale-95 shadow-md cursor-pointer"
              title="Test Harmonium Note (C4)"
            >
              <span>🔊</span>
              <span className="hidden sm:inline">Test Sound</span>
            </button>
          </div>
        </section>

        {/* ── CENTRE: Live Indian Swara & Singing Display ── */}
        <section className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-4 sm:p-5 flex flex-col items-center shadow-lg shadow-black/30">
          <div className="text-[11px] text-zinc-400 uppercase tracking-widest flex items-center gap-2 mb-2">
            <span>Tonic (Sa):</span>
            <span className="text-amber-400 font-bold font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {tonic}{tonicOctave}
            </span>
            <span className="text-zinc-500">
              ({midiToFrequency(tonicMidi).toFixed(1)} Hz)
            </span>
          </div>

          <PitchDisplay raw={raw} stable={stable} isListening={isListening} />
        </section>

        {/* ── ACCOMPANIMENT INTELLIGENCE CONTROLS (Streamlined for Mobile) ── */}
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

        {/* ── TOUCH-FRIENDLY HARMONIUM KEYBOARD ── */}
        <section className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-3.5 sm:p-4 overflow-hidden shadow-lg shadow-black/40">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
            <h2 className="text-xs text-zinc-300 uppercase tracking-wider font-semibold flex items-center gap-1.5">
              <span>🪗 Harmonium Reeds</span>
            </h2>

            {/* Live voice info */}
            <div className="text-[11px] font-mono flex items-center gap-2 text-zinc-400">
              {activeMelodyMidi !== null ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  Lead: MIDI {activeMelodyMidi}
                </span>
              ) : (
                <span className="text-zinc-500">Lead: Silent</span>
              )}
              {activeSupportingMidis.length > 0 && (
                <span className="text-amber-500/80 text-[10px]">
                  +{activeSupportingMidis.length} Chords
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

        {/* ── COLLAPSIBLE DRAWER 1: ⚙️ Settings, Tonic & Auto-Detection ── */}
        <section className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowSettingsDrawer(prev => !prev)}
            className="w-full px-4 py-3 flex items-center justify-between text-left text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <span className="font-semibold flex items-center gap-2">
              <span>⚙️</span>
              <span>Tonic (Sa) & Pitch Settings</span>
            </span>
            <span className="text-zinc-500 font-mono text-[11px]">
              {showSettingsDrawer ? '▲ Hide' : '▼ Expand'}
            </span>
          </button>

          {showSettingsDrawer && (
            <div className="p-4 border-t border-zinc-800/60 flex flex-col gap-4 bg-zinc-950/50">
              {/* Manual Tonic Selector */}
              <SettingsPanel
                tonic={tonic}
                tonicOctave={tonicOctave}
                onTonicChange={setTonic}
                onOctaveChange={setTonicOctave}
              />

              {/* Automatic Tonic Detector */}
              <AutoTonicDetector
                isAutoDetectOn={isAutoDetectTonic}
                onToggleAutoDetect={toggleAutoDetectTonic}
                estimation={tonicEstimation}
                currentTonic={tonic}
                onApplyTonic={(newTonic) => setTonic(newTonic)}
              />
            </div>
          )}
        </section>

        {/* ── COLLAPSIBLE DRAWER 2: 🛠️ Diagnostics, Contour & Test Tone (Hidden by default on mobile) ── */}
        <section className="bg-zinc-900/30 border border-zinc-800/60 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowDiagnosticsDrawer(prev => !prev)}
            className="w-full px-4 py-3 flex items-center justify-between text-left text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <span className="font-medium flex items-center gap-2">
              <span>🛠️</span>
              <span>Advanced Diagnostics, Latency & Audio Tools</span>
            </span>
            <span className="text-zinc-500 font-mono text-[11px]">
              {showDiagnosticsDrawer ? '▲ Hide' : '▼ Expand'}
            </span>
          </button>

          {showDiagnosticsDrawer && (
            <div className="p-4 border-t border-zinc-800/60 flex flex-col gap-6 bg-zinc-950/60">
              {/* Latency Diagnostics */}
              <LatencyDiagnosticsPanel latency={latency} />

              {/* Real-Time Melody Contour */}
              <MelodyContour
                contour={contourHistory}
                vocalState={vocalState}
                stateDurationMs={stateDurationMs}
                stableNote={stable?.note ?? null}
              />

              {/* Pure Tone Generator for Lab Testing */}
              <TestToneGenerator />

              {/* Raw Musical Telemetry */}
              <div>
                <button
                  onClick={() => setShowDebug(d => !d)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {showDebug ? '▼' : '▶'} Raw Telemetry & Audio Parameters
                </button>

                {showDebug && (
                  <div className="mt-3 bg-zinc-950/90 border border-zinc-800/50 rounded-xl p-3 font-mono text-[11px] text-zinc-400 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <div className="text-zinc-600 mb-0.5">Raw Frequency</div>
                      <div className="text-green-400">{raw?.frequency?.toFixed(2) ?? '—'} Hz</div>
                    </div>
                    <div>
                      <div className="text-zinc-600 mb-0.5">Vocal State</div>
                      <div className="text-green-400 uppercase">{vocalState}</div>
                    </div>
                    <div>
                      <div className="text-zinc-600 mb-0.5">Estimated BPM</div>
                      <div className="text-green-400">{rhythm.estimatedBpm ? `${rhythm.estimatedBpm} BPM` : 'Detecting…'}</div>
                    </div>
                    <div>
                      <div className="text-zinc-600 mb-0.5">Silence Gate</div>
                      <div className={raw?.isSilent ? 'text-red-400' : 'text-green-400'}>
                        {raw ? (raw.isSilent ? 'SILENT' : 'ACTIVE') : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-zinc-600 mb-0.5">Stable Note</div>
                      <div className="text-amber-400">{stable?.note?.noteName ?? '—'}</div>
                    </div>
                    <div>
                      <div className="text-zinc-600 mb-0.5">Indian Swara</div>
                      <div className="text-amber-400">{stable?.note?.swara?.shortName ?? '—'} ({stable?.note?.swara?.name ?? '—'})</div>
                    </div>
                    <div>
                      <div className="text-zinc-600 mb-0.5">Estimated Sa</div>
                      <div className="text-amber-400">{tonicEstimation.estimatedTonic} ({(tonicEstimation.confidence * 100).toFixed(0)}%)</div>
                    </div>
                    <div>
                      <div className="text-zinc-600 mb-0.5">Cents Deviation</div>
                      <div className="text-amber-400">{stable?.note?.cents !== undefined ? `${stable.note.cents >= 0 ? '+' : ''}${stable.note.cents}¢` : '—'}</div>
                    </div>
                    <div>
                      <div className="text-zinc-600 mb-0.5">Drone Stops</div>
                      <div className="text-amber-400">{activeDroneMidis.length > 0 ? activeDroneMidis.join(', ') : 'Off'}</div>
                    </div>
                    <div>
                      <div className="text-zinc-600 mb-0.5">Tempo Class</div>
                      <div className="text-blue-400 uppercase">{rhythm.tempoCategory}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800/60 py-5 text-center bg-black/50 mt-auto">
        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center gap-2.5">
          <p className="text-xs text-zinc-400 flex items-center gap-1.5 flex-wrap justify-center">
            <span>Made with <span className="text-red-500 animate-pulse">❤️</span> by</span>
            <span className="font-semibold text-amber-400">Hardik</span>
          </p>

          <div className="flex items-center gap-3 text-xs flex-wrap justify-center">
            <a
              href="https://github.com/hapra123"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-amber-400 transition-colors flex items-center gap-1 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-800 hover:border-amber-500/40"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>

            <a
              href="https://www.linkedin.com/in/hardik-prabhu-hapra123/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-sky-400 transition-colors flex items-center gap-1 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-800 hover:border-sky-500/40"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
              <span>LinkedIn</span>
            </a>

            <a
              href="https://www.instagram.com/prabhuhardik2.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-pink-400 transition-colors flex items-center gap-1 bg-zinc-900/80 px-2.5 py-1 rounded-lg border border-zinc-800 hover:border-pink-500/40"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
              <span>Instagram</span>
            </a>
          </div>

          <p className="text-[10px] text-zinc-600 mt-1">
            Swaraswathi (ಸ್ವರಸ್ವತಿ) • Virtual Harmonium Companion for Indian Classical & Bhajan Vocalists
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
