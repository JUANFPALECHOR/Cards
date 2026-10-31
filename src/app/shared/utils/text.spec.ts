import { matchesSearch, pluralize, stripAccents, toOptionalText, toSearchKey } from './text';
import { seededRandom, shuffle } from './random';

describe('stripAccents', () => {
  it('quita tildes y diéresis', () => {
    expect(stripAccents('canción pingüino ÁRBOL')).toBe('cancion pinguino ARBOL');
  });

  it('puede conservar la ñ', () => {
    expect(stripAccents('niño Ñandú', { keepEnye: true })).toBe('niño Ñandu');
    expect(stripAccents('niño')).toBe('nino');
  });
});

describe('búsqueda', () => {
  it('ignora mayúsculas, tildes y espacios extra', () => {
    expect(toSearchKey('  Canción   Rápida ')).toBe('cancion rapida');
    expect(matchesSearch('cancion', 'Mi canción favorita')).toBe(true);
  });

  it('busca en cualquiera de los campos y acepta campos vacíos', () => {
    expect(matchesSearch('firewall', 'Redes', null, 'Configurar el firewall')).toBe(true);
    expect(matchesSearch('router', 'Redes', undefined)).toBe(false);
    expect(matchesSearch('   ', 'lo que sea')).toBe(true);
  });
});

describe('utilidades', () => {
  it('convierte texto vacío en null', () => {
    expect(toOptionalText('  ')).toBeNull();
    expect(toOptionalText(' hola ')).toBe('hola');
  });

  it('pluraliza', () => {
    expect(pluralize(1, 'palabra', 'palabras')).toBe('1 palabra');
    expect(pluralize(0, 'palabra', 'palabras')).toBe('0 palabras');
  });

  it('baraja sin perder ni duplicar elementos y sin modificar el original', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffle(original, seededRandom(42));
    expect([...shuffled].sort()).toEqual(original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
  });
});
