import { seededRandom } from '../../../shared/utils/random';
import {
  BOARD_SIZE,
  MatchPair,
  PairDeck,
  checkpointFor,
  playablePairs,
  pointsFor,
} from './match-game';

const pairs = (count: number): MatchPair[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${i}`,
    term: `term ${i}`,
    translation: `tr ${i}`,
  }));

describe('match-game', () => {
  it('los checkpoints piden 10, 20, 30 parejas con menos tiempo por pareja', () => {
    const [one, two, three] = [1, 2, 3].map(checkpointFor);
    expect([one.target, two.target, three.target]).toEqual([10, 20, 30]);
    expect(one.seconds / one.target).toBeGreaterThan(two.seconds / two.target);
    expect(two.seconds / two.target).toBeGreaterThan(three.seconds / three.target);
    expect(checkpointFor(20).seconds / checkpointFor(20).target).toBe(3);
  });

  it('los aciertos seguidos suman más, con un tope', () => {
    expect([1, 2, 6, 20].map(pointsFor)).toEqual([10, 12, 20, 20]);
  });

  it('descarta términos o traducciones repetidos (sin importar tildes ni mayúsculas)', () => {
    const result = playablePairs([
      { id: 'a', term: 'big', translation: 'grande' },
      { id: 'b', term: 'large', translation: 'Grande' },
      { id: 'c', term: 'Big', translation: 'enorme' },
      { id: 'd', term: 'run', translation: 'correr' },
    ]);
    expect(result.map((pair) => pair.id)).toEqual(['a', 'd']);
  });

  it('reparte cuatro parejas distintas sin dejar ninguna en su misma fila', () => {
    const deck = new PairDeck(pairs(10), seededRandom(3));
    const board = deck.deal();
    expect(new Set(board.terms.map((tile) => tile.pair.id)).size).toBe(BOARD_SIZE);
    board.terms.forEach((tile, i) => expect(board.translations[i].pair.id).not.toBe(tile.pair.id));
  });

  it('reemplaza la pareja acertada por otra que no está en el tablero', () => {
    const deck = new PairDeck(pairs(10), seededRandom(7));
    let board = deck.deal();
    for (let round = 0; round < 30; round++) {
      const termIndex = round % BOARD_SIZE;
      const id = board.terms[termIndex].pair.id;
      const translationIndex = board.translations.findIndex((tile) => tile.pair.id === id);
      board = deck.replace(board, termIndex, translationIndex);
      const ids = board.terms.map((tile) => tile.pair.id);
      expect(new Set(ids).size).toBe(BOARD_SIZE);
      expect([...board.translations.map((tile) => tile.pair.id)].sort()).toEqual([...ids].sort());
      expect(ids).not.toContain(id);
    }
  });

  it('funciona con solo cuatro palabras', () => {
    const deck = new PairDeck(pairs(4), seededRandom(1));
    let board = deck.deal();
    const translationIndex = board.translations.findIndex(
      (tile) => tile.pair.id === board.terms[0].pair.id,
    );
    board = deck.replace(board, 0, translationIndex);
    expect(new Set(board.terms.map((tile) => tile.pair.id)).size).toBe(4);
  });
});
