import { LearningState, LearningStatus } from '../../spaced-repetition/domain/learning-state';

export interface VocabularyItem {
  readonly id: string;
  readonly setId: string;
  /** Palabra o expresión en inglés. */
  readonly term: string;
  /** Traducción al español. Admite alternativas separadas por «/» o «;». */
  readonly translation: string;
  readonly example: string | null;
  readonly notes: string | null;
  /** Pronunciación aproximada para hispanohablantes (p. ej. «TRÁ-bol-shú-ting»). */
  readonly pronunciation: string | null;
  readonly status: LearningStatus;
  /** Estado de aprendizaje completo; null si la palabra todavía es nueva. */
  readonly learning: LearningState | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VocabularyInput {
  readonly term: string;
  readonly translation: string;
  readonly example: string | null;
  readonly notes: string | null;
  readonly pronunciation: string | null;
}

export const TERM_MAX = 200;
export const TRANSLATION_MAX = 200;
export const EXAMPLE_MAX = 500;
export const NOTES_MAX = 1000;
export const PRONUNCIATION_MAX = 100;
