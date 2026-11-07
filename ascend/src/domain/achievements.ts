import { ATTRIBUTE_KEYS } from './attributes';
import { attributeLevels, characterLevel, longestStreak, totalEarned } from './engine';
import type { AppState } from './types';

export interface AchievementStats {
  completions: number;
  longestStreak: number;
  characterLevel: number;
  maxAttributeLevel: number;
  attributesAtLeast5: number;
  bonusesCompleted: number;
  goalsPurchased: number;
  developmentPurchases: number;
  totalCredits: number;
  specialTasks: number;
}

export function achievementStats(state: AppState): AchievementStats {
  const levels = attributeLevels(state);
  const lv = ATTRIBUTE_KEYS.map((k) => levels[k].level);
  return {
    completions: state.completions.length,
    longestStreak: longestStreak(state),
    characterLevel: characterLevel(state).level,
    maxAttributeLevel: Math.max(...lv),
    attributesAtLeast5: lv.filter((l) => l >= 5).length,
    bonusesCompleted: state.bonuses.filter((b) => b.status === 'completed').length,
    goalsPurchased: state.goals.filter((g) => g.status === 'purchased').length,
    developmentPurchases: state.goals.filter((g) => g.status === 'purchased' && g.mode === 'development').length,
    totalCredits: totalEarned(state),
    specialTasks: state.tasks.filter((t) => t.special && !t.archived).length,
  };
}

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  tier: AchievementTier;
  target: number;
  value: (s: AchievementStats) => number;
}

const def = (
  id: string,
  title: string,
  description: string,
  tier: AchievementTier,
  target: number,
  value: (s: AchievementStats) => number,
): AchievementDef => ({ id, title, description, tier, target, value });

export const ACHIEVEMENTS: AchievementDef[] = [
  def('first-step', 'Primul pas', 'Finalizează prima sarcină', 'bronze', 1, (s) => s.completions),
  def('fifty', 'Ritm constant', 'Finalizează 50 de sarcini', 'silver', 50, (s) => s.completions),
  def('five-hundred', 'Mașinăria', 'Finalizează 500 de sarcini', 'gold', 500, (s) => s.completions),
  def('streak-7', 'O săptămână fără pauză', 'Serie de 7 zile', 'bronze', 7, (s) => s.longestStreak),
  def('streak-30', 'Obicei format', 'Serie de 30 de zile', 'silver', 30, (s) => s.longestStreak),
  def('streak-100', 'De neoprit', 'Serie de 100 de zile', 'gold', 100, (s) => s.longestStreak),
  def('char-5', 'În ascensiune', 'Personajul ajunge la nivelul 5', 'bronze', 5, (s) => s.characterLevel),
  def('char-15', 'Expert', 'Personajul ajunge la nivelul 15', 'gold', 15, (s) => s.characterLevel),
  def('attr-10', 'Specialist', 'Un atribut ajunge la nivelul 10', 'silver', 10, (s) => s.maxAttributeLevel),
  def('balanced', 'Echilibru', '4 atribute la nivelul 5 sau mai mult', 'gold', 4, (s) => s.attributesAtLeast5),
  def('special-list', 'Pregătit pentru surprize', 'Adaugă 3 sarcini în lista specială', 'bronze', 3, (s) => s.specialTasks),
  def('bonus-1', 'Provocare acceptată', 'Finalizează o provocare bonus', 'bronze', 1, (s) => s.bonusesCompleted),
  def('bonus-10', 'Vânător de bonusuri', 'Finalizează 10 provocări bonus', 'silver', 10, (s) => s.bonusesCompleted),
  def('credits-1k', 'Primii 1.000', 'Câștigă 1.000 de credite', 'bronze', 1000, (s) => s.totalCredits),
  def('credits-10k', 'Capital', 'Câștigă 10.000 de credite', 'gold', 10000, (s) => s.totalCredits),
  def('goal-1', 'Răsplata muncii', 'Finalizează primul obiectiv', 'silver', 1, (s) => s.goalsPurchased),
  def('invest', 'Investiție în tine', 'Finalizează un obiectiv de dezvoltare', 'silver', 1, (s) => s.developmentPurchases),
];

export function unlockedAchievements(state: AppState): string[] {
  const s = achievementStats(state);
  return ACHIEVEMENTS.filter((a) => a.value(s) >= a.target).map((a) => a.id);
}
