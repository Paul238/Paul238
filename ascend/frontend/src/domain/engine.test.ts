import { describe, expect, it } from 'vitest';
import {
  activeBonus,
  attributeLevels,
  availableCredits,
  calendarDay,
  createEmptyState,
  currentStreak,
  goalDeadlinePlan,
  goalProgress,
  goalRequiredCredits,
  reducer,
  tasksForDay,
  type Action,
} from './engine';
import type { AppState, Task } from './types';

const T0 = new Date(2026, 10, 2, 9, 0, 0); // luni, 2 noiembrie 2026, 09:00 local
const at = (dayOffset: number, hour = 9) => {
  const d = new Date(T0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

function task(id: string, patch: Partial<Task> = {}): Task {
  return {
    id,
    title: `Sarcina ${id}`,
    points: 20,
    attributes: ['intellect', 'career'],
    schedule: { kind: 'daily', days: [] },
    special: false,
    archived: false,
    createdAt: at(0, 8),
    ...patch,
  };
}

function setup(tasks: Task[]): AppState {
  return reducer(createEmptyState(), {
    type: 'onboard',
    character: { name: 'Test', color: '#000', createdAt: at(0, 8) },
    tasks,
    goals: [],
    settings: {},
  });
}

const run = (s: AppState, ...actions: Action[]) => actions.reduce(reducer, s);
let n = 0;
const complete = (taskId: string, now: string): Action => ({ type: 'task/complete', taskId, now, id: `c${n++}` });

describe('finalizarea sarcinilor', () => {
  it('acordă credite și XP (atribut principal 100%, secundar 50%)', () => {
    const s = run(setup([task('a')]), complete('a', at(0)));
    expect(availableCredits(s)).toBe(20);
    expect(s.completions[0].xp).toEqual({ intellect: 20, career: 10 });
  });

  it('nu permite bifarea de două ori în aceeași zi', () => {
    const s = run(setup([task('a')]), complete('a', at(0)), complete('a', at(0, 15)));
    expect(s.completions).toHaveLength(1);
  });

  it('anularea scade creditele', () => {
    let s = run(setup([task('a')]), complete('a', at(0)));
    s = reducer(s, { type: 'completion/undo', id: s.completions[0].id, now: at(0, 10), entryId: 'u1' });
    expect(s.completions).toHaveLength(0);
    expect(availableCredits(s)).toBe(0);
  });

  it('sarcinile săptămânale dispar după atingerea țintei', () => {
    const s = run(setup([task('w', { schedule: { kind: 'weekly', times: 2 } })]), complete('w', at(0)), complete('w', at(1)));
    expect(tasksForDay(s, '2026-11-04').find((i) => i.task.id === 'w')).toBeUndefined();
    // săptămâna următoare reapare
    expect(tasksForDay(s, '2026-11-09').find((i) => i.task.id === 'w')).toBeDefined();
  });

  it('sarcinile programate pe anumite zile apar doar atunci', () => {
    const s = setup([task('l', { schedule: { kind: 'daily', days: [1] } })]); // doar luni
    expect(tasksForDay(s, '2026-11-02')).toHaveLength(1);
    expect(tasksForDay(s, '2026-11-03')).toHaveLength(0);
  });
});

describe('serii (streak)', () => {
  it('crește multiplicatorul cu 1% pe zi de serie', () => {
    const s = run(setup([task('a')]), complete('a', at(0)), complete('a', at(1)), complete('a', at(2)));
    expect(currentStreak(s, '2026-11-04').days).toBe(3);
    expect(s.completions[2].streakMultiplier).toBeCloseTo(1.02);
    expect(s.completions[2].credits).toBe(20); // 20.4 rotunjit
  });

  it('zilele libere nu întrerup seria', () => {
    let s = setup([task('a')]);
    s = reducer(s, { type: 'settings/update', patch: { restDays: [3] } }); // miercuri liber
    s = run(s, complete('a', at(0)), complete('a', at(1)), complete('a', at(3))); // L, Ma, J
    expect(currentStreak(s, '2026-11-05').days).toBe(3);
  });

  it('o zi ratată resetează seria', () => {
    const s = run(setup([task('a')]), complete('a', at(0)), complete('a', at(2)));
    expect(currentStreak(s, '2026-11-04').days).toBe(1);
  });
});

describe('provocări bonus', () => {
  const tick = (now: string, roll = 0, dropRoll = 0, pickRoll = 0, id = 'b' + n++): Action => ({
    type: 'bonus/tick',
    now,
    roll,
    dropRoll,
    pickRoll,
    id,
  });

  it('alege doar din lista specială și dă ×5 la bifare', () => {
    let s = setup([task('normal'), task('spec', { special: true, points: 10 })]);
    s = run(s, tick(at(0)));
    const b = activeBonus(s, at(0, 10));
    expect(b?.taskId).toBe('spec');
    expect(b?.revealed).toBe(false);
    s = run(s, complete('spec', at(0, 11)));
    expect(s.completions[0].credits).toBe(50);
    expect(s.completions[0].xp.intellect).toBe(50);
    expect(s.bonuses[0].status).toBe('completed');
  });

  it('expiră după 24 de ore', () => {
    let s = run(setup([task('spec', { special: true })]), tick(at(0)));
    s = run(s, tick(at(1, 10)));
    expect(s.bonuses[0].status).toBe('expired');
  });

  it('nu apare nimic dacă lista specială e goală', () => {
    const s = run(setup([task('a')]), tick(at(0)));
    expect(s.bonuses).toHaveLength(0);
  });

  it('respectă probabilitatea și se decide o singură dată pe zi', () => {
    let s = setup([task('spec', { special: true })]);
    s = run(s, tick(at(0), 0.9)); // 0.9 > 0.5 (normal) → fără provocare azi
    s = run(s, tick(at(0, 12), 0));
    expect(s.bonuses).toHaveLength(0);
    s = run(s, tick(at(1), 0));
    expect(s.bonuses).toHaveLength(1);
  });

  it('apare la o oră aleatorie din zi', () => {
    let s = setup([task('spec', { special: true })]);
    s = run(s, tick(at(0, 9), 0, 0.5)); // programată la ~15:00
    expect(s.bonuses).toHaveLength(0);
    expect(s.meta.pendingDrop).toBeDefined();
    s = run(s, tick(at(0, 16)));
    expect(s.bonuses).toHaveLength(1);
  });

  it('anularea sarcinii reactivează provocarea', () => {
    let s = run(setup([task('spec', { special: true })]), tick(at(0)), complete('spec', at(0, 10)));
    s = reducer(s, { type: 'completion/undo', id: s.completions[0].id, now: at(0, 11), entryId: 'u' });
    expect(s.bonuses[0].status).toBe('active');
    expect(availableCredits(s)).toBe(0);
  });
});

describe('obiective', () => {
  const create = (mode: 'shopping' | 'development' = 'shopping', price = 100): Action => ({
    type: 'goal/create',
    goal: { id: 'g', title: 'Laptop', mode, price, createdAt: at(0) },
  });

  it('obiectivele de cumpărături intră în reflecție 48h', () => {
    let s = run(setup([task('a')]), create());
    expect(s.goals[0].status).toBe('reflecting');
    s = reducer(s, { type: 'goal/confirm', id: 'g', now: at(1) });
    expect(s.goals[0].status).toBe('reflecting');
    s = reducer(s, { type: 'goal/confirm', id: 'g', now: at(2, 10) });
    expect(s.goals[0].status).toBe('active');
  });

  it('alocarea nu poate depăși disponibilul sau prețul', () => {
    let s = run(setup([task('a', { points: 80 })]), create('development'), complete('a', at(0)));
    s = reducer(s, { type: 'goal/allocate', id: 'g', amount: 1000, now: at(0), entryId: 'x' });
    expect(s.goals[0].saved).toBe(80);
    expect(availableCredits(s)).toBe(0);
  });

  it('achiziția de dezvoltare oferă XP atributului ales', () => {
    let s = setup([task('a', { points: 100 })]);
    s = run(
      s,
      { type: 'goal/create', goal: { id: 'g', title: 'Curs', mode: 'development', price: 100, createdAt: at(0), attribute: 'finance' } },
      complete('a', at(0)),
      { type: 'goal/allocate', id: 'g', amount: 100, now: at(0), entryId: 'x' },
      { type: 'goal/purchase', id: 'g', now: at(0), entryId: 'y', grantId: 'z' },
    );
    expect(s.goals[0].status).toBe('purchased');
    expect(attributeLevels(s).finance.total).toBe(20);
  });

  it('renunțarea returnează creditele', () => {
    let s = run(setup([task('a', { points: 50 })]), create('development'), complete('a', at(0)));
    s = run(s, { type: 'goal/allocate', id: 'g', amount: 30, now: at(0), entryId: 'x' }, { type: 'goal/abandon', id: 'g', now: at(0), entryId: 'y' });
    expect(availableCredits(s)).toBe(50);
  });

  it('creditele necesare respectă cursul lei/credit', () => {
    const s = setup([]);
    expect(goalRequiredCredits({ price: 6000 } as never, { ...s.settings, leiPerCredit: 2 })).toBe(3000);
  });
});

describe('scuturi de serie', () => {
  it('după 7 zile active, o zi ratată nu rupe seria', () => {
    let s = setup([task('a')]);
    for (let i = 0; i < 7; i++) s = reducer(s, complete('a', at(i)));
    // ziua 7 ratată, ziua 8 activă
    s = reducer(s, complete('a', at(8)));
    expect(currentStreak(s, '2026-11-10').days).toBe(8);
    expect(currentStreak(s, '2026-11-10').shields).toBe(0);
  });

  it('fără scut, o zi ratată resetează seria', () => {
    const s = run(setup([task('a')]), complete('a', at(0)), complete('a', at(1)), complete('a', at(3)));
    expect(currentStreak(s, '2026-11-05').days).toBe(1);
  });
});

describe('programare flexibilă', () => {
  it('în anumite zile: sala luni, miercuri, vineri', () => {
    const s = setup([task('sala', { schedule: { kind: 'daily', days: [1, 3, 5] } })]);
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((d) => tasksForDay(s, d).length);
    expect(days).toEqual([1, 0, 1, 0, 1]);
  });

  it('lunar: ziua 31 cade în ultima zi a lunilor scurte', () => {
    const s = setup([task('factura', { schedule: { kind: 'monthly', day: 31 } })]);
    expect(tasksForDay(s, '2026-11-30')).toHaveLength(1);
    expect(tasksForDay(s, '2026-11-29')).toHaveLength(0);
    expect(tasksForDay(s, '2026-12-31')).toHaveLength(1);
  });

  it('o dată la o dată anume: apare doar atunci, apoi ca restanță azi', () => {
    const s = setup([task('dentist', { schedule: { kind: 'once', due: '2026-11-04' } })]);
    expect(tasksForDay(s, '2026-11-03', { today: '2026-11-03' })).toHaveLength(0);
    expect(tasksForDay(s, '2026-11-04', { today: '2026-11-03' })).toHaveLength(1);
    const late = tasksForDay(s, '2026-11-06', { today: '2026-11-06' });
    expect(late[0]?.overdue).toBe(true);
    // în calendar, zilele trecute nu primesc restanța
    expect(tasksForDay(s, '2026-11-05', { today: '2026-11-06' })).toHaveLength(0);
  });

  it('nu apare înainte să fi fost creată', () => {
    const s = setup([task('a', { createdAt: at(3) })]);
    expect(tasksForDay(s, '2026-11-02')).toHaveLength(0);
    expect(tasksForDay(s, '2026-11-05')).toHaveLength(1);
  });

  it('calendarul marchează zilele trecute ratate și pe cele viitoare planificate', () => {
    let s = setup([task('a')]);
    s = reducer(s, complete('a', at(0)));
    expect(calendarDay(s, '2026-11-02', '2026-11-04')[0].status).toBe('done');
    expect(calendarDay(s, '2026-11-03', '2026-11-04')[0].status).toBe('missed');
    expect(calendarDay(s, '2026-11-06', '2026-11-04')[0].status).toBe('planned');
  });
});

describe('excepții pe zi', () => {
  it('sari peste sala doar mâine, regula rămâne', () => {
    let s = setup([task('sala', { schedule: { kind: 'daily', days: [1, 3, 5] } })]);
    s = reducer(s, { type: 'task/skipDate', id: 'sala', date: '2026-11-04', skip: true });
    expect(tasksForDay(s, '2026-11-04')).toHaveLength(0);
    expect(tasksForDay(s, '2026-11-06')).toHaveLength(1);
    expect(calendarDay(s, '2026-11-04', '2026-11-03')[0].status).toBe('skipped');
    s = reducer(s, { type: 'task/skipDate', id: 'sala', date: '2026-11-04', skip: false });
    expect(tasksForDay(s, '2026-11-04')).toHaveLength(1);
  });
});

describe('obiective cu portofel comun', () => {
  it('progresul folosește automat creditele disponibile, la toate obiectivele', () => {
    let s = setup([task('a', { points: 60 })]);
    s = run(
      s,
      { type: 'goal/create', goal: { id: 'g1', title: 'Curs', mode: 'development', price: 100, createdAt: at(0) } },
      { type: 'goal/create', goal: { id: 'g2', title: 'Carte', mode: 'development', price: 50, createdAt: at(0) } },
      complete('a', at(0)),
    );
    expect(goalProgress(s, s.goals[0])).toMatchObject({ have: 60, missing: 40, affordable: false });
    expect(goalProgress(s, s.goals[1])).toMatchObject({ have: 50, affordable: true });
  });

  it('cumpărarea scade automat creditele din portofel', () => {
    let s = setup([task('a', { points: 60 })]);
    s = run(
      s,
      { type: 'goal/create', goal: { id: 'g', title: 'Carte', mode: 'development', price: 50, createdAt: at(0) } },
      complete('a', at(0)),
      { type: 'goal/purchase', id: 'g', now: at(0, 12), entryId: 'p', grantId: 'x' },
    );
    expect(s.goals[0].status).toBe('purchased');
    expect(availableCredits(s)).toBe(10);
    expect(s.ledger[s.ledger.length - 1]).toMatchObject({ kind: 'spend', amount: -50 });
  });

  it('nu se poate cumpăra fără destule credite sau în perioada de reflecție', () => {
    let s = setup([task('a', { points: 30 })]);
    s = run(
      s,
      { type: 'goal/create', goal: { id: 'g', title: 'Carte', mode: 'development', price: 50, createdAt: at(0) } },
      { type: 'goal/create', goal: { id: 'h', title: 'Joc', mode: 'shopping', price: 10, createdAt: at(0) } },
      complete('a', at(0)),
      { type: 'goal/purchase', id: 'g', now: at(0, 12), entryId: 'p', grantId: 'x' },
      { type: 'goal/purchase', id: 'h', now: at(0, 12), entryId: 'q', grantId: 'y' },
    );
    expect(s.goals.map((g) => g.status)).toEqual(['active', 'reflecting']);
    expect(availableCredits(s)).toBe(30);
  });
});

describe('preț real la achiziție', () => {
  const base = (): AppState =>
    run(
      setup([task('a', { points: 100 })]),
      { type: 'goal/create', goal: { id: 'g', title: 'Office', mode: 'development', price: 80, createdAt: at(0) } },
      complete('a', at(0)),
    );

  it('se scad doar creditele pentru prețul plătit', () => {
    const s = reducer(base(), { type: 'goal/purchase', id: 'g', now: at(0, 12), entryId: 'p', grantId: 'x', price: 30 });
    expect(s.goals[0]).toMatchObject({ status: 'purchased', paidPrice: 30, paidCredits: 30 });
    expect(availableCredits(s)).toBe(70);
  });

  it('corectarea ulterioară returnează sau scade diferența', () => {
    let s = reducer(base(), { type: 'goal/purchase', id: 'g', now: at(0, 12), entryId: 'p', grantId: 'x' });
    expect(availableCredits(s)).toBe(20);
    s = reducer(s, { type: 'goal/reprice', id: 'g', price: 30, now: at(0, 13), entryId: 'r' });
    expect(availableCredits(s)).toBe(70);
    s = reducer(s, { type: 'goal/reprice', id: 'g', price: 500, now: at(0, 14), entryId: 'r2' });
    expect(s.goals[0].paidPrice).toBe(30); // nu sunt destule credite
  });
});

describe('zile în plus', () => {
  it('adaugi sala și mâine, deși nu e zi de sală', () => {
    let s = setup([task('sala', { schedule: { kind: 'daily', days: [1, 3, 5] } })]);
    expect(tasksForDay(s, '2026-11-03')).toHaveLength(0);
    s = reducer(s, { type: 'task/extraDate', id: 'sala', date: '2026-11-03', add: true });
    expect(tasksForDay(s, '2026-11-03')).toHaveLength(1);
    expect(calendarDay(s, '2026-11-03', '2026-11-02')[0].status).toBe('planned');
    expect(tasksForDay(s, '2026-11-05')).toHaveLength(0);
  });

  it('o activitate neprogramată poate fi bifată oricând și dă puncte', () => {
    let s = setup([task('sala', { schedule: { kind: 'daily', days: [1] } })]);
    s = reducer(s, complete('sala', at(1)));
    expect(availableCredits(s)).toBe(20);
    expect(tasksForDay(s, '2026-11-03')[0].status).toBe('done');
  });
});

describe('termen la obiective', () => {
  it('calculează creditele pe zi necesare și dacă ritmul ajunge', () => {
    let s = setup([task('a', { points: 50 })]);
    s = run(
      s,
      { type: 'goal/create', goal: { id: 'g', title: 'Telefon', mode: 'development', price: 1050, createdAt: at(0), deadline: '2026-11-22' } },
      complete('a', at(0)),
    );
    const p = goalDeadlinePlan(s, s.goals[0], '2026-11-02')!;
    expect(p.daysLeft).toBe(20);
    expect(p.perDay).toBe(50);
    expect(p.status).toBe('onTrack');
    expect(goalDeadlinePlan(s, s.goals[0], '2026-11-25')!.status).toBe('overdue');
  });
});
