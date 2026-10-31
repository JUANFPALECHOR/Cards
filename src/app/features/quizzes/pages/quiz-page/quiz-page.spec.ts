import { QuizAnswer, QuizQuestion } from '../../models/quiz';
import { quizGrade, quizKind } from './quiz-page';

function answer(type: QuizQuestion['type'], outcome: QuizAnswer['outcome']): QuizAnswer {
  return {
    question: {
      index: 0,
      itemId: 'item-1',
      type,
      direction: 'en_es',
      prompt: 'Improve',
      answer: 'mejorar',
      accepted: ['mejorar'],
      options: type === 'multiple-choice' ? ['mejorar', 'empeorar'] : null,
    },
    given: 'mejorar',
    outcome,
    matched: null,
  };
}

describe('10 · cuestionarios en el aprendizaje adaptativo', () => {
  it('distingue selección múltiple (reconocer) de respuesta escrita (recordar)', () => {
    expect(quizKind(answer('multiple-choice', 'correct'))).toBe('multiple_choice');
    expect(quizKind(answer('written', 'correct'))).toBe('written');
  });

  it('un error registra «No la sabía»; un acierto, aunque falte una tilde, «La sabía»', () => {
    expect(quizGrade(answer('written', 'incorrect'))).toBe('again');
    expect(quizGrade(answer('written', 'correct'))).toBe('good');
    expect(quizGrade(answer('written', 'correct-with-warning'))).toBe('good');
    expect(quizGrade(answer('multiple-choice', 'incorrect'))).toBe('again');
  });
});
