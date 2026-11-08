import type { AreasConfig, AttributeKey } from './types';

export interface AttributeDef {
  key: AttributeKey;
  label: string;
  description: string;
  color: string;
  /** numele pictogramei, pentru laturile adăugate de utilizator */
  icon?: string;
}

export const BUILTIN_ATTRIBUTES: AttributeDef[] = [
  { key: 'health', label: 'Sănătate', description: 'Sport, somn, alimentație, energie fizică', color: '#f0706a' },
  { key: 'intellect', label: 'Intelect', description: 'Citit, învățat, cursuri, gândire', color: '#5b9dff' },
  { key: 'creativity', label: 'Creativitate', description: 'Artă, muzică, scris, proiecte proprii', color: '#b583f5' },
  { key: 'discipline', label: 'Disciplină', description: 'Rutine, voință, concentrare, autocontrol', color: '#eaa13a' },
  { key: 'finance', label: 'Finanțe', description: 'Buget, economii, investiții, educație financiară', color: '#3cc48d' },
  { key: 'social', label: 'Relații', description: 'Familie, prieteni, comunicare, networking', color: '#ec6fa9' },
  { key: 'order', label: 'Ordine', description: 'Casă, organizare, administrativ', color: '#35bfb2' },
  { key: 'career', label: 'Carieră', description: 'Skill-uri profesionale, proiecte, certificări', color: '#8f98ff' },
];

/** culori pentru laturile noi */
export const AREA_COLORS = ['#f0706a', '#eaa13a', '#3cc48d', '#35bfb2', '#5b9dff', '#8f98ff', '#b583f5', '#ec6fa9', '#9aa3ad'];

/**
 * Registrul laturilor. Se reconstruiește (pe loc) din `state.areas` cu `applyAreas`,
 * ca toate ecranele să vadă aceeași listă.
 * - ATTRIBUTES: laturile vizibile în cerc (pentru alegere și afișare)
 * - ATTRIBUTE_MAP / ATTRIBUTE_KEYS: toate laturile cunoscute, inclusiv cele ascunse (pentru istoric și XP)
 */
export const ATTRIBUTES: AttributeDef[] = [...BUILTIN_ATTRIBUTES];
export const ATTRIBUTE_MAP = Object.fromEntries(BUILTIN_ATTRIBUTES.map((a) => [a.key, a])) as Record<AttributeKey, AttributeDef>;
export const ATTRIBUTE_KEYS: AttributeKey[] = BUILTIN_ATTRIBUTES.map((a) => a.key);

let applied: AreasConfig | undefined;

export function applyAreas(cfg?: AreasConfig) {
  if (cfg === applied) return;
  applied = cfg;
  const all = [...BUILTIN_ATTRIBUTES, ...(cfg?.custom ?? [])];
  const hidden = new Set(cfg?.hidden ?? []);
  for (const k of Object.keys(ATTRIBUTE_MAP)) delete ATTRIBUTE_MAP[k as AttributeKey];
  for (const a of all) ATTRIBUTE_MAP[a.key] = a;
  ATTRIBUTE_KEYS.splice(0, ATTRIBUTE_KEYS.length, ...all.map((a) => a.key));
  ATTRIBUTES.splice(0, ATTRIBUTES.length, ...all.filter((a) => !hidden.has(a.key)));
}

/** cheile laturilor vizibile în cerc */
export const visibleAttributeKeys = () => ATTRIBUTES.map((a) => a.key);

/** definiția unei laturi; pentru chei necunoscute (ex. o latură ștearsă) întoarce una neutră */
export function attributeDef(key: AttributeKey): AttributeDef {
  return ATTRIBUTE_MAP[key] ?? { key, label: 'Altă latură', description: '', color: '#9aa3ad' };
}

export function emptyAttributeRecord(): Record<AttributeKey, number> {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 0])) as Record<AttributeKey, number>;
}
