import { DEFAULT_LEARNING_CONFIG } from './learning-config';
import { AttemptGrade, LearningState, applyAttempt } from './learning-state';
import { wordProgress } from './word-progress';

const config = DEFAULT_LEARNING_CONFIG;

function play(steps: readonly [hour: number, grade: AttemptGrade][]): LearningState {
  let state: LearningState | null = null;
  for (const [hour, grade] of steps) {
    const at = new Date(2026, 9, 1, 0, Math.round(hour * 60));
    state = applyAttempt(state, { grade, kind: 'written', direction: 'en_es', at }, config).state;
  }
  return state!;
}

describe('wordProgress', () => {
  it('una palabra nueva no tiene avance', () => {
    const progress = wordProgress(null, config);
    expect(progress.percent).toBe(0);
    expect(progress.requirements.every((item) => !item.done)).toBe(true);
  });

  it('avanza con aciertos repartidos y cumple los requisitos de dominio', () => {
    const early = wordProgress(play([[9, 'good']]), config);
    const mastered = play([
      [9, 'good'],
      [9.5, 'good'],
      [10.5, 'good'],
      [11.5, 'good'],
    ]);
    const progress = wordProgress(mastered, config);

    expect(mastered.status).toBe('provisional');
    expect(progress.percent).toBeGreaterThan(early.percent);
    expect(
      progress.requirements.filter((item) => item.stage === 'mastered').every((item) => item.done),
    ).toBe(true);
    expect(progress.requirements.find((item) => item.key === 'retention')?.done).toBe(false);
  });

  it('un fallo reduce el avance según el algoritmo (reinicia racha y retención)', () => {
    const before = play([
      [9, 'good'],
      [9.5, 'good'],
      [10.5, 'good'],
    ]);
    const after = play([
      [9, 'good'],
      [9.5, 'good'],
      [10.5, 'good'],
      [11, 'again'],
    ]);
    expect(wordProgress(after, config).percent).toBeLessThan(wordProgress(before, config).percent);
    expect(
      wordProgress(after, config).requirements.find((item) => item.key === 'streak')?.fraction,
    ).toBe(0);
  });

  it('los requisitos de tiempo indican desde cuándo un acierto los cumple', () => {
    const state = play([[9, 'good']]);
    const span = wordProgress(state, config).requirements.find((item) => item.key === 'span')!;
    expect(span.readyAt).toEqual(new Date(2026, 9, 1, 11, 0));
  });

  it('una palabra aprendida está al 100 %', () => {
    const state = { ...play([[9, 'good']]), status: 'learned' as const };
    expect(wordProgress(state, config).percent).toBe(100);
  });
});
