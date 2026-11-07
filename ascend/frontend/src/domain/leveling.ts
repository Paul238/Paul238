export interface LevelInfo {
  level: number;
  into: number;
  needed: number;
  progress: number;
  total: number;
}

/** XP necesar pentru a trece de la nivelul L la L+1 pe un atribut */
export const attrXpToNext = (level: number) => 100 + 25 * (level - 1);
/** XP necesar pentru nivelul general al personajului */
export const charXpToNext = (level: number) => 300 + 100 * (level - 1);

export function levelFromXp(xp: number, toNext: (l: number) => number): LevelInfo {
  let level = 1;
  let rem = Math.max(0, Math.floor(xp));
  while (rem >= toNext(level)) {
    rem -= toNext(level);
    level++;
  }
  const needed = toNext(level);
  return { level, into: rem, needed, progress: rem / needed, total: Math.floor(xp) };
}

const TITLES: [number, string][] = [
  [40, 'Legendă'],
  [30, 'Mentor'],
  [22, 'Maestru'],
  [15, 'Expert'],
  [10, 'Practician'],
  [6, 'Ucenic'],
  [3, 'Explorator'],
  [1, 'Începător'],
];

export function characterTitle(level: number): string {
  return TITLES.find(([min]) => level >= min)![1];
}
