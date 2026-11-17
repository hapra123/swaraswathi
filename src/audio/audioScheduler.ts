// src/audio/audioScheduler.ts
// Accurate Web Audio event scheduler. Schedules note-on, legato transitions,
// and note-off events directly against AudioContext.currentTime without main-thread latency.

export interface ScheduledNoteEvent {
  midiNote: number;
  scheduledTime: number;
  type: 'note_on' | 'note_off' | 'legato_switch';
}

export class AudioScheduler {
  private ctx: AudioContext;
  private lookaheadMs = 5.0; // 5ms lookahead buffer for jitter-free scheduling
  private activeScheduledNotes = new Map<number, number>();

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
  }

  /**
   * Returns current high-precision audio timeline timestamp in seconds.
   */
  public getCurrentTime(): number {
    return this.ctx.currentTime;
  }

  /**
   * Calculates immediate schedule time in seconds with small lookahead to prevent underruns.
   */
  public getImmediateScheduleTime(): number {
    return this.ctx.currentTime + this.lookaheadMs / 1000;
  }

  /**
   * Tracks a sounding note.
   */
  public markNoteSounding(midiNote: number): void {
    this.activeScheduledNotes.set(midiNote, this.ctx.currentTime);
  }

  /**
   * Clears a sounding note.
   */
  public markNoteReleased(midiNote: number): void {
    this.activeScheduledNotes.delete(midiNote);
  }

  public isNoteSounding(midiNote: number): boolean {
    return this.activeScheduledNotes.has(midiNote);
  }

  public getSoundingMidis(): number[] {
    return Array.from(this.activeScheduledNotes.keys());
  }

  public reset(): void {
    this.activeScheduledNotes.clear();
  }
}
