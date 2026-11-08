import type { AppState, DateKey, FoodEntry, MacroTargets, NutritionProfile } from './types';

/* ------------------------------------------------------------------ */
/* Ore                                                                 */
/* ------------------------------------------------------------------ */

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fromMinutes = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export const hhmmOf = (iso: string) => {
  const d = new Date(iso);
  return fromMinutes(d.getHours() * 60 + d.getMinutes());
};

/** rezultatul unui reper cu oră: diferența în minute și dacă a fost respectat */
export function evaluateTime(target: string, mode: 'by' | 'after' | 'log', tolerance: number, actual: string) {
  const diff = toMinutes(actual) - toMinutes(target);
  const success = mode === 'log' ? true : mode === 'by' ? diff <= tolerance : diff >= -tolerance;
  return { diff, success };
}

/* ------------------------------------------------------------------ */
/* Ținte nutriționale (Mifflin-St Jeor)                                */
/* ------------------------------------------------------------------ */

export const ACTIVITY_LEVELS: { value: number; label: string }[] = [
  { value: 1.2, label: 'Sedentar (birou, fără sport)' },
  { value: 1.375, label: 'Ușor activ (sport 1–3 zile/săpt.)' },
  { value: 1.55, label: 'Moderat activ (sport 3–5 zile/săpt.)' },
  { value: 1.725, label: 'Foarte activ (sport 6–7 zile/săpt.)' },
  { value: 1.9, label: 'Extrem de activ (muncă fizică + sport)' },
];

export const DEFAULT_NUTRITION: NutritionProfile = {
  sex: 'm',
  age: 30,
  heightCm: 178,
  weightKg: 80,
  activity: 1.375,
  goal: 'maintain',
  points: 50,
};

