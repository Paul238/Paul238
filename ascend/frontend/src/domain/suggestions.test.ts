import { describe, expect, it } from 'vitest';
import { createEmptyState, reducer } from './engine';
import { parseQuick } from './quickadd';
import { ACTIVITY_SUGGESTIONS, activitySuggestions, recurringSuggestions, shoppingSuggestions } from './suggestions';

const T = '2026-11-09';
const title = (text: string) => parseQuick(text, T).title;

describe('propuneri', () => {
  it('fiecare propunere de activitate se înțelege la adăugarea rapidă', () => {
    for (const list of Object.values(ACTIVITY_SUGGESTIONS)) {
      for (const s of list!) {
        const p = parseQuick(s.text, T);
        expect(p.title.length, s.text).toBeGreaterThan(2);
        expect(p.points, s.text).toBeGreaterThan(0);
        expect(p.title, s.text).not.toMatch(/\d+p$/);
        expect(p.schedule.kind, s.text).not.toBe('once');
      }
    }
  });

  it('o propunere ascunsă nu mai apare, dar se poate readuce', () => {
    let s = createEmptyState();
    const first = activitySuggestions(s, 'health', title)[0];
    s = reducer(s, { type: 'meta/dismiss', id: first.id });
    expect(activitySuggestions(s, 'health', title).map((x) => x.id)).not.toContain(first.id);
    s = reducer(s, { type: 'meta/restoreAll' });
    expect(activitySuggestions(s, 'health', title)[0].id).toBe(first.id);
  });

  it('nu propune ce ai deja', () => {
    let s = createEmptyState();
    s = reducer(s, { type: 'rec/save', rec: { id: 'r', type: 'expense', title: 'chirie', amount: 2000, category: 'rent', day: 1, start: '2026-11', auto: false } });
    expect(recurringSuggestions(s).map((r) => r.title)).not.toContain('Chirie');
    s = reducer(s, { type: 'shop/add', item: { id: 'i', title: 'Pasta de dinti', createdAt: T, category: 'hygiene' } });
    expect(shoppingSuggestions(s, 'hygiene').map((x) => x.title)).not.toContain('Pastă de dinți');
  });
});
