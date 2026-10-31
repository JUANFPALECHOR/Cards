import { DIRECTION_LABELS, StudyDirection } from '../../../core/models/study-direction';
import { addDays, startOfLocalDay } from '../../../shared/utils/dates';
import { LearningConfig } from './learning-config';

/**
 * Aprendizaje adaptativo: dominio actual + retención comprobada + repetición espaciada.
 *
 * Cada respuesta (flashcards, cuestionarios y Repasar) pasa por `applyAttempt`, una función pura que
 * recibe el estado anterior de la palabra y devuelve el nuevo. El estado se guarda en review_states y
 * cada intento en review_events, así que el progreso sobrevive a recargas y es igual en cualquier
 * dispositivo. Las reglas completas están en README → «Aprendizaje adaptativo».
 */

/** Estado principal de una palabra. Cada palabra está exactamente en uno. */
export type LearningStatus = 'new' | 'learning' | 'difficult' | 'provisional' | 'learned';
/** Estados con fila en review_states (una palabra sin fila es nueva). */
export type TrackedStatus = Exclude<LearningStatus, 'new'>;

/** Orden de presentación: de menos a más avance. */
export const LEARNING_STATUSES: readonly LearningStatus[] = [
  'new',
  'learning',
  'difficult',
  'provisional',
  'learned',
];

export const LEARNING_STATUS_LABELS: Record<LearningStatus, string> = {
  new: 'Nueva',
  learning: 'En aprendizaje',
  difficult: 'Difícil',
  provisional: 'Dominada provisionalmente',
  learned: 'Aprendida',
};

/** Etiquetas cortas para insignias. */
export const LEARNING_STATUS_SHORT_LABELS: Record<LearningStatus, string> = {
  ...LEARNING_STATUS_LABELS,
  provisional: 'Dominada',
};

/** «No la sabía» · «Me costó» · «La sabía». */
export type AttemptGrade = 'again' | 'hard' | 'good';
/** Flashcard con autoevaluación · selección múltiple (reconocer) · respuesta escrita (recordar). */
export type AttemptKind = 'self_assessment' | 'multiple_choice' | 'written';
/**
 * Cómo se interpreta un intento según el tiempo desde el anterior de la misma palabra:
 *   first        primer intento.
 *   immediate    repetición inmediata (menos de `immediateWindowMinutes`): no suma dominio.
 *   independent  acierto o fallo independiente (minutos u horas después).
 *   retention    tras `retentionGapHours` o más sin verla: comprueba la retención.
 */
export type AttemptEvidence = 'first' | 'immediate' | 'independent' | 'retention';

export interface DirectionStats {
  readonly attempts: number;
  readonly failures: number;
}

export interface LearningState {
  readonly status: TrackedStatus;
  /** Dominio actual, 0–100. */
  readonly mastery: number;
  /** Puntuación de dificultad, 0–100. */
  readonly difficulty: number;
  readonly attempts: number;
  /** Aciertos, incluidos los «Me costó». */
  readonly successes: number;
  readonly failures: number;
  readonly hardCount: number;
  /** Aciertos independientes seguidos desde el último fallo. */
  readonly streak: number;
  /** Puntos de esa racha (ponderados por tipo de pregunta y grado). */
  readonly streakPoints: number;
  readonly streakStartedAt: Date | null;
  /** Puntos de retención comprobada en esa racha. */
  readonly retentionPoints: number;
  /** Últimos resultados relevantes, del más antiguo al más reciente: g = la sabía, h = me costó, a = no la sabía. */
  readonly recent: string;
  /** Fallos de una palabra que ya estaba dominada o aprendida. */
  readonly lapses: number;
  readonly directions: Readonly<Record<StudyDirection, DirectionStats>>;
  readonly intervalMinutes: number;
  readonly dueAt: Date;
  readonly lastAttemptAt: Date;
  /** Última vez que pasó a dominada (provisional o aprendida). */
  readonly provisionalAt: Date | null;
  /** Última vez que pasó a aprendida. */
  readonly learnedAt: Date | null;
  /** Escrituras realizadas: control de concurrencia optimista entre pestañas o dispositivos. */
  readonly version: number;
}

export interface Attempt {
  readonly grade: AttemptGrade;
  readonly kind: AttemptKind;
  readonly direction: StudyDirection;
  readonly at: Date;
}

