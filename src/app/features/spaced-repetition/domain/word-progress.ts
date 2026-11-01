import { LearningConfig } from './learning-config';
import { LearningState, LearningStatus, learningStatusOf } from './learning-state';

/**
 * Avance de una palabra hacia «Aprendida», calculado con las mismas condiciones que usa
 * `applyAttempt` (sin puntos ni porcentajes propios):
 *   Para dominarla:  dominio ≥ minMastery · puntos de aciertos seguidos · racha que abarca ≥ minSpanMinutes.
 *   Para aprenderla: puntos de retención · racha que abarca ≥ minSpanDays.
 * El porcentaje es el promedio de lo cumplido en cada requisito. Un fallo reinicia la racha y la
 * retención y reduce el dominio a la mitad, así que el avance baja igual que en el algoritmo.
 */
export type RequirementKey = 'mastery' | 'streak' | 'span' | 'retention' | 'days';
export type RequirementStage = 'mastered' | 'learned';

export interface Requirement {
  readonly key: RequirementKey;
  readonly stage: RequirementStage;
  readonly label: string;
  /** Valor actual frente al objetivo, p. ej. «45 de 70». */
  readonly detail: string;
  /** 0–1. */
  readonly fraction: number;
  readonly done: boolean;
  /**
   * Desde cuándo un acierto puede cumplirlo (requisitos de tiempo). Las condiciones se evalúan al
   * acertar, así que antes de esa hora un acierto no lo completa.
   */
  readonly readyAt: Date | null;
}

export interface WordProgress {
  readonly status: LearningStatus;
  /** 0–100. */
  readonly percent: number;
  readonly requirements: readonly Requirement[];
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function wordProgress(state: LearningState | null, config: LearningConfig): WordProgress {
  const status = learningStatusOf(state);
  const { provisional, learned } = config;
  const streakActive = !!state && state.streak > 0 && !!state.streakStartedAt;
  const startedAt = streakActive ? state.streakStartedAt!.getTime() : null;
  const span = startedAt === null ? 0 : Math.max(0, state!.lastAttemptAt.getTime() - startedAt);
  const mastery = state?.mastery ?? 0;
  const streakPoints = state?.streakPoints ?? 0;
  const retention = state?.retentionPoints ?? 0;
  const spanTarget = provisional.minSpanMinutes * MINUTE;
  const daysTarget = learned.minSpanDays * DAY;
  // Un estado alcanzado se conserva hasta el siguiente fallo: sus requisitos cuentan como cumplidos.
  const masteredReached = status === 'provisional' || status === 'learned';
  const learnedReached = status === 'learned';

  const requirements: Requirement[] = [
    requirement({
      key: 'mastery',
      stage: 'mastered',
      label: `Dominio de ${provisional.minMastery} o más`,
      detail: `${mastery} de ${provisional.minMastery}`,
      value: mastery,
      target: provisional.minMastery,
      reached: masteredReached,
    }),
    requirement({
      key: 'streak',
      stage: 'mastered',
      label: 'Aciertos seguidos suficientes',
      detail: `${formatNumber(streakPoints)} de ${formatNumber(provisional.minStreakPoints)} puntos`,
      value: streakPoints,
      target: provisional.minStreakPoints,
      reached: masteredReached,
    }),
    requirement({
      key: 'span',
      stage: 'mastered',
      label: `Aciertos repartidos en ${formatDuration(spanTarget)} o más`,
      detail: `${formatDuration(span)} de ${formatDuration(spanTarget)}`,
      value: span,
      target: spanTarget,
      reached: masteredReached,
      readyAt: startedAt === null ? null : new Date(startedAt + spanTarget),
    }),
    requirement({
      key: 'retention',
      stage: 'learned',
      label: `Recordarla tras ${learned.retentionGapHours} h sin verla`,
      detail: `${formatNumber(retention)} de ${formatNumber(learned.minRetentionPoints)} puntos`,
      value: retention,
      target: learned.minRetentionPoints,
      reached: learnedReached,
      readyAt: state
        ? new Date(state.lastAttemptAt.getTime() + learned.retentionGapHours * HOUR)
        : null,
    }),
    requirement({
      key: 'days',
      stage: 'learned',
      label: `Racha sin fallos de ${learned.minSpanDays} días o más`,
      detail: `${formatDuration(span)} de ${formatDuration(daysTarget)}`,
      value: span,
      target: daysTarget,
      reached: learnedReached,
      readyAt: startedAt === null ? null : new Date(startedAt + daysTarget),
    }),
  ];

  const percent = learnedReached
    ? 100
    : Math.round(
        (100 * requirements.reduce((sum, item) => sum + item.fraction, 0)) / requirements.length,
      );
  return { status, percent, requirements };
}

function requirement(input: {
  key: RequirementKey;
  stage: RequirementStage;
  label: string;
  detail: string;
  value: number;
  target: number;
  reached: boolean;
  readyAt?: Date | null;
}): Requirement {
  const fraction = input.reached ? 1 : Math.min(1, Math.max(0, input.value / input.target));
  const done = fraction >= 1;
  return {
    key: input.key,
    stage: input.stage,
    label: input.label,
    detail: input.detail,
    fraction,
    done,
    readyAt: done ? null : (input.readyAt ?? null),
  };
}

/** «45 min», «3 h», «2,5 días». */
export function formatDuration(ms: number): string {
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min`;
  if (ms < 2 * DAY) return `${formatNumber(Math.floor((ms / HOUR) * 10) / 10)} h`;
  return `${formatNumber(Math.floor((ms / DAY) * 10) / 10)} días`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('es', { maximumFractionDigits: 2 });
}
