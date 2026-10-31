/** Dirección de estudio. Coincide con la columna review_events.direction. */
export type StudyDirection = 'en_es' | 'es_en';

export const DIRECTION_LABELS: Record<StudyDirection, string> = {
  en_es: 'Inglés → Español',
  es_en: 'Español → Inglés',
};

export interface Translatable {
  readonly term: string;
  readonly translation: string;
}

/** Texto que se muestra como pregunta según la dirección. */
export function promptOf(item: Translatable, direction: StudyDirection): string {
  return direction === 'en_es' ? item.term : item.translation;
}

/** Texto que se espera como respuesta según la dirección. */
export function answerOf(item: Translatable, direction: StudyDirection): string {
  return direction === 'en_es' ? item.translation : item.term;
}

/** Idioma (atributo lang) del texto de la pregunta y de la respuesta. */
export function languagesOf(direction: StudyDirection): {
  prompt: 'en' | 'es';
  answer: 'en' | 'es';
} {
  return direction === 'en_es' ? { prompt: 'en', answer: 'es' } : { prompt: 'es', answer: 'en' };
}
