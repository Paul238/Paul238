import type { CategoryKey } from './money';
import type { AppState, AttributeKey } from './types';

/*
 * Propuneri: lucrurile pe care oamenii aleg cel mai des să le urmărească
 * (aplicații de obiceiuri, buget și sănătate; studii despre bugetul gospodăriilor din România).
 * Fiecare propunere se adaugă cu „+” sau se ascunde cu „×” (rămâne ascunsă: meta.dismissed).
 */

export interface ActivitySuggestion {
  id: string;
  /** rândul pentru adăugarea rapidă (titlu + programare + puncte) */
  text: string;
}

const act = (attr: string, list: string[]): ActivitySuggestion[] => list.map((text, i) => ({ id: `act:${attr}:${i}`, text }));

export const ACTIVITY_SUGGESTIONS: Partial<Record<AttributeKey, ActivitySuggestion[]>> = {
  health: act('health', [
    'Sală luni miercuri vineri 25p',
    'Plimbare 30 de minute zilnic 10p',
    '8 pahare de apă zilnic 5p',
    'Culcat până la 23:00 zilnic 10p',
    'Stretching 10 minute zilnic 5p',
    'Alergare de 2 ori pe săptămână 25p',
    'Fără dulciuri de 3 ori pe săptămână 10p',
    'Analize anuale lunar pe 15 30p',
  ]),
  intellect: act('intellect', [
    'Citit 20 de minute zilnic 15p',
    'O lecție de limbă străină zilnic 10p',
    'Un curs online de 3 ori pe săptămână 25p',
    'Podcast educativ de 2 ori pe săptămână 10p',
    'Notițe din ce am învățat weekend 10p',
  ]),
  creativity: act('creativity', [
    'Proiect personal 1h de 2 ori pe săptămână 30p',
    'Desen sau schițe de 2 ori pe săptămână 15p',
    'Instrument muzical 30 de minute de 3 ori pe săptămână 20p',
    'Jurnal de idei zilnic 5p',
    'Fotografie weekend 15p',
  ]),
  discipline: act('discipline', [
    'Trezire L-V 7:00 15p',
    'Planificat ziua următoare zilnic 10p',
    'Fără telefon prima oră zilnic 10p',
    'Meditație 10 minute zilnic 10p',
    'Lucru concentrat 2h fără notificări L-V 20p',
    'Bilanțul săptămânii duminică 15p',
  ]),
  finance: act('finance', [
    'Verificat contul și cheltuielile zilnic 5p',
    'Bugetul lunii lunar pe 1 30p',
    'Pus deoparte din salariu lunar pe 10 40p',
    'Zi fără cheltuieli inutile de 2 ori pe săptămână 15p',
    'Plătit facturile la timp lunar pe 20 20p',
    'Comparat prețuri înainte de o achiziție mare de 1 ori pe săptămână 10p',
  ]),
  social: act('social', [
    'Sunat părinții de 2 ori pe săptămână 10p',
    'Ieșire cu prietenii weekend 15p',
    'Timp de calitate cu familia zilnic 10p',
    'Mesaj unui prieten de care nu am mai auzit de 1 ori pe săptămână 10p',
  ]),
  order: act('order', [
    'Curățenie weekend 20p',
    'Spălat vasele zilnic 5p',
    'Rufe de 2 ori pe săptămână 10p',
    'Lista de cumpărături pentru săptămână sâmbătă 10p',
    'Ordine pe birou zilnic 5p',
    'Acte și facturi la zi lunar pe 25 15p',
  ]),
  career: act('career', [
    'Cele 3 priorități ale zilei L-V 10p',
    'Învățat un skill profesional de 3 ori pe săptămână 25p',
    'Actualizat CV-ul și LinkedIn lunar pe 1 20p',
    'Networking profesional de 1 ori pe săptămână 15p',
  ]),
};

