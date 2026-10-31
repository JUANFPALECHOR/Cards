import { BarSegment } from '../../../shared/ui/molecules/segmented-bar/segmented-bar';
import {
  LEARNING_STATUS_LABELS,
  LearningStatus,
} from '../../spaced-repetition/domain/learning-state';

export type StatusCounts = Readonly<Record<LearningStatus, number>>;

export const EMPTY_STATUS_COUNTS: StatusCounts = {
  new: 0,
  learning: 0,
  difficult: 0,
  provisional: 0,
  learned: 0,
};

/** Orden de la barra: el avance crece desde la izquierda y lo que falta queda a la derecha. */
const BAR_ORDER: readonly LearningStatus[] = [
  'learned',
  'provisional',
  'learning',
  'difficult',
  'new',
];

/** Segmentos de la barra de dominio (verde, azul, amarillo, rojo y gris). */
export function statusSegments(counts: StatusCounts): BarSegment[] {
  return BAR_ORDER.map((status) => ({
    key: status,
    label: LEARNING_STATUS_LABELS[status],
    value: counts[status],
    color: `var(--color-status-${status})`,
  }));
}

export function countStatuses(statuses: readonly LearningStatus[]): StatusCounts {
  const counts = { ...EMPTY_STATUS_COUNTS };
  for (const status of statuses) counts[status]++;
  return counts;
}

export function totalOf(counts: StatusCounts): number {
  return Object.values(counts).reduce((sum, value) => sum + value, 0);
}
