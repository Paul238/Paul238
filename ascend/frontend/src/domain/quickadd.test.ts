import { describe, expect, it } from 'vitest';
import { parseQuick } from './quickadd';

const T = '2026-11-09'; // luni

describe('adăugare rapidă', () => {
  it('sală luni miercuri vineri 18:00 30p', () => {
    const p = parseQuick('Sală luni miercuri vineri 18:00 30p', T);
    expect(p).toMatchObject({ title: 'Sală', time: '18:00', points: 30, schedule: { kind: 'daily', days: [1, 3, 5] } });
  });
  it('prescurtări și „și”', () => {
    expect(parseQuick('Înot ma și joi', T).schedule).toEqual({ kind: 'daily', days: [2, 4] });
    expect(parseQuick('Sală L Mi V', T).schedule).toEqual({ kind: 'daily', days: [1, 3, 5] });
  });
  it('mâine, dată și lună', () => {
    expect(parseQuick('Dentist mâine 15:30', T)).toMatchObject({ title: 'Dentist', time: '15:30', schedule: { kind: 'once', due: '2026-11-10' } });
    expect(parseQuick('Analize 20.11', T).schedule).toEqual({ kind: 'once', due: '2026-11-20' });
    expect(parseQuick('Revizie mașină 3 decembrie', T).schedule).toEqual({ kind: 'once', due: '2026-12-03' });
  });
  it('lunar, de N ori, zilnic, L-V, weekend', () => {
    expect(parseQuick('Plată chirie lunar pe 5', T)).toMatchObject({ title: 'Plată chirie', schedule: { kind: 'monthly', day: 5 } });
    expect(parseQuick('Alergare de 2 ori pe săptămână', T)).toMatchObject({ title: 'Alergare', schedule: { kind: 'weekly', times: 2 } });
    expect(parseQuick('Citit zilnic 20 pct', T)).toMatchObject({ title: 'Citit', points: 20, schedule: { kind: 'daily', days: [] } });
    expect(parseQuick('Trezire L-V 7:00', T)).toMatchObject({ title: 'Trezire', kind: 'time', time: '07:00', schedule: { kind: 'daily', days: [1, 2, 3, 4, 5] } });
    expect(parseQuick('Curățenie weekend', T).schedule).toEqual({ kind: 'daily', days: [6, 0] });
  });
  it('fără nimic recunoscut: zilnic, titlu întreg', () => {
    expect(parseQuick('Meditație', T)).toMatchObject({ title: 'Meditație', schedule: { kind: 'daily', days: [] } });
    expect(parseQuick('Vizită la Dan', T).title).toBe('Vizită la Dan');
  });
});
describe('oră vs dată', () => {
  it('„la 7.30” e oră, „20.11” e dată', () => {
    expect(parseQuick('Trezire la 7.30', T).time).toBe('07:30');
    expect(parseQuick('Ședință 20.11 la 10', T)).toMatchObject({ time: '10:00', schedule: { kind: 'once', due: '2026-11-20' } });
  });
});
