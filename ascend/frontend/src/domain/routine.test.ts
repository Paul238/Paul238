import { describe, expect, it } from 'vitest';
import { availableCredits, attributeLevels, createEmptyState, reducer, type Action } from './engine';
import { computedTargets, evaluateTime, nutritionScore, scaleFood, FOOD_DB } from './nutrition';
import type { AppState, Task } from './types';

const at = (h: number, m = 0, day = 0) => new Date(2026, 10, 2 + day, h, m).toISOString();

function setup(tasks: Task[], extra: Partial<AppState['settings']> = {}): AppState {
  return reducer(createEmptyState(), {
    type: 'onboard',
    character: { name: 'T', color: '#000', createdAt: at(6) },
    tasks,
    goals: [],
    settings: extra,
  });
}
const base = { schedule: { kind: 'daily', days: [] } as Task['schedule'], special: false, archived: false, createdAt: at(6) };
const wake: Task = { ...base, id: 'w', kind: 'time', title: 'Trezire', time: '07:00', timeMode: 'by', tolerance: 15, points: 15, attributes: ['discipline'] };
const meal: Task = { ...base, id: 'm', kind: 'meal', title: 'Prânz', time: '13:00', points: 5, attributes: ['health'] };

describe('repere cu oră', () => {
  it('evaluează cel târziu / cel devreme / doar notare', () => {
    expect(evaluateTime('07:00', 'by', 15, '07:14').success).toBe(true);
    expect(evaluateTime('07:00', 'by', 15, '07:16').success).toBe(false);
    expect(evaluateTime('17:00', 'after', 0, '16:59').success).toBe(false);
    expect(evaluateTime('17:00', 'after', 0, '17:30').success).toBe(true);
    expect(evaluateTime('17:00', 'log', 0, '12:00').success).toBe(true);
  });

  it('dă puncte doar dacă reperul e respectat, dar înregistrează ora', () => {
    let s = setup([wake]);
    s = reducer(s, { type: 'task/complete', taskId: 'w', now: at(7, 40), id: 'c1' });
    expect(s.completions[0]).toMatchObject({ value: '07:40', success: false, credits: 0 });
    expect(availableCredits(s)).toBe(0);
    s = reducer(s, { type: 'completion/undo', id: 'c1', now: at(7, 41), entryId: 'u' });
    s = reducer(s, { type: 'task/complete', taskId: 'w', now: at(7, 41), id: 'c2', value: '07:05' });
    expect(s.completions[0]).toMatchObject({ value: '07:05', success: true, credits: 15 });
  });
});

describe('nutriție', () => {
  it('calculează ținte plauzibile', () => {
    const t = computedTargets({ sex: 'm', age: 30, heightCm: 180, weightKg: 80, activity: 1.55, goal: 'maintain', points: 50 });
    expect(t.kcal).toBeGreaterThan(2500);
    expect(t.kcal).toBeLessThan(3000);
    expect(t.protein).toBe(144);
    expect(Math.round(t.protein * 4 + t.carbs * 4 + t.fat * 9)).toBeGreaterThan(t.kcal - 30);
  });

  it('scorul e maxim în ±10% și 0 peste ±50%', () => {
    const tgt = { kcal: 2000, protein: 150, carbs: 200, fat: 60 };
    expect(nutritionScore({ kcal: 2100, protein: 140, carbs: 190, fat: 65 }, tgt).score).toBe(1);
    expect(nutritionScore({ kcal: 4000, protein: 0, carbs: 0, fat: 0 }, tgt).score).toBe(0);
  });

  it('scalează alimentele din listă', () => {
    const egg = FOOD_DB.find((f) => f.name === 'Ou întreg')!;
    expect(scaleFood(egg, 110).protein).toBeCloseTo(13.9, 1);
  });

  it('închiderea zilei acordă credite și XP la Sănătate, o singură dată', () => {
    let s = setup([meal], { nutrition: { sex: 'm', age: 30, heightCm: 180, weightKg: 80, activity: 1.55, goal: 'maintain', points: 50, manual: { kcal: 600, protein: 50, carbs: 60, fat: 20 } } });
    const food = { id: 'f1', name: 'X', kcal: 600, protein: 50, carbs: 60, fat: 20 };
    const acts: Action[] = [
      { type: 'meal/addFood', date: '2026-11-02', taskId: 'm', food, logId: 'ml' },
      { type: 'task/complete', taskId: 'm', now: at(13), id: 'c' },
      { type: 'day/autoclose', today: '2026-11-03', now: at(8, 0, 1), seed: 's' },
      { type: 'day/autoclose', today: '2026-11-03', now: at(9, 0, 1), seed: 's2' },
    ];
    s = acts.reduce(reducer, s);
    expect(s.days['2026-11-02'].nutrition?.score).toBe(1);
    expect(availableCredits(s)).toBe(55);
    expect(attributeLevels(s).health.total).toBe(55);
  });
});

describe('cantități greșite', () => {
  it('refuză 100 kg dintr-un aliment și nu-l pune la recente', async () => {
    const { recentFoods } = await import('./engine');
    let s = setup([meal]);
    s = reducer(s, { type: 'meal/addFood', date: '2026-11-02', taskId: 'm', logId: 'l', food: { id: 'f', name: 'Orez', grams: 100150, kcal: 130195, protein: 1, carbs: 1, fat: 1 } });
    expect(s.meals).toHaveLength(0);
    s = reducer(s, { type: 'meal/addFood', date: '2026-11-02', taskId: 'm', logId: 'l', food: { id: 'g', name: 'Orez', grams: 150, kcal: 195, protein: 4, carbs: 42, fat: 0.5 } });
    expect(recentFoods(s)).toHaveLength(1);
  });
});
