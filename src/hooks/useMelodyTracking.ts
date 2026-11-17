// src/hooks/useMelodyTracking.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { TonicDetector } from '../audio/tonicDetector';
import type { TonicEstimationResult } from '../audio/tonicDetector';
import { MelodyTracker } from '../audio/melodyTracker';
import type { MelodyTrackingState, VocalState, ContourPoint } from '../audio/melodyTracker';
import type { PitchDetectionResult } from '../types/audio';
import type { NoteInfo, PitchClass } from '../types/music';

export interface UseMelodyTrackingReturn {
  vocalState: VocalState;
  stateDurationMs: number;
  contourHistory: ContourPoint[];
  melodyState: MelodyTrackingState;
  tonicEstimation: TonicEstimationResult;
  isAutoDetectTonic: boolean;
  toggleAutoDetectTonic: () => void;
  processFrame: (result: PitchDetectionResult, stableNote: NoteInfo | null) => MelodyTrackingState;
}

const DEFAULT_MELODY_STATE: MelodyTrackingState = {
  vocalState: 'silent',
  currentDurationMs: 0,
  glideVelocitySemitonesPerSec: 0,
  contourHistory: [],
  lastStableNote: null,
  currentNote: null,
  isLegatoTransition: false,
  isSustainedNyasa: false,
};

export function useMelodyTracking(
  currentTonic: PitchClass,
  onAutoTonicChange?: (tonic: PitchClass) => void
): UseMelodyTrackingReturn {
  const tonicDetectorRef = useRef<TonicDetector>(new TonicDetector());
  const melodyTrackerRef = useRef<MelodyTracker>(new MelodyTracker());

  const [melodyState, setMelodyState] = useState<MelodyTrackingState>(DEFAULT_MELODY_STATE);
  const [isAutoDetectTonic, setIsAutoDetectTonic] = useState(false);

  const [tonicEstimation, setTonicEstimation] = useState<TonicEstimationResult>({
    estimatedTonic: currentTonic,
    confidence: 0,
    distribution: {} as Record<PitchClass, number>,
    sampleCount: 0,
  });

  const lastAutoAppliedTonicRef = useRef<PitchClass>(currentTonic);

  const toggleAutoDetectTonic = useCallback(() => {
    setIsAutoDetectTonic(prev => !prev);
  }, []);

  const processFrame = useCallback((result: PitchDetectionResult, stableNote: NoteInfo | null): MelodyTrackingState => {
    // 1. Update Melody Tracker
    const mState = melodyTrackerRef.current.update(result, stableNote);
    setMelodyState(mState);

    // 2. Update Tonic Estimation
    tonicDetectorRef.current.update(
      result.note?.midiNote ?? null,
      result.isSilent,
      result.timestamp
    );

    const est = tonicDetectorRef.current.estimate();
    setTonicEstimation(est);

    // If auto-detect is ON and confidence >= 70% and different, apply automatically
    if (
      isAutoDetectTonic &&
      est.confidence >= 0.70 &&
      est.estimatedTonic !== currentTonic &&
      est.estimatedTonic !== lastAutoAppliedTonicRef.current
    ) {
      lastAutoAppliedTonicRef.current = est.estimatedTonic;
      onAutoTonicChange?.(est.estimatedTonic);
    }

    return mState;
  }, [currentTonic, isAutoDetectTonic, onAutoTonicChange]);

  useEffect(() => {
    return () => {
      tonicDetectorRef.current.reset();
      melodyTrackerRef.current.reset();
    };
  }, []);

  return {
    vocalState: melodyState.vocalState,
    stateDurationMs: melodyState.currentDurationMs,
    contourHistory: melodyState.contourHistory,
    melodyState,
    tonicEstimation,
    isAutoDetectTonic,
    toggleAutoDetectTonic,
    processFrame,
  };
}
