// src/audio/harmoniumSynth.ts
// Authentic Multi-Reed Indian Harmonium Synthesizer with selectable reed timbres
// and multi-voice accompaniment engine.

import { midiToFrequency } from '../utils/frequencyToNote';

export type HarmoniumTimbre = 'traditional' | 'calcutta' | 'organ';

interface ActiveVoice {
  midiNote: number;
  oscillators: OscillatorNode[];
  gainNodes: GainNode[];
  filterNode: BiquadFilterNode;
  envelopeGain: GainNode;
  startTime: number;
  isReleasing: boolean;
}

export class HarmoniumSynth {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private melodyGain: GainNode;
  private droneGain: GainNode;
  private chordGain: GainNode;

  // Active melody voice
  private currentMelodyVoice: ActiveVoice | null = null;

  // Active supporting harmonic accompaniment voices
  private supportingVoices: Map<number, ActiveVoice> = new Map();

  // Active drone voices (e.g. Sa and Pa)
  private droneVoices: Map<number, ActiveVoice> = new Map();

  // Active reed timbre preset
  private currentTimbre: HarmoniumTimbre = 'traditional';

  // Timbre parameters - optimized for low latency & anti-click
  private attackTime = 0.016; // 16 ms snappy attack envelope (reduced from 45 ms)
  private releaseTime = 0.120; // 120 ms natural reed ringdown

  // Custom PeriodicWave for authentic harmonium reed timbre
  private reedWaveform: PeriodicWave | null = null;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;

    // Master bus
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

    // Melody bus
    this.melodyGain = this.ctx.createGain();
    this.melodyGain.gain.setValueAtTime(0.80, this.ctx.currentTime);
    this.melodyGain.connect(this.masterGain);

    // Supporting accompaniment bus
    this.chordGain = this.ctx.createGain();
    this.chordGain.gain.setValueAtTime(0.50, this.ctx.currentTime);
    this.chordGain.connect(this.masterGain);

