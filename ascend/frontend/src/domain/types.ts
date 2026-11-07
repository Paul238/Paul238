export type DateKey = string; // YYYY-MM-DD, local time
export type ISODate = string; // full ISO timestamp

export type AttributeKey =
  | 'health'
  | 'intellect'
  | 'creativity'
  | 'discipline'
  | 'finance'
  | 'social'
  | 'order'
  | 'career';

export type Schedule =
  /** days: 0 = duminică ... 6 = sâmbătă; listă goală = în fiecare zi */
  | { kind: 'daily'; days: number[] }
  /** de N ori pe săptămână (luni–duminică), maxim o dată pe zi */
  | { kind: 'weekly'; times: number }
  /** o singură dată: la o dată anume (due) sau „când poți” (fără dată) */
  | { kind: 'once'; due?: DateKey }
  /** lunar, în ziua `day` a lunii (dacă luna e mai scurtă, în ultima zi) */
  | { kind: 'monthly'; day: number };

/** task = sarcină obișnuită; time = reper cu oră fixă (trezire, ajuns la muncă…); meal = masă */
export type TaskKind = 'task' | 'time' | 'meal';
/** by = cel târziu la ora țintă; after = cel devreme la ora țintă; log = doar se notează ora */
export type TimeMode = 'by' | 'after' | 'log';

export interface Task {
  id: string;
  kind?: TaskKind;
  /** ora (HH:MM): ținta pentru repere, ora aproximativă pentru mese și sarcini */
  time?: string;
  timeMode?: TimeMode;
  /** toleranța în minute pentru repere */
  tolerance?: number;
  title: string;
  notes?: string;
  points: number;
  /** primul atribut este cel principal (100% XP), restul primesc 50% */
  attributes: AttributeKey[];
  schedule: Schedule;
  /** inclusă în lista specială: poate fi aleasă aleatoriu ca provocare bonus */
  special: boolean;
  archived: boolean;
  createdAt: ISODate;
  /** zile în care o sarcină recurentă e sărită (excepții din calendar) */
  skip?: DateKey[];
}

export interface Completion {
  id: string;
  taskId: string;
  taskTitle: string;
  date: DateKey;
  at: ISODate;
  points: number;
  bonusMultiplier: number;
  streakMultiplier: number;
  credits: number;
  xp: Partial<Record<AttributeKey, number>>;
  bonusId?: string;
  /** ora reală notată (HH:MM), pentru repere */
  value?: string;
  /** reperul a fost respectat */
  success?: boolean;
}

/* ---------- nutriție ---------- */

export interface FoodEntry {
  id: string;
  name: string;
  grams?: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealLog {
  id: string;
  date: DateKey;
  taskId: string;
  foods: FoodEntry[];
}

/** aliment salvat de utilizator (valori pe porție sau la 100 g) */
export interface CustomFood {
  id: string;
  name: string;
  per: 'portion' | '100g';
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type Sex = 'm' | 'f';
export type NutritionGoal = 'cut' | 'maintain' | 'bulk';

export interface NutritionProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  /** factor de activitate 1.2 – 1.9 */
  activity: number;
  goal: NutritionGoal;
  /** ținte setate manual (au prioritate față de calcul) */
  manual?: Partial<MacroTargets>;
  /** credite maxime pentru o zi încadrată perfect */
  points: number;
}

export interface MacroTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DayResult {
  closedAt: ISODate;
  nutrition?: { totals: MacroTargets; targets: MacroTargets; score: number; credits: number };
}

export type LedgerKind = 'earn' | 'reversal' | 'allocate' | 'release' | 'adjust';

export interface LedgerEntry {
  id: string;
  at: ISODate;
  amount: number; // + intră în portofel, - iese
  kind: LedgerKind;
  label: string;
  ref?: string;
}

export type GoalMode = 'shopping' | 'development' | 'leisure';
export type GoalStatus = 'reflecting' | 'active' | 'purchased' | 'abandoned';

export interface Goal {
  id: string;
  title: string;
  mode: GoalMode;
  /** prețul în lei */
  price: number;
  /** credite deja puse deoparte pentru acest obiectiv */
  saved: number;
  status: GoalStatus;
  reason?: string;
  url?: string;
  /** pentru modul dezvoltare: atributul care primește XP la achiziție */
  attribute?: AttributeKey;
  createdAt: ISODate;
  activatesAt: ISODate;
  purchasedAt?: ISODate;
  closedAt?: ISODate;
  /** 1-5: cât de mulțumit ești de achiziție */
  rating?: number;
}

export type BonusStatus = 'active' | 'completed' | 'expired';

export interface BonusChallenge {
  id: string;
  taskId: string;
  taskTitle: string;
  assignedAt: ISODate;
  expiresAt: ISODate;
  multiplier: number;
  revealed: boolean;
  status: BonusStatus;
  completedAt?: ISODate;
}

export interface XpGrant {
  id: string;
  at: ISODate;
  attribute: AttributeKey;
  amount: number;
  label: string;
}

export type BonusFrequency = 'off' | 'low' | 'normal' | 'high' | 'daily';

export interface Settings {
  /** câți lei valorează un credit */
  leiPerCredit: number;
  /** ore de reflecție înainte ca un obiectiv nou să poată primi credite */
  cooldownHours: Record<GoalMode, number>;
  bonusFrequency: BonusFrequency;
  bonusMultiplier: number;
  bonusWindowHours: number;
  streakBonus: boolean;
  /** zile libere: nu întrerup seria (0 = duminică) */
  restDays: number[];
  theme: 'system' | 'dark' | 'light';
  nutrition?: NutritionProfile;
}

export interface Character {
  name: string;
  color: string;
  createdAt: ISODate;
}

export interface Meta {
  pendingDrop?: { at: ISODate; date: DateKey };
  lastBonusRoll?: DateKey;
  seenAchievements: string[];
}

export interface AppState {
  version: 1;
  character: Character | null;
  tasks: Task[];
  completions: Completion[];
  ledger: LedgerEntry[];
  goals: Goal[];
  bonuses: BonusChallenge[];
  xpGrants: XpGrant[];
  meals: MealLog[];
  foods: CustomFood[];
  days: Record<DateKey, DayResult>;
  settings: Settings;
  meta: Meta;
}
