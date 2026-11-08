import type { DateKey, ISODate } from './types';

/** un articol din lista de cumpărături (bani reali, nu credite) */
export interface ShoppingItem {
  id: string;
  title: string;
  /** cantitate liberă: „2 kg”, „1 bax” */
  qty?: string;
  createdAt: ISODate;
  /** când l-ai bifat ca fiind cumpărat */
  boughtAt?: ISODate;
  boughtDate?: DateKey;
  /** cât a costat, în lei */
  cost?: number;
}

export function shoppingSpent(items: ShoppingItem[], from: DateKey, to: DateKey) {
  return items.filter((i) => i.boughtDate && i.boughtDate >= from && i.boughtDate <= to).reduce((s, i) => s + (i.cost ?? 0), 0);
}
