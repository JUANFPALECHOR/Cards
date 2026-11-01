import { RandomSource, shuffle } from '../../../shared/utils/random';
import { toSearchKey } from '../../../shared/utils/text';

/**
 * Emparejar: cuatro parejas a la vez; cada acierto se reemplaza por otra pareja del vocabulario.
 * La partida avanza por checkpoints (10, 20, 30… parejas) con un tiempo límite cada uno. La
 * dificultad depende solo de la cantidad de parejas y del tiempo por pareja, no de las palabras.
 */
export interface MatchPair {
  readonly id: string;
  readonly term: string;
  readonly translation: string;
}

export interface Checkpoint {
  readonly level: number;
  /** Parejas que hay que completar. */
  readonly target: number;
  readonly seconds: number;
}

export interface Tile {
  /** Único por aparición: permite animar la entrada de cada pareja nueva. */
  readonly key: number;
  readonly pair: MatchPair;
}

export interface Board {
  readonly terms: readonly Tile[];
  readonly translations: readonly Tile[];
}

export const BOARD_SIZE = 4;
export const PAIRS_PER_CHECKPOINT = 10;
/** Penalización moderada por error. */
export const ERROR_PENALTY_SECONDS = 2;
export const ERROR_PENALTY_POINTS = 5;
export const POINTS_PER_PAIR = 10;
/** Puntos extra por cada segundo que sobra al superar un checkpoint. */
export const POINTS_PER_SECOND_LEFT = 2;

/** 10 parejas en 55 s, 20 en 100 s, 30 en 135 s… (cada checkpoint deja menos tiempo por pareja). */
export function checkpointFor(level: number): Checkpoint {
  const target = level * PAIRS_PER_CHECKPOINT;
  const secondsPerPair = Math.max(3, 5.5 - 0.5 * (level - 1));
  return { level, target, seconds: Math.round((target * secondsPerPair) / 5) * 5 };
}

/** Puntos de un acierto: 10, más 2 por cada acierto seguido (hasta +10). */
export function pointsFor(combo: number): number {
  return POINTS_PER_PAIR + Math.min(Math.max(combo - 1, 0), 5) * 2;
}

/** Quita términos o traducciones repetidos, que harían ambiguo el emparejamiento. */
export function playablePairs(pairs: readonly MatchPair[]): MatchPair[] {
  const terms = new Set<string>();
  const translations = new Set<string>();
  return pairs.filter((pair) => {
    const term = toSearchKey(pair.term);
    const translation = toSearchKey(pair.translation);
    if (!term || !translation || terms.has(term) || translations.has(translation)) return false;
    terms.add(term);
    translations.add(translation);
    return true;
  });
}

/** Saca parejas en orden aleatorio, sin repetir hasta agotar el vocabulario. */
export class PairDeck {
  private pending: MatchPair[] = [];
  private nextKey = 0;

  constructor(
    private readonly pairs: readonly MatchPair[],
    private readonly random: RandomSource = Math.random,
  ) {}

  /** Tablero nuevo; las traducciones nunca quedan en la misma fila que su término. */
  deal(): Board {
    const pairs: MatchPair[] = [];
    while (pairs.length < BOARD_SIZE) pairs.push(this.draw(new Set(pairs.map((pair) => pair.id))));
    let order = shuffle(pairs, this.random);
    for (let tries = 0; tries < 10 && order.some((pair, index) => pair === pairs[index]); tries++) {
      order = shuffle(pairs, this.random);
    }
    return {
      terms: pairs.map((pair) => this.tile(pair)),
      translations: order.map((pair) => this.tile(pair)),
    };
  }

  /** Reemplaza la pareja acertada (término en `termIndex`, traducción en `translationIndex`). */
  replace(board: Board, termIndex: number, translationIndex: number): Board {
    const matched = board.terms[termIndex].pair.id;
    const others = board.terms.map((tile) => tile.pair.id).filter((id) => id !== matched);
    const exclude = new Set(this.pairs.length > BOARD_SIZE ? [...others, matched] : others);
    const pair = this.draw(exclude);
    const terms = [...board.terms];
    const translations = [...board.translations];
    terms[termIndex] = this.tile(pair);
    translations[translationIndex] = this.tile(pair);
    // En la misma fila se emparejaría a simple vista: se intercambia con otra posición.
    if (translationIndex === termIndex) {
      const other = (termIndex + 1 + Math.floor(this.random() * (BOARD_SIZE - 1))) % BOARD_SIZE;
      [translations[termIndex], translations[other]] = [
        translations[other],
        translations[termIndex],
      ];
    }
    return { terms, translations };
  }

  private draw(exclude: ReadonlySet<string>): MatchPair {
    for (let round = 0; round < 2; round++) {
      const index = this.pending.findIndex((pair) => !exclude.has(pair.id));
      if (index >= 0) return this.pending.splice(index, 1)[0];
      this.pending.push(...shuffle(this.pairs, this.random));
    }
    throw new Error('No hay parejas suficientes para el tablero.');
  }

  private tile(pair: MatchPair): Tile {
    return { key: this.nextKey++, pair };
  }
}
