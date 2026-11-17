// src/audio/microphone.ts
// Manages MediaStream microphone access and AudioNode wiring.

export interface MicrophoneConfig {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface MicrophoneHandle {
  stream: MediaStream;
  sourceNode: MediaStreamAudioSourceNode;
  stop: () => void;
}

const DEFAULT_CONFIG: MicrophoneConfig = {
  channelCount: 1,
  echoCancellation: true,  // Hardware AEC enabled: cancels speaker playback on mobile phones & laptops
  noiseSuppression: false, // Keep off: spectral subtraction can distort musical harmonic pitch
  autoGainControl: false,  // Keep off: AGC distorts vocal dynamics and boosts quiet speaker bleed
};

/**
 * Request microphone access and return a handle with the source node.
 * Throws if permission is denied or mic is unavailable.
 */
export async function openMicrophone(
  audioContext: AudioContext,
  config: MicrophoneConfig = {}
): Promise<MicrophoneHandle> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('getUserMedia is not supported in this browser.');
  }

  let stream: MediaStream;
  try {
    const audioConstraints: MediaTrackConstraints = {
      channelCount: cfg.channelCount,
      echoCancellation: cfg.echoCancellation,
      noiseSuppression: cfg.noiseSuppression,
      autoGainControl: cfg.autoGainControl,
    };
    if (cfg.sampleRate) {
      audioConstraints.sampleRate = cfg.sampleRate;
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    });
  } catch (err: unknown) {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('PERMISSION_DENIED');
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw new Error('NO_MICROPHONE');
      }
    }
    throw err;
  }

  // Resume AudioContext if suspended (browser policy)
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  const sourceNode = audioContext.createMediaStreamSource(stream);

  const stop = () => {
    sourceNode.disconnect();
    stream.getTracks().forEach(t => t.stop());
  };

  return { stream, sourceNode, stop };
}

/**
 * Calculate RMS amplitude of a Float32Array buffer.
 */
export function calculateRms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}
