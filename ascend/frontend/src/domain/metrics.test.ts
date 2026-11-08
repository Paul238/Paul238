import { describe, expect, it } from 'vitest';
import { attributeLevels, createEmptyState, reducer } from './engine';
import { METRIC_MAP, latestMetric, metricStatus } from './metrics';

const s0 = () => reducer(createEmptyState(), { type: 'onboard', character: { name: 'T', color: '#000', createdAt: '2026-11-01T08:00:00.000Z' }, tasks: [], goals: [], settings: {} });
const add = (metric: 'weight' | 'bp', value: number, value2: number | undefined, id: string, date = '2026-11-02') =>
  ({ type: 'metric/add', entry: { id, metric, date, at: `${date}T08:00:00.000Z`, value, value2 }, grantId: 'x' + id }) as const;

describe('măsurători', () => {
  it('salvează și dă XP o dată pe zi la latura potrivită', () => {
    let s = s0();
    s = reducer(s, add('weight', 82.4, undefined, 'a'));
    s = reducer(s, add('weight', 82.1, undefined, 'b'));
    expect(latestMetric(s, 'weight')?.value).toBe(82.1);
    expect(attributeLevels(s).health.total).toBe(5);
  });
  it('refuză valori imposibile', () => {
    const s = reducer(s0(), add('weight', 8240, undefined, 'a'));
    expect(s.metrics).toHaveLength(0);
  });
  it('tensiunea are două valori și interval normal', () => {
    const s = reducer(s0(), add('bp', 145, 92, 'a'));
    expect(metricStatus(METRIC_MAP.bp, latestMetric(s, 'bp'))).toBe('watch');
    expect(metricStatus(METRIC_MAP.bp, { value: 118, value2: 76 })).toBe('ok');
  });
});