export interface RecurringSuggestion {
  id: string;
  title: string;
  type: 'income' | 'expense';
  category: CategoryKey;
  day: number;
}

const rec = (title: string, category: CategoryKey, day: number, type: 'income' | 'expense' = 'expense'): RecurringSuggestion => ({
  id: `rec:${title.toLowerCase()}`,
  title,
  type,
  category,
  day,
});

/** cele mai frecvente plăți lunare ale unei gospodării din România */
export const RECURRING_SUGGESTIONS: RecurringSuggestion[] = [
  rec('Salariu', 'salary', 10, 'income'),
  rec('Chirie', 'rent', 1),
  rec('Întreținere bloc', 'home', 20),
  rec('Curent', 'home', 15),
  rec('Gaz', 'home', 15),
  rec('Internet și TV', 'home', 10),
  rec('Abonament telefon', 'home', 10),
  rec('Rată bancă', 'loans', 5),
  rec('Asigurare locuință', 'home', 1),
  rec('RCA', 'transport', 1),
  rec('Abonament transport', 'transport', 1),
  rec('Netflix', 'subscriptions', 12),
  rec('Spotify', 'subscriptions', 12),
  rec('Abonament sală', 'subscriptions', 1),
  rec('Cloud (iCloud / Google One)', 'subscriptions', 1),
];

/** produse puse des pe lista de cumpărături, pe categorii */
export const SHOPPING_SUGGESTIONS: { category: CategoryKey; items: string[] }[] = [
  { category: 'food', items: ['Pâine', 'Lapte', 'Ouă', 'Cașcaval', 'Iaurt', 'Fructe', 'Legume', 'Carne de pui', 'Orez', 'Paste', 'Ulei', 'Cafea', 'Apă plată'] },
  { category: 'cleaning', items: ['Detergent de vase', 'Detergent de rufe', 'Balsam de rufe', 'Saci de gunoi', 'Hârtie igienică', 'Prosoape de hârtie', 'Soluție de geamuri', 'Bureți'] },
  { category: 'hygiene', items: ['Pastă de dinți', 'Gel de duș', 'Șampon', 'Deodorant', 'Săpun', 'Periuță de dinți', 'Spumă de ras', 'Dischete demachiante'] },
  { category: 'health', items: ['Vitamine', 'Paracetamol', 'Plasturi', 'Ser fiziologic'] },
  { category: 'home', items: ['Becuri', 'Baterii', 'Folie alimentară'] },
];

const SHOP_ID = (title: string) => `shop:${title.toLowerCase()}`;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/** propunerile de activități pe care nu le ai deja și nu le-ai ascuns */
export function activitySuggestions(state: AppState, attr: AttributeKey, titleOf: (text: string) => string): ActivitySuggestion[] {
  const dismissed = new Set(state.meta.dismissed);
  const have = new Set(state.tasks.filter((t) => !t.archived).map((t) => norm(t.title)));
  return (ACTIVITY_SUGGESTIONS[attr] ?? []).filter((s) => !dismissed.has(s.id) && !have.has(norm(titleOf(s.text))));
}

export function recurringSuggestions(state: AppState): RecurringSuggestion[] {
  const dismissed = new Set(state.meta.dismissed);
  const have = new Set(state.recurring.filter((r) => !r.archived).map((r) => norm(r.title)));
  return RECURRING_SUGGESTIONS.filter((s) => !dismissed.has(s.id) && !have.has(norm(s.title)));
}

export function shoppingSuggestions(state: AppState, category: CategoryKey): { id: string; title: string }[] {
  const dismissed = new Set(state.meta.dismissed);
  const onList = new Set(state.shopping.filter((i) => !i.boughtAt).map((i) => norm(i.title)));
  const group = SHOPPING_SUGGESTIONS.find((g) => g.category === category);
  return (group?.items ?? []).map((title) => ({ id: SHOP_ID(title), title })).filter((s) => !dismissed.has(s.id) && !onList.has(norm(s.title)));
}