    // Drone bus
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.40, this.ctx.currentTime);
    this.droneGain.connect(this.masterGain);

    // Connect to audio destination
    this.masterGain.connect(this.ctx.destination);

    this.initHarmonics();
  }

  /**
   * Sets the reed timbre style (traditional, calcutta deluxe, organ).
   */
  public setTimbre(timbre: HarmoniumTimbre): void {
    this.currentTimbre = timbre;
    this.initHarmonics();
  }

  private initHarmonics(): void {
    const numHarmonics = 32;
    const real = new Float32Array(numHarmonics);
    const imag = new Float32Array(numHarmonics);

    real[0] = 0;
    imag[0] = 0;

    for (let n = 1; n < numHarmonics; n++) {
      let amp = 0;
      if (this.currentTimbre === 'calcutta') {
        // Calcutta style: warm, heavier on lower harmonics, mellow top
        amp = 1.0 / Math.pow(n, 1.4);
        if (n === 2) amp *= 1.2;
        if (n === 3) amp *= 1.1;
      } else if (this.currentTimbre === 'organ') {
        // Bright organ reed: prominent upper odd harmonics
        amp = 1.0 / Math.pow(n, 0.95);
        if (n % 2 !== 0) amp *= 1.3;
      } else {
        // Traditional 2-reed Punjabi/Delhi harmonium
        if (n === 1) amp = 1.0;
        else if (n === 2) amp = 0.85;
        else if (n === 3) amp = 0.70;
        else if (n === 4) amp = 0.55;
        else if (n === 5) amp = 0.40;
        else amp = 1.0 / Math.pow(n, 1.25);
      }
      imag[n] = amp * (n % 2 === 0 ? 0.9 : 1.0);
    }

    try {
      this.reedWaveform = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    } catch {
      this.reedWaveform = null;
    }
  }

  private createVoice(midiNote: number, destination: GainNode, volumeMultiplier = 1.0): ActiveVoice {
    const now = this.ctx.currentTime;
    const freq = midiToFrequency(midiNote);

    const envelopeGain = this.ctx.createGain();
    envelopeGain.gain.setValueAtTime(0.0001, now);
    envelopeGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volumeMultiplier), now + this.attackTime);

    // Resonant formant filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoffMultiplier = this.currentTimbre === 'calcutta' ? 3.5 : this.currentTimbre === 'organ' ? 6.0 : 4.5;
    filter.frequency.setValueAtTime(Math.min(4800, Math.max(800, freq * cutoffMultiplier)), now);
    filter.Q.setValueAtTime(this.currentTimbre === 'calcutta' ? 2.2 : 1.7, now);

    envelopeGain.connect(filter);
    filter.connect(destination);

    const oscillators: OscillatorNode[] = [];
    const gainNodes: GainNode[] = [];

    // Reed 1: Main pitch (Male reed)
    const osc1 = this.ctx.createOscillator();
    if (this.reedWaveform) osc1.setPeriodicWave(this.reedWaveform);
    else osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, now);

    const g1 = this.ctx.createGain();
    g1.gain.setValueAtTime(0.55, now);
    osc1.connect(g1);
    g1.connect(envelopeGain);
    osc1.start(now);
    oscillators.push(osc1);
    gainNodes.push(g1);

    // Reed 2: Dual reed with beating chorus (+1.8 Hz for traditional, +2.3 Hz for organ)
    const detuneHz = this.currentTimbre === 'calcutta' ? 1.4 : this.currentTimbre === 'organ' ? 2.4 : 1.8;
    const osc2 = this.ctx.createOscillator();
    if (this.reedWaveform) osc2.setPeriodicWave(this.reedWaveform);
    else osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq + detuneHz, now);

    const g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.45, now);
    osc2.connect(g2);
    g2.connect(envelopeGain);
    osc2.start(now);
    oscillators.push(osc2);
    gainNodes.push(g2);

    // Reed 3: Bass or Female reed depending on timbre
    if (this.currentTimbre === 'calcutta' && midiNote >= 40) {
      // Calcutta adds Female reed (octave higher at soft volume)
      const osc3 = this.ctx.createOscillator();
      if (this.reedWaveform) osc3.setPeriodicWave(this.reedWaveform);
      else osc3.type = 'sawtooth';
      osc3.frequency.setValueAtTime(freq * 2.0, now);

      const g3 = this.ctx.createGain();
      g3.gain.setValueAtTime(0.20, now);
      osc3.connect(g3);
      g3.connect(envelopeGain);
      osc3.start(now);
      oscillators.push(osc3);
      gainNodes.push(g3);
    } else if (midiNote >= 48) {
      // Standard Bass reed (octave lower)
      const osc3 = this.ctx.createOscillator();
      if (this.reedWaveform) osc3.setPeriodicWave(this.reedWaveform);
      else osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(freq * 0.5, now);

      const g3 = this.ctx.createGain();
      g3.gain.setValueAtTime(0.25, now);
      osc3.connect(g3);
      g3.connect(envelopeGain);
      osc3.start(now);
      oscillators.push(osc3);
      gainNodes.push(g3);
    }

    return {
      midiNote,
      oscillators,
      gainNodes,
      filterNode: filter,
      envelopeGain,
      startTime: now,
      isReleasing: false,
    };
  }

  private releaseVoice(voice: ActiveVoice): void {
    if (voice.isReleasing) return;
    voice.isReleasing = true;

    const now = this.ctx.currentTime;
    voice.envelopeGain.gain.cancelScheduledValues(now);
    voice.envelopeGain.gain.setValueAtTime(voice.envelopeGain.gain.value, now);
    voice.envelopeGain.gain.exponentialRampToValueAtTime(0.0001, now + this.releaseTime);

    setTimeout(() => {
      voice.oscillators.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {}
      });
      voice.envelopeGain.disconnect();
      voice.filterNode.disconnect();
    }, (this.releaseTime + 0.05) * 1000);
  }

  // ── Melody & Accompaniment Voice Control ───────────────────────────────────

  public playMelodyWithAccompaniment(melodyMidi: number, supportingMidis: number[] = []): void {
    // 1. Melody Voice
    if (!this.currentMelodyVoice || this.currentMelodyVoice.midiNote !== melodyMidi || this.currentMelodyVoice.isReleasing) {
      if (this.currentMelodyVoice) {
        this.releaseVoice(this.currentMelodyVoice);
        this.currentMelodyVoice = null;
      }
      if (melodyMidi >= 24 && melodyMidi <= 108) {
        this.currentMelodyVoice = this.createVoice(melodyMidi, this.melodyGain, 1.0);
      }
    }

    // 2. Supporting Accompaniment Voices
    // Release any supporting voices no longer in supportingMidis
    this.supportingVoices.forEach((voice, midi) => {
      if (!supportingMidis.includes(midi)) {
        this.releaseVoice(voice);
        this.supportingVoices.delete(midi);
      }
    });

    // Start newly requested supporting voices
    supportingMidis.forEach(midi => {
      if (!this.supportingVoices.has(midi) && midi !== melodyMidi) {
        const voice = this.createVoice(midi, this.chordGain, 0.45);
        this.supportingVoices.set(midi, voice);
      }
    });
  }

  public playMelodyNote(midiNote: number): void {
    this.playMelodyWithAccompaniment(midiNote, []);
  }

  public stopMelodyNote(): void {
    if (this.currentMelodyVoice) {
      this.releaseVoice(this.currentMelodyVoice);
      this.currentMelodyVoice = null;
    }
    this.supportingVoices.forEach(voice => this.releaseVoice(voice));
    this.supportingVoices.clear();
  }

  // ── Drone Control ──────────────────────────────────────────────────────────

  public setDrone(enabled: boolean, tonicMidi = 48, includePa = true): void {
    if (!enabled) {
      this.stopDrone();
      return;
    }

    this.stopDrone();

    const saVoice = this.createVoice(tonicMidi, this.droneGain, 0.5);
    this.droneVoices.set(tonicMidi, saVoice);

    if (includePa) {
      const paVoice = this.createVoice(tonicMidi + 7, this.droneGain, 0.38);
      this.droneVoices.set(tonicMidi + 7, paVoice);
    }
  }

  public stopDrone(): void {
    this.droneVoices.forEach(voice => this.releaseVoice(voice));
    this.droneVoices.clear();
  }

  // ── Volume Controls ────────────────────────────────────────────────────────

  public setMasterVolume(val: number): void {
    const clamped = Math.max(0, Math.min(1, val));
    this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
  }

  public setMelodyVolume(val: number): void {
    const clamped = Math.max(0, Math.min(1, val));
    this.melodyGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
  }

  public setDroneVolume(val: number): void {
    const clamped = Math.max(0, Math.min(1, val));
    this.droneGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
  }

  public setChordVolume(val: number): void {
    const clamped = Math.max(0, Math.min(1, val));
    this.chordGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
  }

  public getAttackTimeMs(): number {
    return this.attackTime * 1000;
  }

  public getCurrentlyPlayingMidi(): number | null {
    if (this.currentMelodyVoice && !this.currentMelodyVoice.isReleasing) {
      return this.currentMelodyVoice.midiNote;
    }
    return null;
  }

  public getSupportingMidis(): number[] {
    return Array.from(this.supportingVoices.keys());
  }

  public getDroneMidis(): number[] {
    return Array.from(this.droneVoices.keys());
  }
}
