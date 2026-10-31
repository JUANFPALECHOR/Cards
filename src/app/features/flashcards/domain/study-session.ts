import { toPercent } from '../../../shared/utils/numbers';
import { AttemptGrade } from '../../spaced-repetition/domain/learning-state';

/**
 * Cola de una sesión de flashcards (práctica o Repasar).
 *
 *   · Cada tarjeta se muestra una vez en el orden recibido.
 *   · Una tarjeta marcada «No la sabía» se repite UNA vez al final de la sesión.
 *   · Solo cuenta (y se registra) el primer intento de cada tarjeta: la repetición es un refuerzo
 *     inmediato, no una prueba de dominio.
 */
export interface SessionEntry<T> {
  readonly card: T;
  readonly retry: boolean;
}

export interface SessionResult<T> {
  readonly card: T;
  readonly grade: AttemptGrade;
}

export interface StudySession<T> {
  readonly entries: readonly SessionEntry<T>[];
  readonly position: number;
  readonly results: readonly SessionResult<T>[];
}

export interface SessionSummary {
  readonly total: number;
  /** «La sabía». */
  readonly good: number;
  /** «Me costó» (acierto con dificultad). */
  readonly hard: number;
  /** «No la sabía». */
  readonly again: number;
  /** Aciertos (incluidos los «Me costó») sobre el total. */
  readonly percent: number;
}

export function startSession<T>(cards: readonly T[]): StudySession<T> {
  return { entries: cards.map((card) => ({ card, retry: false })), position: 0, results: [] };
}

export function currentEntry<T>(session: StudySession<T>): SessionEntry<T> | null {
  return session.entries[session.position] ?? null;
}

export function isFinished<T>(session: StudySession<T>): boolean {
  return session.position >= session.entries.length;
}

export function answerCurrent<T>(session: StudySession<T>, grade: AttemptGrade): StudySession<T> {
  const entry = currentEntry(session);
  if (!entry) return session;

  const entries =
    grade === 'again' && !entry.retry
      ? [...session.entries, { card: entry.card, retry: true }]
      : session.entries;
  const results = entry.retry ? session.results : [...session.results, { card: entry.card, grade }];

  return { entries, position: session.position + 1, results };
}

export function summarize<T>(results: readonly SessionResult<T>[]): SessionSummary {
  const count = (grade: AttemptGrade) => results.filter((result) => result.grade === grade).length;
  const good = count('good');
  const hard = count('hard');
  return {
    total: results.length,
    good,
    hard,
    again: results.length - good - hard,
    percent: toPercent(good + hard, results.length),
  };
}
