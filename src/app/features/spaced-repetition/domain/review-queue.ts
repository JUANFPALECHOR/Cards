import { LearningState, TrackedStatus, isDue } from './learning-state';

/**
 * Modos de Repasar:
 *   smart      Repaso inteligente: lo pendiente por prioridad (difíciles primero) más palabras nuevas.
 *   difficult  Practicar mis dificultades: solo las palabras que más cuestan, aunque no estén pendientes.
 *   learned    Repasar vocabulario aprendido: palabras con retención comprobada, las más próximas primero.
 */
export type ReviewMode = 'smart' | 'difficult' | 'learned';

export interface QueueCandidate {
  /** null = palabra nueva. */
  readonly state: LearningState | null;
}

export interface SmartQueueLimits {
  readonly maxCards: number;
  readonly newLimit: number;
}

const STATUS_PRIORITY: Record<TrackedStatus, number> = {
  difficult: 0,
  learning: 1,
  provisional: 2,
  learned: 3,
};

/** Cada cuántas pendientes se intercala una palabra nueva. */
const NEW_EVERY = 3;

/** Prioridad entre pendientes: difíciles, en aprendizaje, por verificar y aprendidas; luego más difícil y más atrasada. */
export function comparePriority(a: LearningState, b: LearningState): number {
  return (
    STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
    b.difficulty - a.difficulty ||
    a.dueAt.getTime() - b.dueAt.getTime()
  );
}

/**
 * Pendientes por prioridad e intercaladas con palabras nuevas. Si hay muchas pendientes, se reserva
 * hasta una cuarta parte de la sesión para palabras nuevas: las dificultades no frenan el avance.
 */
export function buildSmartQueue<T extends QueueCandidate>(
  candidates: readonly T[],
  now: Date,
  limits: SmartQueueLimits,
): T[] {
  const due = candidates
    .filter((item) => item.state !== null && isDue(item.state, now))
    .sort((a, b) => comparePriority(a.state!, b.state!));
  const fresh = candidates.filter((item) => item.state === null);

  const reserved = Math.min(fresh.length, limits.newLimit, Math.ceil(limits.maxCards / 4));
  const dueTaken = due.slice(0, Math.max(limits.maxCards - reserved, 0));
  const newTaken = fresh.slice(
    0,
    Math.max(Math.min(fresh.length, limits.newLimit, limits.maxCards - dueTaken.length), 0),
  );
  return interleave(dueTaken, newTaken, NEW_EVERY);
}

/** ¿Es una palabra con la que el usuario tiene problemas? */
export function isStruggling(state: LearningState | null): boolean {
  if (!state) return false;
  return state.status === 'difficult' || (state.status === 'learning' && state.failures > 0);
}

/** Difíciles primero y, después, las que más fallos acumulan recientemente. */
export function buildDifficultQueue<T extends QueueCandidate>(
  candidates: readonly T[],
  maxCards: number,
): T[] {
  return candidates
    .filter((item) => isStruggling(item.state))
    .sort(
      (a, b) =>
        Number(b.state!.status === 'difficult') - Number(a.state!.status === 'difficult') ||
        b.state!.difficulty - a.state!.difficulty,
    )
    .slice(0, maxCards);
}

/** Aprendidas, empezando por las que antes tocaba repasar. */
export function buildLearnedQueue<T extends QueueCandidate>(
  candidates: readonly T[],
  maxCards: number,
): T[] {
  return candidates
    .filter((item) => item.state?.status === 'learned')
    .sort((a, b) => a.state!.dueAt.getTime() - b.state!.dueAt.getTime())
    .slice(0, maxCards);
}

function interleave<T>(primary: readonly T[], secondary: readonly T[], every: number): T[] {
  const result: T[] = [];
  let p = 0;
  let s = 0;
  while (p < primary.length || s < secondary.length) {
    for (let i = 0; i < every && p < primary.length; i++) result.push(primary[p++]);
    if (s < secondary.length) result.push(secondary[s++]);
  }
  return result;
}