export function computedTargets(p: NutritionProfile): MacroTargets {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const factor = p.goal === 'cut' ? 0.8 : p.goal === 'bulk' ? 1.1 : 1;
  const kcal = Math.round((bmr * p.activity * factor) / 10) * 10;
  const protein = Math.round(p.weightKg * (p.goal === 'cut' ? 2.0 : 1.8));
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(50, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

export function targetsFor(p: NutritionProfile): MacroTargets {
  return { ...computedTargets(p), ...Object.fromEntries(Object.entries(p.manual ?? {}).filter(([, v]) => typeof v === 'number' && v > 0)) };
}

export function sumFoods(foods: FoodEntry[]): MacroTargets {
  return foods.reduce(
    (t, f) => ({ kcal: t.kcal + f.kcal, protein: t.protein + f.protein, carbs: t.carbs + f.carbs, fat: t.fat + f.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function dayTotals(state: AppState, date: DateKey): MacroTargets {
  return sumFoods(state.meals.filter((m) => m.date === date).flatMap((m) => m.foods));
}

/** 1 = perfect; scade liniar între ±10% și ±50% abatere */
function closeness(actual: number, target: number) {
  if (target <= 0) return 1;
  const dev = Math.abs(actual - target) / target;
  if (dev <= 0.1) return 1;
  if (dev >= 0.5) return 0;
  return 1 - (dev - 0.1) / 0.4;
}

export function nutritionScore(totals: MacroTargets, targets: MacroTargets) {
  const parts = {
    kcal: closeness(totals.kcal, targets.kcal),
    protein: closeness(totals.protein, targets.protein),
    carbs: closeness(totals.carbs, targets.carbs),
    fat: closeness(totals.fat, targets.fat),
  };
  const score = parts.kcal * 0.4 + parts.protein * 0.3 + parts.carbs * 0.15 + parts.fat * 0.15;
  return { score, parts };
}

/* ------------------------------------------------------------------ */
/* Alimente uzuale (valori la 100 g, aproximative)                     */
/* ------------------------------------------------------------------ */

/** limite de bun-simț pentru o singură intrare */
export const MAX_GRAMS = 5000;
export const WARN_GRAMS = 2000;
export const MAX_KCAL = 10000;

export function plausibleFood(f: { grams?: number; kcal: number; protein: number; carbs: number; fat: number }) {
  const vals = [f.kcal, f.protein, f.carbs, f.fat];
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return false;
  if (f.kcal > MAX_KCAL || f.protein > 1000 || f.carbs > 2000 || f.fat > 1000) return false;
  return f.grams === undefined || (f.grams > 0 && f.grams <= MAX_GRAMS);
}

export interface FoodRef {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** porție uzuală */
  unit?: { label: string; grams: number };
}

const f = (name: string, kcal: number, protein: number, carbs: number, fat: number, unit?: [string, number]): FoodRef => ({
  name,
  kcal,
  protein,
  carbs,
  fat,
  unit: unit ? { label: unit[0], grams: unit[1] } : undefined,
});

export const FOOD_DB: FoodRef[] = [
  f('Ou întreg', 143, 12.6, 0.7, 9.5, ['buc', 55]),
  f('Albuș de ou', 52, 11, 0.7, 0.2, ['buc', 33]),
  f('Piept de pui (gătit)', 165, 31, 0, 3.6),
  f('Pulpă de pui fără piele (gătită)', 209, 26, 0, 10.9),
  f('Carne de vită slabă (gătită)', 217, 26, 0, 12),
  f('Cotlet de porc (gătit)', 231, 27, 0, 13),
  f('Carne tocată vită (gătită)', 254, 26, 0, 17),
  f('Somon', 208, 20, 0, 13),
  f('Ton în apă (conservă)', 116, 26, 0, 1, ['conservă', 120]),
  f('Pește alb (gătit)', 105, 23, 0, 1.2),
  f('Șuncă presată', 145, 21, 1.5, 6, ['felie', 20]),
  f('Cârnați', 300, 13, 2, 27),
  f('Orez alb fiert', 130, 2.7, 28, 0.3),
  f('Orez brun fiert', 112, 2.6, 23, 0.9),
  f('Paste fierte', 158, 5.8, 31, 0.9),
  f('Cartofi fierți', 87, 1.9, 20, 0.1),
  f('Cartofi prăjiți', 312, 3.4, 41, 15),
  f('Mămăligă', 85, 2, 18, 0.5),
  f('Pâine albă', 265, 9, 49, 3.2, ['felie', 30]),
  f('Pâine integrală', 247, 13, 41, 3.4, ['felie', 35]),
  f('Fulgi de ovăz', 389, 16.9, 66, 6.9),
  f('Fasole boabe fiartă', 127, 8.7, 22.8, 0.5),
  f('Linte fiartă', 116, 9, 20, 0.4),
  f('Iaurt grecesc 2%', 73, 10, 3.9, 2, ['pahar', 150]),
  f('Iaurt simplu 3.5%', 61, 3.5, 4.7, 3.3, ['pahar', 140]),
  f('Lapte 1.5%', 46, 3.3, 4.8, 1.5, ['pahar 250 ml', 250]),
  f('Brânză de vaci', 98, 11, 3.4, 4.3),
  f('Telemea', 250, 17, 0.5, 20),
  f('Cașcaval', 360, 25, 1.5, 28, ['felie', 20]),
  f('Unt', 717, 0.9, 0.1, 81, ['linguriță', 5]),
  f('Ulei de măsline', 884, 0, 0, 100, ['lingură', 13]),
  f('Unt de arahide', 588, 25, 20, 50, ['lingură', 16]),
  f('Nuci', 654, 15, 14, 65, ['pumn', 30]),
  f('Migdale', 579, 21, 22, 50, ['pumn', 30]),
  f('Banană', 89, 1.1, 23, 0.3, ['buc', 120]),
  f('Măr', 52, 0.3, 14, 0.2, ['buc', 180]),
  f('Portocală', 47, 0.9, 12, 0.1, ['buc', 150]),
  f('Struguri', 69, 0.7, 18, 0.2),
  f('Roșii', 18, 0.9, 3.9, 0.2, ['buc', 120]),
  f('Castraveți', 15, 0.7, 3.6, 0.1, ['buc', 200]),
  f('Salată verde', 15, 1.4, 2.9, 0.2),
  f('Broccoli', 34, 2.8, 7, 0.4),
  f('Avocado', 160, 2, 8.5, 14.7, ['buc', 150]),
  f('Ciorbă de legume', 35, 1.5, 5, 1, ['bol', 300]),
  f('Ciorbă de perișoare', 60, 4, 5, 2.5, ['bol', 300]),
  f('Sarmale', 160, 8, 9, 10, ['buc', 80]),
  f('Pizza', 266, 11, 33, 10, ['felie', 110]),
  f('Shaorma', 215, 11, 20, 10, ['porție', 450]),
  f('Proteină whey (pudră)', 400, 80, 8, 6, ['scoop', 30]),
  f('Ciocolată', 546, 4.9, 61, 31, ['pătrățel', 5]),
  f('Biscuiți', 480, 6, 70, 20, ['buc', 10]),
  f('Suc natural de portocale', 45, 0.7, 10, 0.2, ['pahar 250 ml', 250]),
  f('Cola', 42, 0, 10.6, 0, ['doză 330 ml', 330]),
  f('Bere', 43, 0.5, 3.6, 0, ['sticlă 500 ml', 500]),
  f('Zahăr', 387, 0, 100, 0, ['linguriță', 5]),
  f('Miere', 304, 0.3, 82, 0, ['linguriță', 7]),
];

/** valorile pentru o cantitate în grame dintr-un aliment la 100 g */
export function scaleFood(ref: { kcal: number; protein: number; carbs: number; fat: number }, grams: number) {
  const k = grams / 100;
  const r = (v: number) => Math.round(v * k * 10) / 10;
  return { kcal: Math.round(ref.kcal * k), protein: r(ref.protein), carbs: r(ref.carbs), fat: r(ref.fat) };
}
