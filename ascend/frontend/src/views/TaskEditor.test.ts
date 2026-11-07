import { describe, expect, it } from 'vitest';
import { suggestAttributes } from './TaskEditor';

describe('sugestii de atribute', () => {
  it('recunoaște cuvinte uzuale, cu sau fără diacritice', () => {
    expect(suggestAttributes('Alergare 5 km')).toEqual(['health']);
    expect(suggestAttributes('Citit 30 de minute')).toEqual(['intellect']);
    expect(suggestAttributes('Curatenie in casa')).toEqual(['order']);
    expect(suggestAttributes('Lucru la proiectul de la birou')).toEqual(['career']);
    expect(suggestAttributes('xyz')).toEqual([]);
  });
});
