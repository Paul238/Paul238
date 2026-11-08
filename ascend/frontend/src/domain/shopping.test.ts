import { describe, expect, it } from 'vitest';
import { availableCredits, createEmptyState, reducer } from './engine';
import { shoppingSpent } from './shopping';

describe('lista de cumpărături', () => {
  it('bifezi cu costul, intră în istoric, nu atinge creditele', () => {
    let s = createEmptyState();
    s = reducer(s, { type: 'shop/add', item: { id: 'a', title: 'Lapte', qty: '2 l', createdAt: '2026-11-08T10:00:00.000Z' } });
    s = reducer(s, { type: 'shop/add', item: { id: 'b', title: '  ', createdAt: '2026-11-08T10:00:00.000Z' } });
    expect(s.shopping).toHaveLength(1);
    s = reducer(s, { type: 'shop/buy', id: 'a', now: '2026-11-09T12:00:00.000Z', cost: 13.5 });
    expect(s.shopping[0]).toMatchObject({ boughtDate: '2026-11-09', cost: 13.5 });
    expect(shoppingSpent(s.shopping, '2026-11-01', '2026-11-30')).toBe(13.5);
    expect(availableCredits(s)).toBe(0);
    s = reducer(s, { type: 'shop/unbuy', id: 'a' });
    expect(shoppingSpent(s.shopping, '2026-11-01', '2026-11-30')).toBe(0);
  });
});
