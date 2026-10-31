import { stripAccents } from '../../../shared/utils/text';

/**
 * Política de respuestas escritas:
 *   1. Se ignoran mayúsculas, espacios extra y signos de puntuación al inicio o al final (¿?¡!.,;:"'«»()).
 *   2. Una respuesta puede tener alternativas separadas por «/» o «;» ("banco / orilla"): vale cualquiera.
 *   3. Si solo difiere en tildes o diéresis, se acepta como correcta con un aviso que muestra la forma exacta.
 *   4. La ñ NO equivale a la n: "nino" no es "niño".
 */
export type AnswerOutcome = 'correct' | 'correct-with-warning' | 'incorrect';

export interface AnswerCheck {
  readonly outcome: AnswerOutcome;
  /** Alternativa con la que coincidió (para mostrar la ortografía exacta en el aviso). */
  readonly matched: string | null;
}

const EDGE_PUNCTUATION = /^[\s.,;:!?¡¿"'«»“”‘’()[\]-]+|[\s.,;:!?¡¿"'«»“”‘’()[\]-]+$/g;

export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFC')
    .toLocaleLowerCase('es')
    .replace(/\s+/g, ' ')
    .replace(EDGE_PUNCTUATION, '')
    .trim();
}

/** Clave sin tildes (conservando la ñ) para comparar con tolerancia. */
export function looseAnswerKey(text: string): string {
  return stripAccents(normalizeAnswer(text), { keepEnye: true });
}

export function splitAlternatives(answer: string): string[] {
  return answer
    .split(/[/;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function checkWrittenAnswer(given: string, accepted: readonly string[]): AnswerCheck {
  const normalized = normalizeAnswer(given);
  if (!normalized) return { outcome: 'incorrect', matched: null };

  const alternatives = accepted.flatMap(splitAlternatives);

  const exact = alternatives.find((alternative) => normalizeAnswer(alternative) === normalized);
  if (exact) return { outcome: 'correct', matched: exact };

  const loose = looseAnswerKey(given);
  const close = alternatives.find((alternative) => looseAnswerKey(alternative) === loose);
  if (close) return { outcome: 'correct-with-warning', matched: close };

  return { outcome: 'incorrect', matched: null };
}
