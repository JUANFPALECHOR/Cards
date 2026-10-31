import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DEFAULT_LEARNING_CONFIG } from '../../../spaced-repetition/domain/learning-config';
import { applyAttempt } from '../../../spaced-repetition/domain/learning-state';
import { ProgressData, ProgressRepository } from '../../data/progress.repository';
import { ProgressPage } from './progress-page';

const difficultState = (() => {
  let state = null;
  for (let i = 0; i < 4; i++) {
    state = applyAttempt(
      state,
      {
        grade: 'again',
        kind: 'self_assessment',
        direction: 'en_es',
        at: new Date(2026, 9, 30, 9, i * 20),
      },
      DEFAULT_LEARNING_CONFIG,
    ).state;
  }
  return state!;
})();

function data(overrides: Partial<ProgressData> = {}): ProgressData {
  return {
    overview: {
      counts: { new: 6, learning: 5, difficult: 1, provisional: 2, learned: 4 },
      totalItems: 18,
      dueNow: 3,
      dueToday: 4,
      dueTomorrow: 2,
      dueWeek: 9,
      nextDueAt: null,
      totalAnswers: 40,
      correctAnswers: 30,
      hardAnswers: 5,
      masteredToday: 1,
      learnedToday: 0,
    },
    studyDays: [],
    weekly: [
      { weekStart: '2026-10-19', answers: 0, correct: 0, mastered: 0, learned: 0 },
      { weekStart: '2026-10-26', answers: 40, correct: 30, mastered: 6, learned: 4 },
    ],
    attention: [{ itemId: 'a', term: 'Achieve', translation: 'lograr', state: difficultState }],
    masteredToday: [],
    recentlyLearned: [],
    recentAttempts: [],
    ...overrides,
  };
}

describe('ProgressPage', () => {
  const getProgress = vi.fn();

  beforeEach(() => {
    getProgress.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: ProgressRepository, useValue: { getProgress } }],
    });
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(ProgressPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('13 · 14 · muestra los cinco estados y la leyenda suma el total', async () => {
    getProgress.mockResolvedValue(data());
    const element = await render();

    const legend = [...element.querySelectorAll('.legend-item')].map((item) =>
      item.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(legend).toEqual([
      'Aprendida 4 (22%)',
      'Dominada provisionalmente 2 (11%)',
      'En aprendizaje 5 (28%)',
      'Difícil 1 (6%)',
      'Nueva 6 (33%)',
    ]);
    const segments = [...element.querySelectorAll<HTMLElement>('.segment')];
    expect(segments.reduce((sum, segment) => sum + Number(segment.style.flexGrow), 0)).toBe(18);
    expect(element.textContent).toContain('18 palabras en total');
  });

  it('muestra aprendido y dominio provisional por separado, sin mezclarlos con la precisión', async () => {
    getProgress.mockResolvedValue(data());
    const element = await render();
    const figures = [...element.querySelectorAll('.figure')].map((f) =>
      f.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(figures[0]).toContain('22% Aprendido');
    expect(figures[1]).toContain('11% Dominado provisionalmente');
    expect(element.textContent).toContain('75%');
    expect(element.textContent).toContain('30 de 40 respuestas · 5 con dificultad');
  });

  it('explica por qué una palabra necesita atención', async () => {
    getProgress.mockResolvedValue(data());
    const element = await render();

    expect(element.querySelector('.word-reason')?.textContent).toContain(
      'Fallaste 4 de tus últimos 4 intentos.',
    );
  });

  it('15 · sin vocabulario ni respuestas muestra el estado vacío', async () => {
    getProgress.mockResolvedValue(
      data({
        overview: {
          ...data().overview,
          counts: { new: 0, learning: 0, difficult: 0, provisional: 0, learned: 0 },
          totalAnswers: 0,
          correctAnswers: 0,
        },
      }),
    );
    const element = await render();
    expect(element.textContent).toContain('Aún no hay progreso que mostrar');
  });

  it('16 · un error de Supabase muestra el aviso y permite reintentar', async () => {
    getProgress.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(data());
    const fixture = TestBed.createComponent(ProgressPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('No pudimos cargar tu progreso');
    expect(element.textContent).toContain('Revisa tu conexión');

    element.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(element.textContent).toContain('Tu vocabulario');
  });
});
