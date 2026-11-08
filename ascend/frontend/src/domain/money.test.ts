import { describe, expect, it } from 'vitest';
import { createEmptyState, reducer } from './engine';
import { dueAutoPayments, guessCategory, installmentsLeft, loanStatus, monthSummary, parseMoneyLine, recurringForMonth, type Recurring } from './money';
import type { AppState } from './types';

const rec = (r: Partial<Recurring>): Recurring => ({ id: 'r', type: 'expense', title: 'Chirie', amount: 1500, category: 'rent', day: 5, start: '2026-10', auto: false, ...r });

function withRec(rs: Recurring[]): AppState {
  return rs.reduce((s, r) => reducer(s, { type: 'rec/save', rec: r }), createEmptyState());
}

describe('bani', () => {
  it('ghicește categoria', () => {
    expect(guessCategory('Pastă de dinți', 'shopping')).toBe('hygiene');
    expect(guessCategory('Gel duș', 'shopping')).toBe('hygiene');
    expect(guessCategory('Detergent rufe', 'shopping')).toBe('cleaning');
    expect(guessCategory('Lapte', 'shopping')).toBe('food');
    expect(guessCategory('Geacă iarnă')).toBe('clothes');
    expect(guessCategory('Netflix')).toBe('subscriptions');
    expect(guessCategory('Salariu', 'income')).toBe('salary');
  });

  it('interpretează un rând de bani', () => {
    expect(parseMoneyLine('Haine 250')).toEqual({ title: 'Haine', amount: 250, type: 'expense' });
    expect(parseMoneyLine('bon Lidl 87,5 lei')).toEqual({ title: 'Lidl', amount: 87.5, type: 'expense' });
    expect(parseMoneyLine('Salariu 5200')).toMatchObject({ amount: 5200, type: 'income' });
  });

  it('salariul automat, chiria manuală, sumarul lunii', () => {
    let s = withRec([
      rec({ id: 'sal', type: 'income', title: 'Salariu', amount: 5000, category: 'salary', day: 10, auto: true }),
      rec({ id: 'ch', day: 5 }),
      rec({ id: 'net', title: 'Netflix', amount: 50, category: 'subscriptions', day: 20, auto: true }),
    ]);
    s = reducer(s, { type: 'money/autopost', today: '2026-11-12', now: '2026-11-12T08:00:00.000Z', seed: 'a' });
    // octombrie și noiembrie: salariul + Netflix doar în octombrie (în noiembrie e pe 20)
    expect(s.transactions.map((t) => `${t.title}:${t.month}`).sort()).toEqual(['Netflix:2026-10', 'Salariu:2026-10', 'Salariu:2026-11']);
    // a doua rulare nu dublează
    expect(reducer(s, { type: 'money/autopost', today: '2026-11-12', now: '2026-11-12T09:00:00.000Z', seed: 'b' }).transactions).toHaveLength(3);
    expect(recurringForMonth(s, '2026-11', '2026-11-12').find((x) => x.r.id === 'ch')?.overdue).toBe(true);
    s = reducer(s, { type: 'rec/pay', id: 'ch', month: '2026-11', now: '2026-11-12T10:00:00.000Z', txId: 'p' });
    s = reducer(s, { type: 'shop/add', item: { id: 'x', title: 'Pastă de dinți', createdAt: '2026-11-11T10:00:00.000Z', category: 'hygiene' } });
    s = reducer(s, { type: 'shop/buy', id: 'x', now: '2026-11-11T11:00:00.000Z', cost: 12.5 });
    s = reducer(s, { type: 'tx/add', tx: { id: 't', type: 'expense', title: 'Geacă', amount: 300, category: 'clothes', date: '2026-11-11', at: '2026-11-11T12:00:00.000Z' } });
    const m = monthSummary(s, '2026-11', '2026-11-12');
    expect(m.income).toBe(5000);
    expect(m.expenses).toBe(1500 + 12.5 + 300);
    expect(m.left).toBe(5000 - 1812.5);
    expect(m.pendingExpenses).toBe(50);
    expect(m.projected).toBe(5000 - 1812.5 - 50);
    expect(m.byCategory[0]).toEqual({ key: 'rent', amount: 1500 });
  });

  it('ratele au un sfârșit', () => {
    const r = rec({ id: 'rata', title: 'Rată mașină', category: 'loans', start: '2026-01', end: '2027-12' });
    expect(installmentsLeft(r, '2026-11')).toBe(14);
    const s = withRec([r]);
    expect(recurringForMonth(s, '2028-01', '2028-01-10')).toHaveLength(0);
    expect(dueAutoPayments(s, '2026-11-12')).toHaveLength(0);
  });
});

describe('rate cu plată în avans', () => {
  it('plata suplimentară scurtează perioada', () => {
    const r = rec({ id: 'rata', title: 'Rată mașină', amount: 1000, category: 'loans', start: '2026-11', principal: 12000, day: 15 });
    let s = withRec([r]);
    expect(loanStatus(s, r, '2026-11-10')).toMatchObject({ remaining: 12000, left: 12, endMonth: '2027-10' });
    s = reducer(s, { type: 'rec/pay', id: 'rata', month: '2026-11', now: '2026-11-15T10:00:00.000Z', txId: 'p1' });
    s = reducer(s, { type: 'rec/extra', id: 'rata', amount: 3000, now: '2026-11-16T10:00:00.000Z', txId: 'x1' });
    const st = loanStatus(s, s.recurring[0], '2026-11-16')!;
    expect(st).toMatchObject({ remaining: 8000, left: 8, endMonth: '2027-07', savedMonths: 3, extraPaid: 3000 });
    // plata în avans nu marchează rata lunară și se vede la cheltuieli
    expect(monthSummary(s, '2026-11', '2026-11-16').expenses).toBe(4000);
    // după ultima rată, nu mai apare în lunile următoare
    expect(recurringForMonth(s, '2027-08', '2026-11-16')).toHaveLength(0);
    expect(recurringForMonth(s, '2027-07', '2026-11-16')).toHaveLength(1);
  });
});
