// src/hooks/usePitchDetection.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { PitchDetector } from '../audio/pitchDetector';
import type { OutputAcousticReference } from '../audio/pitchDetector';
import { NoteStabilizer } from '../audio/noteStabilizer';
import type { PitchDetectionResult, LatencyBreakdown, FeedbackSuppressionConfig } from '../types/audio';
import type { PitchClass } from '../types/music';
import type { StableNote } from '../audio/noteStabilizer';

export interface PitchState {
  raw: PitchDetectionResult | null;
  stable: StableNote | null;
  isListening: boolean;
  latency: LatencyBreakdown;
}

export function usePitchDetection(
  sourceNode: MediaStreamAudioSourceNode | null,
  tonic: PitchClass,
  tonicOctave: number,
  enabled: boolean,
  onDirectNoteAction?: (result: PitchDetectionResult, stableNote: StableNote | null) => void,
  acousticRef?: OutputAcousticReference | null,
  feedbackConfig?: Partial<FeedbackSuppressionConfig>
): PitchState {
  const [raw, setRaw] = useState<PitchDetectionResult | null>(null);
  const [stable, setStable] = useState<StableNote | null>(null);
  const [latency, setLatency] = useState<LatencyBreakdown>({
    bufferDurationMs: 21.3,
    yinExecutionTimeMs: 0.8,
    stabilizationDelayMs: 20.0,
    accompanimentDispatchMs: 0.05,
    synthAttackRampMs: 16.0,
    audioContextBaseLatencyMs: 4.2,
    audioContextOutputLatencyMs: 15.0,
    estimatedTotalLatencyMs: 77.35,
  });

  const detectorRef = useRef<PitchDetector | null>(null);
  const stabilizerRef = useRef<NoteStabilizer>(new NoteStabilizer());
  const lastStableNoteRef = useRef<StableNote | null>(null);
  const onDirectActionRef = useRef(onDirectNoteAction);
  onDirectActionRef.current = onDirectNoteAction;

  // Direct synchronous audio callback (runs in high-priority loop, 0ms React delay)
  const handleDirectAudio = useCallback((result: PitchDetectionResult) => {
    const tDispatchStart = performance.now();
    const stableNote = stabilizerRef.current.process(result);
    lastStableNoteRef.current = stableNote;
    onDirectActionRef.current?.(result, stableNote);
    const dispatchDuration = performance.now() - tDispatchStart;

    // Track dispatch duration for telemetry
    (result as PitchDetectionResult & { _dispatchMs?: number })._dispatchMs = dispatchDuration;
  }, []);

  // Throttled UI telemetry callback (~30 FPS, decoupled from audio)
  const handleUiTelemetry = useCallback((result: PitchDetectionResult) => {
    setRaw(result);

    const stableNote = lastStableNoteRef.current;
    setStable(stableNote);

    const engine = AudioEngine.getInstance();
    const bufferDuration = detectorRef.current?.getBufferDurationMs() ?? 21.3;
    const yinCompute = result.yinComputeTimeMs ?? 0.8;
    const stabDelay = stableNote?.stabilizationDelayMs ?? stabilizerRef.current.getMeasuredDelayMs() ?? 18;
    const dispatchMs = (result as PitchDetectionResult & { _dispatchMs?: number })._dispatchMs ?? 0.04;
    const attackMs = 16.0;
    const baseLat = engine.baseLatencyMs;
    const outLat = engine.outputLatencyMs;

    const total = bufferDuration + yinCompute + stabDelay + dispatchMs + attackMs + baseLat + outLat;

    setLatency({
      bufferDurationMs: bufferDuration,
      yinExecutionTimeMs: yinCompute,
      stabilizationDelayMs: stabDelay,
      accompanimentDispatchMs: dispatchMs,
      synthAttackRampMs: attackMs,
      audioContextBaseLatencyMs: baseLat,
      audioContextOutputLatencyMs: outLat,
      estimatedTotalLatencyMs: total,
    });
  }, []);

  useEffect(() => {
    if (!enabled || !sourceNode) {
      if (detectorRef.current) {
        detectorRef.current.disconnect();
        detectorRef.current = null;
      }
      stabilizerRef.current.reset();
      setRaw(null);
      setStable(null);
      return;
    }

    const engine = AudioEngine.getInstance();
    const detector = new PitchDetector(
      engine.context,
      handleDirectAudio,
      handleUiTelemetry,
      {
        bufferSize: 1024,      // 1024 samples @ 48kHz = 21.3ms
        analysisIntervalMs: 12, // 12ms hop interval
        useDecimation: true,
      }
    );

    detector.setTonic(tonic, tonicOctave);
    if (acousticRef) detector.setAcousticReference(acousticRef);
    if (feedbackConfig) detector.setFeedbackSuppressionConfig(feedbackConfig);

    let isCancelled = false;
    detector.connect(sourceNode).then(() => {
      if (!isCancelled) {
        detector.start();
      }
    });
    detectorRef.current = detector;

    return () => {
      isCancelled = true;
      detector.disconnect();
      detectorRef.current = null;
    };
  }, [enabled, sourceNode, handleDirectAudio, handleUiTelemetry, tonic, tonicOctave]);

  useEffect(() => {
    if (detectorRef.current) {
      detectorRef.current.setTonic(tonic, tonicOctave);
    }
  }, [tonic, tonicOctave]);

  useEffect(() => {
    if (detectorRef.current) {
      detectorRef.current.setAcousticReference(acousticRef ?? null);
    }
  }, [acousticRef]);

  useEffect(() => {
    if (detectorRef.current && feedbackConfig) {
      detectorRef.current.setFeedbackSuppressionConfig(feedbackConfig);
    }
  }, [feedbackConfig]);

  return {
    raw,
    stable,
    isListening: enabled && sourceNode !== null,
    latency,
  };
}
