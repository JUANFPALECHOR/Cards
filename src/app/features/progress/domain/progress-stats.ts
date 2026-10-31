import { addDays, startOfLocalDay, toLocalDateKey } from '../../../shared/utils/dates';
import { toPercent } from '../../../shared/utils/numbers';
import { LearningOverview } from '../../spaced-repetition/data/learning.repository';
import { StatusCounts, totalOf } from './status-segments';

/**
 * Indicadores de Progreso. Todo sale de datos reales (estado de cada palabra e historial de
 * respuestas); nada se simula ni se guarda como estadística derivada.
 *
 *   · Cada palabra está en un único estado: nueva, en aprendizaje, difícil, dominada
 *     provisionalmente o aprendida. El total es la suma de los cinco.
 *   · % aprendido          = aprendidas / total × 100 (retención comprobada).
 *   · % dominio provisional = dominadas provisionalmente / total × 100 (falta comprobar retención).
 *   · Precisión            = aciertos (incluidos «Me costó») / respuestas. Mide respuestas, no palabras.
 *   · Racha                = días seguidos (hora local) con al menos una respuesta. Si hoy aún no
 *                            estudiaste, la racha de ayer sigue viva hasta medianoche.
 */
export interface ProgressSnapshot {
  readonly overview: LearningOverview;
  /** Días con actividad en formato AAAA-MM-DD (zona horaria local). */
  readonly studyDays: readonly string[];
}

export interface ProgressSummary {
  readonly total: number;
  readonly counts: StatusCounts;
  readonly learnedPercent: number;
  readonly provisionalPercent: number;
  readonly dueNow: number;
  readonly dueLaterToday: number;
  readonly dueTomorrow: number;
  readonly dueWeek: number;
  readonly nextDueAt: Date | null;
  readonly totalAnswers: number;
  readonly correctAnswers: number;
  readonly hardAnswers: number;
  /** null si todavía no hay respuestas. */
  readonly accuracy: number | null;
  readonly streak: number;
  readonly studiedToday: boolean;
  readonly masteredToday: number;
  readonly learnedToday: number;
}

export function computeStreak(
  studyDays: readonly string[],
  today: Date,
): { streak: number; studiedToday: boolean } {
  const days = new Set(studyDays);
  let cursor = startOfLocalDay(today);
  const studiedToday = days.has(toLocalDateKey(cursor));
  if (!studiedToday) cursor = addDays(cursor, -1);

  let streak = 0;
  while (days.has(toLocalDateKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return { streak, studiedToday };
}

export function buildProgressSummary(snapshot: ProgressSnapshot, today: Date): ProgressSummary {
  const { overview } = snapshot;
  const total = totalOf(overview.counts);
  const { streak, studiedToday } = computeStreak(snapshot.studyDays, today);
  return {
    total,
    counts: overview.counts,
    learnedPercent: toPercent(overview.counts.learned, total),
    provisionalPercent: toPercent(overview.counts.provisional, total),
    dueNow: overview.dueNow,
    dueLaterToday: Math.max(overview.dueToday - overview.dueNow, 0),
    dueTomorrow: overview.dueTomorrow,
    dueWeek: overview.dueWeek,
    nextDueAt: overview.nextDueAt,
    totalAnswers: overview.totalAnswers,
    correctAnswers: overview.correctAnswers,
    hardAnswers: overview.hardAnswers,
    accuracy:
      overview.totalAnswers > 0 ? toPercent(overview.correctAnswers, overview.totalAnswers) : null,
    streak,
    studiedToday,
    masteredToday: overview.masteredToday,
    learnedToday: overview.learnedToday,
  };
}
