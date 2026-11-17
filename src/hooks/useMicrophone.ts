// src/hooks/useMicrophone.ts
import { useState, useCallback, useRef } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import { openMicrophone } from '../audio/microphone';
import type { MicrophoneHandle, MicrophoneConfig } from '../audio/microphone';
import type { MicrophoneStatus } from '../types/audio';

export interface UseMicrophoneReturn {
  status: MicrophoneStatus;
  micHandle: MicrophoneHandle | null;
  sourceNode: MediaStreamAudioSourceNode | null;
  errorMessage: string | null;
  startMicrophone: (config?: Partial<MicrophoneConfig>) => Promise<void>;
  stopMicrophone: () => void;
}

export function useMicrophone(): UseMicrophoneReturn {
  const [status, setStatus] = useState<MicrophoneStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const micHandleRef = useRef<MicrophoneHandle | null>(null);

  const startMicrophone = useCallback(async (config?: Partial<MicrophoneConfig>) => {
    if (status === 'connected' || status === 'requesting') return;
    setStatus('requesting');
    setErrorMessage(null);

    try {
      const engine = AudioEngine.getInstance();
      await engine.resume();
      const handle = await openMicrophone(engine.context, config);
      micHandleRef.current = handle;
      setStatus('connected');
    } catch (err: unknown) {
      micHandleRef.current = null;
      if (err instanceof Error) {
        if (err.message === 'PERMISSION_DENIED') {
          setStatus('denied');
          setErrorMessage('Microphone permission was denied. Please allow microphone access in your browser settings.');
        } else if (err.message === 'NO_MICROPHONE') {
          setStatus('error');
          setErrorMessage('No microphone found. Please connect a microphone and try again.');
        } else {
          setStatus('error');
          setErrorMessage(err.message);
        }
      } else {
        setStatus('error');
        setErrorMessage('An unknown error occurred.');
      }
    }
  }, [status]);

  const stopMicrophone = useCallback(() => {
    if (micHandleRef.current) {
      micHandleRef.current.stop();
      micHandleRef.current = null;
    }
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return {
    status,
    micHandle: micHandleRef.current,
    sourceNode: micHandleRef.current?.sourceNode ?? null,
    errorMessage,
    startMicrophone,
    stopMicrophone,
  };
}
