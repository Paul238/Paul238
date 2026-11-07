import type { AttributeKey } from './types';

export interface AttributeDef {
  key: AttributeKey;
  label: string;
  description: string;
  color: string;
}

export const ATTRIBUTES: AttributeDef[] = [
  { key: 'health', label: 'Sănătate', description: 'Sport, somn, alimentație, energie fizică', color: '#f0706a' },
  { key: 'intellect', label: 'Intelect', description: 'Citit, învățat, cursuri, gândire', color: '#5b9dff' },
  { key: 'creativity', label: 'Creativitate', description: 'Artă, muzică, scris, proiecte proprii', color: '#b583f5' },
  { key: 'discipline', label: 'Disciplină', description: 'Rutine, voință, concentrare, autocontrol', color: '#eaa13a' },
  { key: 'finance', label: 'Finanțe', description: 'Buget, economii, investiții, educație financiară', color: '#3cc48d' },
  { key: 'social', label: 'Relații', description: 'Familie, prieteni, comunicare, networking', color: '#ec6fa9' },
  { key: 'order', label: 'Ordine', description: 'Casă, organizare, administrativ', color: '#35bfb2' },
  { key: 'career', label: 'Carieră', description: 'Skill-uri profesionale, proiecte, certificări', color: '#8f98ff' },
];

export const ATTRIBUTE_MAP: Record<AttributeKey, AttributeDef> = Object.fromEntries(
  ATTRIBUTES.map((a) => [a.key, a]),
) as Record<AttributeKey, AttributeDef>;

export const ATTRIBUTE_KEYS = ATTRIBUTES.map((a) => a.key);

export function emptyAttributeRecord(): Record<AttributeKey, number> {
  return Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 0])) as Record<AttributeKey, number>;
}
