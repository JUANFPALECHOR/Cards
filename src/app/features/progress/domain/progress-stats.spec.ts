import { LearningOverview } from '../../spaced-repetition/data/learning.repository';
import { buildProgressSummary, computeStreak } from './progress-stats';
import { statusSegments, totalOf } from './status-segments';

function overview(overrides: Partial<LearningOverview> = {}): LearningOverview {
  return {
    counts: { new: 0, learning: 0, difficult: 0, provisional: 0, learned: 0 },
    totalItems: 0,
    dueNow: 0,
    dueToday: 0,
    dueTomorrow: 0,
    dueWeek: 0,
    nextDueAt: null,
    totalAnswers: 0,
    correctAnswers: 0,
    hardAnswers: 0,
    masteredToday: 0,
    learnedToday: 0,
    ...overrides,
  };
}

describe('computeStreak', () => {
  const today = new Date(2026, 9, 29, 20, 0);

  it('cuenta los días seguidos hasta hoy', () => {
    expect(computeStreak(['2026-10-29', '2026-10-28', '2026-10-27', '2026-10-20'], today)).toEqual({
      streak: 3,
      studiedToday: true,
    });
  });

  it('mantiene la racha de ayer si hoy todavía no se estudió', () => {
    expect(computeStreak(['2026-10-28', '2026-10-27'], today)).toEqual({
      streak: 2,
      studiedToday: false,
    });
  });

  it('se rompe si el último día de estudio fue antes de ayer', () => {
    expect(computeStreak(['2026-10-27', '2026-10-26'], today).streak).toBe(0);
  });

  it('es cero sin actividad', () => {
    expect(computeStreak([], today)).toEqual({ streak: 0, studiedToday: false });
  });

  it('cruza correctamente el cambio de mes', () => {
    const firstOfMonth = new Date(2026, 10, 1, 9);
    expect(computeStreak(['2026-11-01', '2026-10-31', '2026-10-30'], firstOfMonth).streak).toBe(3);
  });
});

describe('buildProgressSummary', () => {
  const today = new Date(2026, 9, 29);

  it('11 · calcula aprendido y dominio provisional por separado, precisión y pendientes', () => {
    const summary = buildProgressSummary(
      {
        overview: overview({
          counts: { new: 8, learning: 12, difficult: 4, provisional: 6, learned: 10 },
          totalItems: 40,
          dueNow: 5,
          dueToday: 7,
          dueTomorrow: 3,
          dueWeek: 15,
          totalAnswers: 120,
          correctAnswers: 90,
          hardAnswers: 12,
          masteredToday: 2,
        }),
        studyDays: ['2026-10-29'],
      },
      today,
    );

    expect(summary).toEqual(
      expect.objectContaining({
        total: 40,
        learnedPercent: 25,
        provisionalPercent: 15,
        dueNow: 5,
        dueLaterToday: 2,
        accuracy: 75,
        hardAnswers: 12,
        streak: 1,
        studiedToday: true,
        masteredToday: 2,
      }),
    );
  });

  it('14 · la suma de los cinco estados coincide con el total y con la barra', () => {
    const counts = { new: 3, learning: 5, difficult: 1, provisional: 2, learned: 7 };
    const summary = buildProgressSummary(
      { overview: overview({ counts, totalItems: 18 }), studyDays: [] },
      today,
    );
    const segments = statusSegments(summary.counts);

    expect(summary.total).toBe(18);
    expect(totalOf(summary.counts)).toBe(summary.total);
    expect(segments.reduce((sum, segment) => sum + segment.value, 0)).toBe(summary.total);
    expect(segments.map((segment) => segment.key)).toEqual([
      'learned',
      'provisional',
      'learning',
      'difficult',
      'new',
    ]);
    expect(segments.map((segment) => segment.color)).toEqual([
      'var(--color-status-learned)',
      'var(--color-status-provisional)',
      'var(--color-status-learning)',
      'var(--color-status-difficult)',
      'var(--color-status-new)',
    ]);
  });

  it('15 · no inventa porcentajes sin vocabulario ni respuestas', () => {
    const summary = buildProgressSummary({ overview: overview(), studyDays: [] }, today);

    expect(summary.total).toBe(0);
    expect(summary.accuracy).toBeNull();
    expect(summary.learnedPercent).toBe(0);
    expect(summary.provisionalPercent).toBe(0);
  });
});
