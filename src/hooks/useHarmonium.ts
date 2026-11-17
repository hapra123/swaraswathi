// src/hooks/useHarmonium.ts
// Unified Harmonium Accompaniment Hook.
// Coordinates HarmoniumSampler, DroneEngine, AccompanimentEngine, and RhythmEngine.

import { useEffect, useRef, useState, useCallback } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { HarmoniumSampler } from '../audio/harmoniumSampler';
import { DroneEngine } from '../audio/droneEngine';
import { AccompanimentEngine } from '../audio/accompanimentEngine';
import { RhythmEngine } from '../audio/rhythmEngine';
import type { AccompanimentMode, AccompanimentIntensity } from '../types/accompaniment';
import type { RhythmAnalysis } from '../audio/rhythmEngine';
import type { MelodyTrackingState } from '../audio/melodyTracker';
import type { OutputAcousticReference } from '../audio/pitchDetector';

export interface HarmoniumState {
  // Accompaniment mode
  accompanimentMode: AccompanimentMode;
  accompanimentIntensity: AccompanimentIntensity;
  setAccompanimentMode: (m: AccompanimentMode) => void;
  setAccompanimentIntensity: (i: AccompanimentIntensity) => void;

  // Drone controls
  isDroneOn: boolean;
  toggleDrone: () => void;
  setDroneUsePa: (usePa: boolean) => void;
  droneUsePa: boolean;
  droneOctave: 2 | 3;
  setDroneOctave: (oct: 2 | 3) => void;

  // Volumes
  masterVolume: number;
  melodyVolume: number;
  droneVolume: number;
  setMasterVolume: (v: number) => void;
  setMelodyVolume: (v: number) => void;
  setDroneVolume: (v: number) => void;

  // Real-time sounding voices
  activeMelodyMidi: number | null;
  activeSupportingMidis: number[];
  activeDroneMidis: number[];
  voicingDescription: string;

  // Rhythm
  rhythm: RhythmAnalysis;

  // Manual playing & audio pipeline bridge
  playManualNote: (midiNote: number) => void;
  stopManualNote: () => void;
  handleDirectAction: (melodyState: MelodyTrackingState, tonicMidi: number) => void;
  processRmsFrame: (rms: number, timestamp: number) => void;
  acousticRef: OutputAcousticReference;
}

