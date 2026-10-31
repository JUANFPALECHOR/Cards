import { seededRandom } from '../../../shared/utils/random';
import { QuizItem } from '../models/quiz';
import {
  buildQuiz,
  canUseMultipleChoice,
  distinctAnswerCount,
  gradeAnswer,
  summarizeQuiz,
} from './quiz-generator';
import { looseAnswerKey } from './answer-checker';

const items: QuizItem[] = [
  { id: '1', term: 'run', translation: 'correr' },
  { id: '2', term: 'walk', translation: 'caminar' },
  { id: '3', term: 'eat', translation: 'comer' },
  { id: '4', term: 'sleep', translation: 'dormir' },
  { id: '5', term: 'read', translation: 'leer' },
];

describe('buildQuiz', () => {
  it('genera la cantidad pedida sin repetir palabras', () => {
    const { questions } = buildQuiz(
      items,
      { type: 'written', direction: 'en_es', count: 3 },
      seededRandom(1),
    );

    expect(questions).toHaveLength(3);
    expect(new Set(questions.map((q) => q.itemId)).size).toBe(3);
  });

  it('limita la cantidad al vocabulario disponible', () => {
    const { questions } = buildQuiz(
      items,
      { type: 'written', direction: 'en_es', count: 50 },
      seededRandom(2),
    );
    expect(questions).toHaveLength(items.length);
  });

  it('usa la dirección indicada para pregunta y respuesta', () => {
    const { questions } = buildQuiz(
      items,
      { type: 'written', direction: 'es_en', count: 5 },
      seededRandom(3),
    );
    const run = questions.find((q) => q.itemId === '1');

    expect(run?.prompt).toBe('correr');
    expect(run?.answer).toBe('run');
  });

  it('reparte mitad y mitad las preguntas en ambas direcciones', () => {
    const { questions } = buildQuiz(
      items,
      { type: 'written', direction: 'both', count: 4 },
      seededRandom(4),
    );
    const enEs = questions.filter((q) => q.direction === 'en_es').length;

    expect(enEs).toBe(2);
  });

  it('crea opciones de selección múltiple sin duplicados e incluyendo la correcta', () => {
    const { questions, notices } = buildQuiz(
      items,
      { type: 'multiple-choice', direction: 'en_es', count: 5 },
      seededRandom(5),
    );

    for (const question of questions) {
      expect(question.type).toBe('multiple-choice');
      expect(question.options).toHaveLength(4);
      expect(question.options).toContain(question.answer);
      expect(new Set(question.options!.map(looseAnswerKey)).size).toBe(4);
    }
    expect(notices).toEqual([]);
  });

  it('solo usa traducciones reales del conjunto como distractores', () => {
    const translations = new Set(items.map((item) => item.translation));
    const { questions } = buildQuiz(
      items,
      { type: 'multiple-choice', direction: 'en_es', count: 5 },
      seededRandom(6),
    );

    questions.forEach((q) =>
      q.options!.forEach((option) => expect(translations.has(option)).toBe(true)),
    );
  });

  it('reduce opciones e informa cuando hay pocas respuestas distintas', () => {
    const few = items.slice(0, 2);
    const { questions, notices } = buildQuiz(
      few,
      { type: 'multiple-choice', direction: 'en_es', count: 2 },
      seededRandom(7),
    );

    expect(questions.every((q) => q.options?.length === 2)).toBe(true);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain('menos de 4 opciones');
  });

  it('pasa a escrita cuando no hay ningún distractor posible', () => {
    const { questions, notices } = buildQuiz(
      [{ id: '1', term: 'run', translation: 'correr' }],
      { type: 'multiple-choice', direction: 'en_es', count: 1 },
      seededRandom(8),
    );

    expect(questions[0].type).toBe('written');
    expect(questions[0].options).toBeNull();
    expect(notices[0]).toContain('respuesta escrita');
  });

  it('evita distractores ambiguos: misma pregunta o respuesta equivalente', () => {
    const ambiguous: QuizItem[] = [
      { id: 'a', term: 'bank', translation: 'banco' },
      { id: 'b', term: 'bank', translation: 'orilla' },
      { id: 'c', term: 'shore', translation: 'Orilla' },
      { id: 'd', term: 'song', translation: 'canción' },
      { id: 'e', term: 'tune', translation: 'cancion / melodía' },
      { id: 'f', term: 'dog', translation: 'perro' },
    ];
    const { questions } = buildQuiz(
      ambiguous,
      { type: 'multiple-choice', direction: 'en_es', count: 6 },
      seededRandom(9),
    );

    const bank = questions.find((q) => q.itemId === 'a')!;
    expect(bank.accepted).toEqual(['banco', 'orilla']);
    expect(bank.options!.map(looseAnswerKey)).not.toContain('orilla');

    const song = questions.find((q) => q.itemId === 'd')!;
    expect(song.options).not.toContain('cancion / melodía');
  });
});

describe('disponibilidad de selección múltiple', () => {
  it('cuenta respuestas distintas sin tildes', () => {
    const list: QuizItem[] = [
      { id: '1', term: 'song', translation: 'canción' },
      { id: '2', term: 'tune', translation: 'cancion' },
    ];
    expect(distinctAnswerCount(list, 'en_es')).toBe(1);
    expect(canUseMultipleChoice(list, 'en_es')).toBe(false);
    expect(canUseMultipleChoice(list, 'es_en')).toBe(true);
    expect(canUseMultipleChoice(list, 'both')).toBe(false);
  });
});

describe('gradeAnswer y summarizeQuiz', () => {
  const { questions } = buildQuiz(
    items,
    { type: 'written', direction: 'en_es', count: 3 },
    seededRandom(10),
  );

  it('evalúa respuestas escritas con la política de tildes', () => {
    const question = { ...questions[0], answer: 'canción', accepted: ['canción'] };
    expect(gradeAnswer(question, 'cancion').outcome).toBe('correct-with-warning');
    expect(gradeAnswer(question, 'otra').outcome).toBe('incorrect');
  });

  it('evalúa selección múltiple comparando la opción elegida', () => {
    const question = {
      ...questions[0],
      type: 'multiple-choice' as const,
      options: ['a', 'b'],
      answer: 'a',
    };
    expect(gradeAnswer(question, 'a').outcome).toBe('correct');
    expect(gradeAnswer(question, 'b').outcome).toBe('incorrect');
  });

  it('calcula aciertos, errores y porcentaje (los avisos de tildes cuentan como acierto)', () => {
    const answers = [
      { question: questions[0], given: 'x', outcome: 'correct' as const, matched: null },
      {
        question: questions[1],
        given: 'y',
        outcome: 'correct-with-warning' as const,
        matched: 'y',
      },
      { question: questions[2], given: 'z', outcome: 'incorrect' as const, matched: null },
    ];
    expect(summarizeQuiz(answers)).toEqual({ total: 3, correct: 2, incorrect: 1, percent: 67 });
  });
});