export interface AttemptOutcome {
  readonly state: LearningState;
  readonly previousStatus: LearningStatus;
  readonly evidence: AttemptEvidence;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MINUTES_PER_DAY = 1440;

export function learningStatusOf(state: LearningState | null): LearningStatus {
  return state?.status ?? 'new';
}

export function isMastered(status: LearningStatus): boolean {
  return status === 'provisional' || status === 'learned';
}

export function isDue(state: LearningState, now: Date): boolean {
  return state.dueAt.getTime() <= now.getTime();
}

export function classifyEvidence(
  previous: LearningState | null,
  at: Date,
  config: LearningConfig,
): AttemptEvidence {
  if (!previous) return 'first';
  const gap = at.getTime() - previous.lastAttemptAt.getTime();
  if (gap < config.immediateWindowMinutes * MINUTE) return 'immediate';
  if (gap >= config.learned.retentionGapHours * HOUR) return 'retention';
  return 'independent';
}

/** Aplica un intento al estado anterior (null = palabra nueva) y devuelve el estado siguiente. */
export function applyAttempt(
  previous: LearningState | null,
  attempt: Attempt,
  config: LearningConfig,
): AttemptOutcome {
  const now = attempt.at;
  const previousStatus = learningStatusOf(previous);
  const base = previous ?? emptyState(now);
  const evidence = classifyEvidence(previous, now, config);
  const gap = previous ? Math.max(0, now.getTime() - previous.lastAttemptAt.getTime()) : 0;
  const success = attempt.grade !== 'again';

  // Toda respuesta cuenta en el historial y en la precisión, aunque no sume evidencia de dominio.
  const direction = base.directions[attempt.direction];
  const counted: LearningState = {
    ...base,
    attempts: base.attempts + 1,
    successes: base.successes + (success ? 1 : 0),
    failures: base.failures + (success ? 0 : 1),
    hardCount: base.hardCount + (attempt.grade === 'hard' ? 1 : 0),
    directions: {
      ...base.directions,
      [attempt.direction]: {
        attempts: direction.attempts + 1,
        failures: direction.failures + (success ? 0 : 1),
      },
    },
    lastAttemptAt: now,
    version: base.version + 1,
  };

  // Repetición inmediata: un acierto justo después de ver la respuesta no demuestra dominio, y
  // fallar otra vez el mismo olvido no se castiga dos veces.
  if (evidence === 'immediate' && (success || base.recent.endsWith('a'))) {
    return {
      state: success ? counted : { ...counted, ...scheduleIn(now, config.schedule.failureMinutes) },
      previousStatus,
      evidence,
    };
  }

  const recent = (base.recent + GRADE_CODES[attempt.grade]).slice(-config.difficult.recentWindow);

  if (!success) {
    const draft: LearningState = {
      ...counted,
      recent,
      mastery: Math.round(base.mastery * config.masteryKeptOnFailure),
      streak: 0,
      streakPoints: 0,
      streakStartedAt: null,
      retentionPoints: 0,
      lapses: base.lapses + (isMastered(previousStatus) ? 1 : 0),
      ...scheduleIn(now, config.schedule.failureMinutes),
    };
    const difficulty = difficultyScore(draft, config);
    const status: TrackedStatus =
      qualifiesAsDifficult(draft, difficulty, config) ||
      (previousStatus === 'difficult' && difficulty >= config.difficult.exitScore)
        ? 'difficult'
        : 'learning';
    return { state: { ...draft, difficulty, status }, previousStatus, evidence };
  }

  // Acierto independiente: suma dominio según el tipo de pregunta y el grado.
  const weight =
    config.kindWeight[attempt.kind] * (attempt.grade === 'hard' ? config.hardWeight : 1);
  const retention =
    evidence === 'retention'
      ? weight * (gap >= config.learned.strongRetentionDays * DAY ? 2 : 1)
      : 0;
  const streakStartedAt = base.streak > 0 && base.streakStartedAt ? base.streakStartedAt : now;
  const draft: LearningState = {
    ...counted,
    recent,
    mastery: Math.min(
      100,
      Math.round(base.mastery + config.masteryGain * weight * (100 - base.mastery)),
    ),
    streak: base.streak + 1,
    streakPoints: round2(base.streakPoints + weight),
    streakStartedAt,
    retentionPoints: round2(base.retentionPoints + retention),
  };
  const difficulty = difficultyScore(draft, config);
  const span = now.getTime() - streakStartedAt.getTime();
  const provisionalReached =
    draft.mastery >= config.provisional.minMastery &&
    draft.streakPoints >= config.provisional.minStreakPoints &&
    span >= config.provisional.minSpanMinutes * MINUTE;
  const learnedReached =
    provisionalReached &&
    draft.retentionPoints >= config.learned.minRetentionPoints &&
    span >= config.learned.minSpanDays * DAY;

  let status: TrackedStatus;
  if (learnedReached || previousStatus === 'learned') {
    status = 'learned';
  } else if (provisionalReached || previousStatus === 'provisional') {
    status = 'provisional';
  } else if (previousStatus === 'difficult') {
    status = difficulty >= config.difficult.exitScore ? 'difficult' : 'learning';
  } else {
    status = qualifiesAsDifficult(draft, difficulty, config) ? 'difficult' : 'learning';
  }

  const justMastered = isMastered(status) && !isMastered(previousStatus);
  const state: LearningState = {
    ...draft,
    difficulty,
    status,
    provisionalAt: justMastered ? now : draft.provisionalAt,
    learnedAt: status === 'learned' && previousStatus !== 'learned' ? now : draft.learnedAt,
    ...scheduleSuccess(base, previousStatus, status, attempt.grade, gap, draft.streak, now, config),
  };
  return { state, previousStatus, evidence };
}

/**
 * Puntuación de dificultad (0–100). Combina rendimiento reciente, historial completo, olvidos de
 * palabras ya dominadas y la dirección que más cuesta; cada acierto seguido la reduce. No depende
 * solo del porcentaje histórico: una palabra con muchos fallos antiguos puede haber mejorado.
 */
export function difficultyScore(state: LearningState, config: LearningConfig): number {
  if (state.attempts === 0) return 0;
  const { weights, streakRelief, maxReliefStreak } = config.difficult;
  const recentRate =
    state.recent.length === 0
      ? 0
      : [...state.recent].reduce((sum, code) => sum + CODE_ERROR[code], 0) / state.recent.length;
  // Suavizado: con pocos intentos no se llega a los extremos.
  const lifetimeRate = (state.failures + 0.5 * state.hardCount + 0.5) / (state.attempts + 1);
  const lapseRate = Math.min(state.lapses, 3) / 3;
  const directionRate = Math.max(
    0,
    ...Object.values(state.directions)
      .filter((stats) => stats.attempts >= 2)
      .map((stats) => stats.failures / stats.attempts),
  );
  const raw =
    weights.recent * recentRate +
    weights.lifetime * lifetimeRate +
    weights.lapses * lapseRate +
    weights.direction * directionRate;
  const relief = 1 - streakRelief * Math.min(state.streak, maxReliefStreak);
  return Math.round(100 * raw * relief);
}

/** Razones legibles por las que una palabra cuesta (las más relevantes primero). */
export function difficultyReasons(state: LearningState): string[] {
  const reasons: string[] = [];
  const recentFailures = [...state.recent].filter((code) => code === 'a').length;
  if (recentFailures >= 2) {
    reasons.push(`Fallaste ${recentFailures} de tus últimos ${state.recent.length} intentos.`);
  }
  if (state.lapses > 0) {
    reasons.push(
      `La olvidaste ${state.lapses === 1 ? 'una vez' : `${state.lapses} veces`} después de dominarla.`,
    );
  }
  const weaker = weakerDirection(state);
  if (weaker) reasons.push(`Te cuesta más en ${DIRECTION_LABELS[weaker]}.`);
  const hardRecent = [...state.recent].filter((code) => code === 'h').length;
  if (hardRecent >= 2) reasons.push(`Marcaste «Me costó» ${hardRecent} veces hace poco.`);
  if (reasons.length === 0 && state.failures > 0) {
    reasons.push(`${countLabel(state.failures, 'error', 'errores')} en total.`);
  }
  return reasons;
}

/** Explicación breve de por qué la palabra está en su estado actual. */
export function describeStatus(state: LearningState | null, config: LearningConfig): string {
  if (!state) return 'Aún no la has practicado.';
  switch (state.status) {
    case 'difficult':
      return difficultyReasons(state)[0] ?? 'Ha tenido errores frecuentes últimamente.';
    case 'learning':
      if (state.recent.endsWith('a')) {
        return 'La fallaste en tu último intento: volverá a aparecer en unos minutos.';
      }
      return `${countLabel(state.streak, 'acierto seguido', 'aciertos seguidos')}. Para dominarla, acierta varias veces separadas por al menos ${config.immediateWindowMinutes} minutos a lo largo de ${config.provisional.minSpanMinutes / 60} horas.`;
    case 'provisional':
      return `${countLabel(state.streak, 'acierto seguido', 'aciertos seguidos')}. Falta comprobar que la recuerdas otro día.`;
    case 'learned':
      return 'La recordaste en días distintos sin fallar.';
  }
}

function qualifiesAsDifficult(
  state: LearningState,
  difficulty: number,
  config: LearningConfig,
): boolean {
  return (
    state.attempts >= config.difficult.minAttempts &&
    state.failures >= config.difficult.minFailures &&
    difficulty >= config.difficult.enterScore
  );
}

function scheduleSuccess(
  base: LearningState,
  previousStatus: LearningStatus,
  status: TrackedStatus,
  grade: AttemptGrade,
  gap: number,
  streak: number,
  now: Date,
  config: LearningConfig,
): Pick<LearningState, 'intervalMinutes' | 'dueAt'> {
  const schedule = config.schedule;

  // Fase de aprendizaje: pasos cortos (minutos u horas) que permiten avanzar en el mismo día.
  if (!isMastered(status)) {
    const steps = schedule.learningStepsMinutes;
    const index = Math.min(grade === 'hard' ? streak - 1 : streak, steps.length - 1);
    return scheduleIn(now, steps[Math.max(index, 0)]);
  }

  // Recién dominada: la primera comprobación de retención es otro día.
  if (!isMastered(previousStatus)) return scheduleInDays(now, schedule.firstReviewDays);

  // Repaso de una palabra dominada: el intervalo crece con el tiempo que realmente la recordó.
  const currentDays = Math.max(base.intervalMinutes / MINUTES_PER_DAY, schedule.firstReviewDays);
  const elapsedDays = gap / DAY;
  if (elapsedDays < currentDays * schedule.earlyReviewRatio) {
    // Repaso adelantado (p. ej. práctica libre): mantiene la programación sin inflarla.
    return { intervalMinutes: base.intervalMinutes, dueAt: base.dueAt };
  }
  const reference = Math.max(currentDays, elapsedDays);
  const days =
    grade === 'hard'
      ? Math.max(1, Math.round(reference * schedule.hardFactor))
      : Math.max(Math.ceil(currentDays) + 1, Math.round(reference * schedule.goodFactor));
  return scheduleInDays(now, Math.min(days, schedule.maxIntervalDays));
}

function scheduleIn(now: Date, minutes: number): Pick<LearningState, 'intervalMinutes' | 'dueAt'> {
  return { intervalMinutes: minutes, dueAt: new Date(now.getTime() + minutes * MINUTE) };
}

/** Intervalos de días: desde la medianoche local, para que aparezca en cuanto empieza ese día. */
function scheduleInDays(now: Date, days: number): Pick<LearningState, 'intervalMinutes' | 'dueAt'> {
  return { intervalMinutes: days * MINUTES_PER_DAY, dueAt: addDays(startOfLocalDay(now), days) };
}

function weakerDirection(state: LearningState): StudyDirection | null {
  const { en_es, es_en } = state.directions;
  if (en_es.attempts < 2 || es_en.attempts < 2) return null;
  const enEs = en_es.failures / en_es.attempts;
  const esEn = es_en.failures / es_en.attempts;
  if (Math.abs(enEs - esEn) < 0.34) return null;
  return enEs > esEn ? 'en_es' : 'es_en';
}

function emptyState(now: Date): LearningState {
  return {
    status: 'learning',
    mastery: 0,
    difficulty: 0,
    attempts: 0,
    successes: 0,
    failures: 0,
    hardCount: 0,
    streak: 0,
    streakPoints: 0,
    streakStartedAt: null,
    retentionPoints: 0,
    recent: '',
    lapses: 0,
    directions: { en_es: { attempts: 0, failures: 0 }, es_en: { attempts: 0, failures: 0 } },
    intervalMinutes: 0,
    dueAt: now,
    lastAttemptAt: now,
    provisionalAt: null,
    learnedAt: null,
    version: 0,
  };
}

const GRADE_CODES: Record<AttemptGrade, string> = { again: 'a', hard: 'h', good: 'g' };
const CODE_ERROR: Record<string, number> = { a: 1, h: 0.5, g: 0 };

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