export function useHarmonium(
  _melodyTrackingState: MelodyTrackingState,
  tonicMidi: number
): HarmoniumState {
  const samplerRef = useRef<HarmoniumSampler | null>(null);
  const droneEngineRef = useRef<DroneEngine | null>(null);
  const accompanimentEngineRef = useRef<AccompanimentEngine>(new AccompanimentEngine());
  const rhythmEngineRef = useRef<RhythmEngine>(new RhythmEngine());
  const isManualPlayingRef = useRef(false);

  const [accompanimentMode, setAccompanimentModeState] = useState<AccompanimentMode>('human_accompanist');
  const [accompanimentIntensity, setAccompanimentIntensityState] = useState<AccompanimentIntensity>('standard');

  const [isDroneOn, setIsDroneOn] = useState(true);
  const [droneUsePa, setDroneUsePaState] = useState(true);
  const [droneOctave, setDroneOctaveState] = useState<2 | 3>(3);

  const [masterVolume, setMasterVolumeState] = useState(0.85);
  const [melodyVolume, setMelodyVolumeState] = useState(0.82);
  const [droneVolume, setDroneVolumeState] = useState(0.42);

  const [activeMelodyMidi, setActiveMelodyMidi] = useState<number | null>(null);
  const [activeSupportingMidis, setActiveSupportingMidis] = useState<number[]>([]);
  const [activeDroneMidis, setActiveDroneMidis] = useState<number[]>([]);
  const [voicingDescription, setVoicingDescription] = useState('Human-like Accompanist Ready');

  const [rhythm, setRhythm] = useState<RhythmAnalysis>({
    isOnset: false,
    estimatedBpm: null,
    confidence: 0,
    tempoCategory: 'free_alaap',
    recommendedAttackMs: 20,
    recommendedReleaseMs: 120,
    beatCount: 0,
    lastOnsetTime: 0,
  });

  // Lazy singleton initializer for audio modules
  const getAudioModules = useCallback(() => {
    if (!samplerRef.current) {
      const engine = AudioEngine.getInstance();
      const sampler = new HarmoniumSampler(engine.context);
      sampler.setMasterVolume(masterVolume);
      sampler.setMelodyVolume(melodyVolume);
      sampler.setDroneVolume(droneVolume);
      samplerRef.current = sampler;

      const droneEngine = new DroneEngine(sampler, {
        enabled: isDroneOn,
        tonicMidi,
        usePa: droneUsePa,
        droneOctave,
        masterVolume: droneVolume,
      });
      droneEngineRef.current = droneEngine;
    }
    return {
      sampler: samplerRef.current,
      droneEngine: droneEngineRef.current!,
    };
  }, [masterVolume, melodyVolume, droneVolume, isDroneOn, tonicMidi, droneUsePa, droneOctave]);

  // Direct synchronous audio loop execution (0ms React latency)
  const handleDirectAction = useCallback((melodyState: MelodyTrackingState, tonic: number) => {
    if (isManualPlayingRef.current) return;
    const { sampler, droneEngine } = getAudioModules();

    // 1. Evaluate accompaniment decision
    const decision = accompanimentEngineRef.current.evaluate(melodyState, tonic);
    setVoicingDescription(decision.voicingDescription);

    // 2. Play/Release melody & supporting chords
    if (decision.melodyMidi !== null) {
      sampler.playMelody(decision.melodyMidi, decision.supportingMidis);
      setActiveMelodyMidi(decision.melodyMidi);
      setActiveSupportingMidis(decision.supportingMidis);
    } else {
      sampler.stopMelody();
      setActiveMelodyMidi(null);
      setActiveSupportingMidis([]);
    }

    // 3. Drone state sync
    if (decision.droneActive && !droneEngine.isEnabled() && isDroneOn) {
      droneEngine.setEnabled(true);
    }
    setActiveDroneMidis(droneEngine.getActiveMidis());
  }, [getAudioModules, isDroneOn]);

  // Update tonic & active status in drone engine
  useEffect(() => {
    const { droneEngine } = getAudioModules();
    droneEngine.setTonic(tonicMidi);
    droneEngine.setEnabled(isDroneOn);
    setActiveDroneMidis(droneEngine.getActiveMidis());
  }, [tonicMidi, isDroneOn, getAudioModules]);

  // Drone On/Off toggle
  const toggleDrone = useCallback(async () => {
    const engine = AudioEngine.getInstance();
    await engine.resume();
    setIsDroneOn(prev => {
      const next = !prev;
      const { droneEngine } = getAudioModules();
      droneEngine.setEnabled(next);
      setActiveDroneMidis(droneEngine.getActiveMidis());
      return next;
    });
  }, [getAudioModules]);

  const setDroneUsePa = useCallback((usePa: boolean) => {
    setDroneUsePaState(usePa);
    const { droneEngine } = getAudioModules();
    droneEngine.updateConfig({ usePa });
    setActiveDroneMidis(droneEngine.getActiveMidis());
  }, [getAudioModules]);

  const setDroneOctave = useCallback((oct: 2 | 3) => {
    setDroneOctaveState(oct);
    const { droneEngine } = getAudioModules();
    droneEngine.updateConfig({ droneOctave: oct });
    setActiveDroneMidis(droneEngine.getActiveMidis());
  }, [getAudioModules]);

  const setAccompanimentMode = useCallback((m: AccompanimentMode) => {
    setAccompanimentModeState(m);
    accompanimentEngineRef.current.setMode(m);
  }, []);

  const setAccompanimentIntensity = useCallback((i: AccompanimentIntensity) => {
    setAccompanimentIntensityState(i);
    accompanimentEngineRef.current.setIntensity(i);
  }, []);

  const setMasterVolume = useCallback((v: number) => {
    setMasterVolumeState(v);
    if (samplerRef.current) samplerRef.current.setMasterVolume(v);
  }, []);

  const setMelodyVolume = useCallback((v: number) => {
    setMelodyVolumeState(v);
    if (samplerRef.current) samplerRef.current.setMelodyVolume(v);
  }, []);

  const setDroneVolume = useCallback((v: number) => {
    setDroneVolumeState(v);
    if (samplerRef.current) samplerRef.current.setDroneVolume(v);
  }, []);

  const playManualNote = useCallback(async (midiNote: number) => {
    isManualPlayingRef.current = true;
    const engine = AudioEngine.getInstance();
    await engine.resume();
    const { sampler } = getAudioModules();
    sampler.playMelody(midiNote, []);
    setActiveMelodyMidi(midiNote);
  }, [getAudioModules]);

  const stopManualNote = useCallback(() => {
    isManualPlayingRef.current = false;
    if (samplerRef.current) {
      samplerRef.current.stopMelody();
      setActiveMelodyMidi(null);
      setActiveSupportingMidis([]);
    }
  }, []);

  const processRmsFrame = useCallback((rms: number, timestamp: number) => {
    const r = rhythmEngineRef.current.process(rms, timestamp);
    setRhythm(r);
  }, []);

  const acousticRef = useRef<OutputAcousticReference>({
    getOutputRms: () => samplerRef.current?.getOutputRms() ?? 0,
    getActiveMidis: () => samplerRef.current?.getActiveMidis() ?? [],
  }).current;

  return {
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
    acousticRef,
  };
}
