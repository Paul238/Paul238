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
  | 'career'
  /** latură adăugată de utilizator */
  | `x-${string}`;

/** laturile cercului: cele ascunse și cele adăugate de utilizator */
export interface AreasConfig {
  hidden: AttributeKey[];
  custom: { key: AttributeKey; label: string; description: string; color: string; icon?: string }[];
}

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
  archived: boolean;
  createdAt: ISODate;
  /** pentru mese: ținta de calorii și macro a mesei (dacă o depășești, primești mai puține credite) */
  target?: Partial<MacroTargets>;
  /** zile în care o sarcină recurentă e sărită (excepții din calendar) */
  skip?: DateKey[];
  /** zile în plus în care apare (planificate manual, ex. „mâine merg și la sală”) */
  extra?: DateKey[];
}

export interface Completion {
  id: string;
  taskId: string;
  taskTitle: string;
  date: DateKey;
  at: ISODate;
  points: number;
  credits: number;
  xp: Partial<Record<AttributeKey, number>>;
  /** ora reală notată (HH:MM), pentru repere */
  value?: string;
  /** reperul a fost respectat */
  success?: boolean;
  /** pentru mese cu țintă: încadrarea (0–1) */
  score?: number;
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

export type LedgerKind = 'earn' | 'reversal' | 'allocate' | 'release' | 'adjust' | 'spend';

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
  /** termenul până la care vrei să-l atingi */
  deadline?: DateKey;
  /** prețul real plătit (lei) și creditele scăzute la achiziție */
  paidPrice?: number;
  paidCredits?: number;
  /** 1-5: cât de mulțumit ești de achiziție */
  rating?: number;
}

export interface XpGrant {
  id: string;
  at: ISODate;
  attribute: AttributeKey;
  amount: number;
  label: string;
}

export interface Settings {
  /** câți lei valorează un credit */
  leiPerCredit: number;
  /** ore de reflecție înainte ca un obiectiv nou să poată primi credite */
  cooldownHours: Record<GoalMode, number>;
  theme: 'system' | 'dark' | 'light';
  nutrition?: NutritionProfile;
}

export interface Character {
  name: string;
  color: string;
  createdAt: ISODate;
}

export interface Meta {
  /** sugestii ascunse de utilizator */
  dismissed: string[];
}

/** măsurătoare definită de utilizator (ex. „Pași”, „Apă”) */
export interface CustomMetric {
  key: string;
  label: string;
  unit: string;
  attribute: AttributeKey;
  step: number;
}

export interface AppState {
  version: 1;
  character: Character | null;
  tasks: Task[];
  completions: Completion[];
  ledger: LedgerEntry[];
  goals: Goal[];
  xpGrants: XpGrant[];
  meals: MealLog[];
  foods: CustomFood[];
  metrics: import('./metrics').MetricEntry[];
  /** măsurători active (chei); lipsă = cele implicite */
  metricsOn?: string[];
  customMetrics: CustomMetric[];
  areas: AreasConfig;
  shopping: import('./shopping').ShoppingItem[];
  transactions: import('./money').Transaction[];
  recurring: import('./money').Recurring[];
  days: Record<DateKey, DayResult>;
  settings: Settings;
  meta: Meta;
}
