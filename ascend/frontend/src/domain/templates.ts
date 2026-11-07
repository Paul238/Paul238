import type { AttributeKey, Schedule } from './types';

export interface TaskTemplate {
  title: string;
  points: number;
  attributes: AttributeKey[];
  schedule: Schedule;
  special?: boolean;
}

const daily: Schedule = { kind: 'daily', days: [] };
const weekly = (times: number): Schedule => ({ kind: 'weekly', times });

export const TASK_TEMPLATES: TaskTemplate[] = [
  { title: 'Antrenament la sală', points: 30, attributes: ['health', 'discipline'], schedule: weekly(3) },
  { title: 'Alergare 5 km', points: 25, attributes: ['health'], schedule: weekly(2), special: true },
  { title: '7–8 ore de somn', points: 10, attributes: ['health', 'discipline'], schedule: daily },
  { title: '2 litri de apă', points: 5, attributes: ['health'], schedule: daily },
  { title: 'Citit 30 de minute', points: 20, attributes: ['intellect'], schedule: daily, special: true },
  { title: 'O lecție dintr-un curs online', points: 25, attributes: ['intellect', 'career'], schedule: weekly(3), special: true },
  { title: 'Exersat o limbă străină (20 min)', points: 15, attributes: ['intellect'], schedule: daily },
  { title: 'Lucru la un proiect personal (1h)', points: 30, attributes: ['creativity', 'career'], schedule: weekly(2), special: true },
  { title: 'Scris / jurnal', points: 10, attributes: ['creativity', 'discipline'], schedule: daily },
  { title: 'Plimbare 30 de minute', points: 10, attributes: ['health', 'discipline'], schedule: daily },
  { title: 'Meditație 10 minute', points: 10, attributes: ['discipline', 'health'], schedule: daily, special: true },
  { title: 'Fără social media până la prânz', points: 15, attributes: ['discipline'], schedule: daily },
  { title: 'Notat cheltuielile zilei', points: 5, attributes: ['finance'], schedule: daily },
  { title: 'Zi fără cheltuieli inutile', points: 15, attributes: ['finance', 'discipline'], schedule: weekly(2), special: true },
  { title: 'Sunat un prieten / familia', points: 10, attributes: ['social'], schedule: weekly(3), special: true },
  { title: 'Curățenie 20 de minute', points: 10, attributes: ['order'], schedule: daily },
  { title: 'Gătit acasă', points: 15, attributes: ['order', 'health'], schedule: weekly(4) },
  { title: 'Bloc de lucru concentrat (2h)', points: 30, attributes: ['career', 'discipline'], schedule: { kind: 'daily', days: [1, 2, 3, 4, 5] } },
];

export const AVATAR_COLORS = ['#5b6cff', '#3cc48d', '#eaa13a', '#f0706a', '#b583f5', '#35bfb2', '#ec6fa9', '#8a94a6'];
