import { StudyDirection, answerOf, promptOf } from '../../../core/models/study-direction';
import { toPercent } from '../../../shared/utils/numbers';
import { RandomSource, shuffle } from '../../../shared/utils/random';
import {
  QuestionType,
  QuizAnswer,
  QuizBuild,
  QuizConfig,
  QuizItem,
  QuizQuestion,
  QuizResult,
} from '../models/quiz';
import { checkWrittenAnswer, looseAnswerKey, splitAlternatives } from './answer-checker';

export const MAX_OPTIONS = 4;
export const MIN_OPTIONS = 2;

/** Respuestas distintas disponibles en una dirección (para saber si cabe selección múltiple). */
export function distinctAnswerCount(items: readonly QuizItem[], direction: StudyDirection): number {
  return new Set(items.map((item) => looseAnswerKey(answerOf(item, direction)))).size;
}

/** ¿Hay al menos dos respuestas distintas en todas las direcciones del cuestionario? */
export function canUseMultipleChoice(
  items: readonly QuizItem[],
  direction: QuizConfig['direction'],
): boolean {
  const directions: StudyDirection[] = direction === 'both' ? ['en_es', 'es_en'] : [direction];
  return directions.every((dir) => distinctAnswerCount(items, dir) >= MIN_OPTIONS);
}

/**
 * Genera un cuestionario a partir del vocabulario del conjunto, sin inventar traducciones:
 * los distractores son respuestas reales de otras palabras del mismo conjunto.
 *
 *   · Se eligen `count` palabras al azar (como máximo, todas).
 *   · "Ambas" direcciones y "Mixto" se reparten mitad y mitad, en orden aleatorio.
 *   · Un distractor se descarta si coincide (sin tildes) con alguna respuesta aceptada
 *     o si pertenece a una palabra con la misma pregunta (evita opciones ambiguas).
 *   · Con menos de 3 distractores la pregunta tiene menos opciones; sin ninguno, pasa a escrita.
 */
export function buildQuiz(
  items: readonly QuizItem[],
  config: QuizConfig,
  random: RandomSource = Math.random,
): QuizBuild {
  const count = Math.min(Math.max(Math.trunc(config.count), 1), items.length);
  const selected = shuffle(items, random).slice(0, count);
  const directions = spread<StudyDirection>(
    config.direction === 'both' ? ['en_es', 'es_en'] : [config.direction],
    count,
    random,
  );
  const types = spread<QuestionType>(
    config.type === 'mixed' ? ['multiple-choice', 'written'] : [config.type],
    count,
    random,
  );

  let convertedToWritten = 0;
  let reducedOptions = 0;

  const questions = selected.map((item, index): QuizQuestion => {
    const direction = directions[index];
    const prompt = promptOf(item, direction);
    const answer = answerOf(item, direction);
    const promptKey = looseAnswerKey(prompt);
    const siblings = items.filter(
      (other) => looseAnswerKey(promptOf(other, direction)) === promptKey,
    );
    const accepted = unique(siblings.map((other) => answerOf(other, direction)));

    let type = types[index];
    let options: string[] | null = null;

    if (type === 'multiple-choice') {
      const distractors = pickDistractors(items, direction, promptKey, accepted, random);
      if (distractors.length === 0) {
        type = 'written';
        convertedToWritten++;
      } else {
        if (distractors.length < MAX_OPTIONS - 1) reducedOptions++;
        options = shuffle([answer, ...distractors], random);
      }
    }

    return { index, itemId: item.id, type, direction, prompt, answer, accepted, options };
  });

  const notices: string[] = [];
  if (convertedToWritten > 0) {
    notices.push(
      `${plural(convertedToWritten, 'pregunta de selección múltiple pasó', 'preguntas de selección múltiple pasaron')} a respuesta escrita porque el conjunto no tiene suficientes respuestas distintas.`,
    );
  }
  if (reducedOptions > 0) {
    notices.push(
      `${plural(reducedOptions, 'pregunta tiene', 'preguntas tienen')} menos de ${MAX_OPTIONS} opciones porque el conjunto tiene pocas respuestas distintas.`,
    );
  }

  return { questions, notices };
}

/** Evalúa la respuesta a una pregunta (opción elegida o texto escrito). */
export function gradeAnswer(question: QuizQuestion, given: string): QuizAnswer {
  if (question.type === 'multiple-choice') {
    return {
      question,
      given,
      outcome: given === question.answer ? 'correct' : 'incorrect',
      matched: null,
    };
  }
  const { outcome, matched } = checkWrittenAnswer(given, question.accepted);
  return { question, given, outcome, matched };
}

export function summarizeQuiz(answers: readonly QuizAnswer[]): QuizResult {
  const correct = answers.filter((answer) => answer.outcome !== 'incorrect').length;
  return {
    total: answers.length,
    correct,
    incorrect: answers.length - correct,
    percent: toPercent(correct, answers.length),
  };
}

function pickDistractors(
  items: readonly QuizItem[],
  direction: StudyDirection,
  promptKey: string,
  accepted: readonly string[],
  random: RandomSource,
): string[] {
  const blocked = new Set(accepted.flatMap(splitAlternatives).map(looseAnswerKey));
  accepted.forEach((answer) => blocked.add(looseAnswerKey(answer)));

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const other of items) {
    if (looseAnswerKey(promptOf(other, direction)) === promptKey) continue;
    const candidate = answerOf(other, direction);
    const key = looseAnswerKey(candidate);
    const overlaps = [key, ...splitAlternatives(candidate).map(looseAnswerKey)].some((part) =>
      blocked.has(part),
    );
    if (overlaps || seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }
  return shuffle(candidates, random).slice(0, MAX_OPTIONS - 1);
}

/** Reparte los valores de forma equilibrada en `count` posiciones aleatorias. */
function spread<T>(values: readonly T[], count: number, random: RandomSource): T[] {
  return shuffle(
    Array.from({ length: count }, (_, index) => values[index % values.length]),
    random,
  );
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = looseAnswerKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
