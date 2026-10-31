import { StudyDirection } from '../../../core/models/study-direction';
import { AnswerOutcome } from '../domain/answer-checker';

export type QuestionType = 'multiple-choice' | 'written';
export type QuizTypeOption = QuestionType | 'mixed';
export type QuizDirectionOption = StudyDirection | 'both';

export interface QuizConfig {
  readonly type: QuizTypeOption;
  readonly direction: QuizDirectionOption;
  readonly count: number;
}

export interface QuizItem {
  readonly id: string;
  readonly term: string;
  readonly translation: string;
}

export interface QuizQuestion {
  readonly index: number;
  readonly itemId: string;
  readonly type: QuestionType;
  readonly direction: StudyDirection;
  readonly prompt: string;
  /** Respuesta principal (la del elemento preguntado). */
  readonly answer: string;
  /**
   * Respuestas aceptadas: la principal y las de otras palabras del conjunto con la misma pregunta
   * (p. ej. dos entradas "bank" → "banco" y "orilla").
   */
  readonly accepted: readonly string[];
  /** Opciones barajadas; null en preguntas escritas. */
  readonly options: readonly string[] | null;
}

export interface QuizBuild {
  readonly questions: readonly QuizQuestion[];
  /** Avisos sobre adaptaciones (p. ej. menos opciones por falta de vocabulario distinto). */
  readonly notices: readonly string[];
}

export interface QuizAnswer {
  readonly question: QuizQuestion;
  readonly given: string;
  readonly outcome: AnswerOutcome;
  /** Forma exacta a mostrar cuando hubo aviso de tildes. */
  readonly matched: string | null;
}

export interface QuizResult {
  readonly total: number;
  readonly correct: number;
  readonly incorrect: number;
  readonly percent: number;
}
