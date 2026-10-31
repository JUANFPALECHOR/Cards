import { checkWrittenAnswer, normalizeAnswer, splitAlternatives } from './answer-checker';

describe('normalizeAnswer', () => {
  it('ignora mayúsculas, espacios repetidos y puntuación en los extremos', () => {
    expect(normalizeAnswer('  ¡Hola   Mundo!  ')).toBe('hola mundo');
    expect(normalizeAnswer('«Correr».')).toBe('correr');
  });

  it('conserva la puntuación interna', () => {
    expect(normalizeAnswer("don't")).toBe("don't");
  });
});

describe('splitAlternatives', () => {
  it('separa por «/» y «;» y descarta vacíos', () => {
    expect(splitAlternatives('banco / orilla; ribera;')).toEqual(['banco', 'orilla', 'ribera']);
  });
});

describe('checkWrittenAnswer', () => {
  it('acepta la respuesta exacta sin distinguir mayúsculas ni espacios', () => {
    expect(checkWrittenAnswer('  CORRER ', ['correr'])).toEqual({
      outcome: 'correct',
      matched: 'correr',
    });
  });

  it('acepta cualquiera de las alternativas', () => {
    expect(checkWrittenAnswer('orilla', ['banco / orilla']).outcome).toBe('correct');
    expect(checkWrittenAnswer('banco', ['banco; orilla']).outcome).toBe('correct');
  });

  it('acepta respuestas sin tildes, con aviso y la forma correcta', () => {
    expect(checkWrittenAnswer('cancion', ['canción'])).toEqual({
      outcome: 'correct-with-warning',
      matched: 'canción',
    });
    expect(checkWrittenAnswer('pinguino', ['pingüino']).outcome).toBe('correct-with-warning');
  });

  it('una tilde de más también se acepta con aviso', () => {
    expect(checkWrittenAnswer('cómer', ['comer']).outcome).toBe('correct-with-warning');
  });

  it('distingue la ñ de la n', () => {
    expect(checkWrittenAnswer('nino', ['niño']).outcome).toBe('incorrect');
    expect(checkWrittenAnswer('ano', ['año']).outcome).toBe('incorrect');
    expect(checkWrittenAnswer('NIÑO', ['niño']).outcome).toBe('correct');
  });

  it('rechaza respuestas vacías o distintas', () => {
    expect(checkWrittenAnswer('   ', ['correr']).outcome).toBe('incorrect');
    expect(checkWrittenAnswer('caminar', ['correr']).outcome).toBe('incorrect');
  });

  it('acepta respuestas de otras palabras con la misma pregunta', () => {
    expect(checkWrittenAnswer('orilla', ['banco', 'orilla']).outcome).toBe('correct');
  });
});
