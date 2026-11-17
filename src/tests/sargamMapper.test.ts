// src/tests/sargamMapper.test.ts
import { describe, it, expect } from 'vitest';
import { mapFrequencyToNoteInfo } from '../utils/sargamMapper';

describe('Sargam Mapper', () => {
  it('correctly maps Shuddha Swaras with C tonic (C3 reference = 130.81 Hz)', () => {
    // C3 (130.81 Hz) -> Sa (Madhya)
    const sa = mapFrequencyToNoteInfo(130.81, 'C', 3);
    expect(sa).not.toBeNull();
    expect(sa!.swara.shortName).toBe('Sa');
    expect(sa!.swara.isShuddha).toBe(true);

    // G3 (196.00 Hz) -> Pa (+7 semitones)
    const pa = mapFrequencyToNoteInfo(196.00, 'C', 3);
    expect(pa).not.toBeNull();
    expect(pa!.swara.shortName).toBe('Pa');
    expect(pa!.swara.isShuddha).toBe(true);

    // E3 (164.81 Hz) -> Ga (+4 semitones)
    const ga = mapFrequencyToNoteInfo(164.81, 'C', 3);
    expect(ga).not.toBeNull();
    expect(ga!.swara.shortName).toBe('Ga');
    expect(ga!.swara.isShuddha).toBe(true);
  });

  it('correctly maps Komal and Tivra swaras', () => {
    // C#3 / Db3 (~138.59 Hz) -> Komal Rishabh (re)
    const reKomal = mapFrequencyToNoteInfo(138.59, 'C', 3);
    expect(reKomal).not.toBeNull();
    expect(reKomal!.swara.shortName).toBe('re');
    expect(reKomal!.swara.isKomal).toBe(true);

    // F#3 (~185.00 Hz) -> Tivra Madhyam (Ma')
    const maTivra = mapFrequencyToNoteInfo(185.00, 'C', 3);
    expect(maTivra).not.toBeNull();
    expect(maTivra!.swara.shortName).toBe("Ma'");
    expect(maTivra!.swara.isTivra).toBe(true);
  });

  it('correctly tracks Saptak (Octaves)', () => {
    // C2 (65.41 Hz) with C3 reference -> Mandra Saptak
    const mandraSa = mapFrequencyToNoteInfo(65.41, 'C', 3);
    expect(mandraSa).not.toBeNull();
    expect(mandraSa!.saptak).toBe('mandra');

    // C4 (261.63 Hz) with C3 reference -> Taar Saptak
    const taarSa = mapFrequencyToNoteInfo(261.63, 'C', 3);
    expect(taarSa).not.toBeNull();
    expect(taarSa!.saptak).toBe('taar');
  });

  it('correctly shifts swaras when tonic changes to D', () => {
    // With D tonic:
    // D3 (146.83 Hz) is Sa
    const dSa = mapFrequencyToNoteInfo(146.83, 'D', 3);
    expect(dSa).not.toBeNull();
    expect(dSa!.swara.shortName).toBe('Sa');

    // A3 (220.00 Hz) is Pa (7 semitones above D)
    const dPa = mapFrequencyToNoteInfo(220.00, 'D', 3);
    expect(dPa).not.toBeNull();
    expect(dPa!.swara.shortName).toBe('Pa');
  });
});
