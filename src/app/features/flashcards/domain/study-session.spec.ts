import { answerCurrent, currentEntry, isFinished, startSession, summarize } from './study-session';

describe('sesión de estudio', () => {
  it('recorre las tarjetas en orden y termina', () => {
    let session = startSession(['a', 'b']);
    expect(currentEntry(session)?.card).toBe('a');

    session = answerCurrent(session, 'good');
    expect(currentEntry(session)?.card).toBe('b');

    session = answerCurrent(session, 'hard');
    expect(isFinished(session)).toBe(true);
    expect(currentEntry(session)).toBeNull();
  });

  it('repite una vez al final solo las tarjetas que no sabía', () => {
    let session = startSession(['a', 'b', 'c']);
    session = answerCurrent(session, 'again'); // a falla
    session = answerCurrent(session, 'hard'); // b le costó: no se repite
    session = answerCurrent(session, 'good'); // c

    expect(currentEntry(session)).toEqual({ card: 'a', retry: true });

    session = answerCurrent(session, 'again'); // a vuelve a fallar: no se repite otra vez
    expect(isFinished(session)).toBe(true);
    expect(session.entries).toHaveLength(4);
  });

  it('8 · solo registra el primer intento de cada tarjeta (la repetición no duplica resultados)', () => {
    let session = startSession(['a']);
    session = answerCurrent(session, 'again');
    session = answerCurrent(session, 'good'); // repetición acertada

    expect(session.results).toEqual([{ card: 'a', grade: 'again' }]);
  });

  it('no cambia una sesión terminada', () => {
    const finished = answerCurrent(startSession(['a']), 'good');
    expect(answerCurrent(finished, 'again')).toBe(finished);
  });

  it('resume las tres evaluaciones; «Me costó» cuenta como acierto', () => {
    expect(
      summarize([
        { card: 'a', grade: 'good' },
        { card: 'b', grade: 'again' },
        { card: 'c', grade: 'hard' },
      ]),
    ).toEqual({ total: 3, good: 1, hard: 1, again: 1, percent: 67 });
    expect(summarize([])).toEqual({ total: 0, good: 0, hard: 0, again: 0, percent: 0 });
  });
});
