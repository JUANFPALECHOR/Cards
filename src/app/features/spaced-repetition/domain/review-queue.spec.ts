import { DEFAULT_LEARNING_CONFIG as config } from './learning-config';
import { LearningState, TrackedStatus, applyAttempt } from './learning-state';
import {
  buildDifficultQueue,
  buildLearnedQueue,
  buildSmartQueue,
  isStruggling,
} from './review-queue';

const NOW = new Date(2026, 10, 10, 12);

/** Estado real (generado con applyAttempt) con los campos de la cola sustituidos. */
function state(
  status: TrackedStatus,
  overrides: Partial<Pick<LearningState, 'difficulty' | 'failures' | 'dueAt'>> = {},
): LearningState {
  const base = applyAttempt(
    null,
    { at: new Date(2026, 10, 1), grade: 'good', kind: 'written', direction: 'en_es' },
    config,
  ).state;
  return { ...base, status, failures: 0, difficulty: 0, dueAt: NOW, ...overrides };
}

const item = (id: string, value: LearningState | null) => ({ id, state: value });
const ids = (items: readonly { id: string }[]) => items.map((entry) => entry.id);
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);

describe('colas de Repasar', () => {
  it('repaso inteligente: difíciles primero, luego en aprendizaje, por verificar y aprendidas', () => {
    const queue = buildSmartQueue(
      [
        item('aprendida', state('learned', { dueAt: hoursAgo(30) })),
        item('provisional', state('provisional', { dueAt: hoursAgo(1) })),
        item('aprendiendo', state('learning', { dueAt: hoursAgo(2) })),
        item('dificil-baja', state('difficult', { difficulty: 50, dueAt: hoursAgo(1) })),
        item('dificil-alta', state('difficult', { difficulty: 80, dueAt: hoursAgo(1) })),
        item('futura', state('difficult', { difficulty: 90, dueAt: new Date(NOW.getTime() + 1) })),
      ],
      NOW,
      { maxCards: 40, newLimit: 0 },
    );

    expect(ids(queue)).toEqual([
      'dificil-alta',
      'dificil-baja',
      'aprendiendo',
      'provisional',
      'aprendida',
    ]);
  });

  it('intercala palabras nuevas y les reserva espacio aunque haya muchas pendientes', () => {
    const due = Array.from({ length: 50 }, (_, i) => item(`p${i}`, state('learning')));
    const fresh = Array.from({ length: 30 }, (_, i) => item(`n${i}`, null));
    const queue = buildSmartQueue([...due, ...fresh], NOW, { maxCards: 40, newLimit: 20 });

    expect(queue).toHaveLength(40);
    expect(queue.filter((entry) => entry.state === null)).toHaveLength(10);
    expect(ids(queue).slice(0, 4)).toEqual(['p0', 'p1', 'p2', 'n0']);
  });

  it('respeta el límite de palabras nuevas por sesión', () => {
    const fresh = Array.from({ length: 30 }, (_, i) => item(`n${i}`, null));
    expect(buildSmartQueue(fresh, NOW, { maxCards: 40, newLimit: 20 })).toHaveLength(20);
  });

  it('15 · sin vocabulario las tres colas están vacías', () => {
    expect(buildSmartQueue([], NOW, { maxCards: 40, newLimit: 20 })).toEqual([]);
    expect(buildDifficultQueue([], 20)).toEqual([]);
    expect(buildLearnedQueue([], 20)).toEqual([]);
  });

  it('mis dificultades: solo palabras con problemas, las difíciles primero', () => {
    const queue = buildDifficultQueue(
      [
        item('sin-fallos', state('learning')),
        item('nueva', null),
        item('fallo-leve', state('learning', { failures: 1, difficulty: 20 })),
        item('dificil', state('difficult', { failures: 4, difficulty: 60 })),
        item('aprendida', state('learned', { failures: 2 })),
      ],
      20,
    );
    expect(ids(queue)).toEqual(['dificil', 'fallo-leve']);
    expect(isStruggling(null)).toBe(false);
  });

  it('vocabulario aprendido: solo aprendidas, las que antes tocaba repasar primero', () => {
    const queue = buildLearnedQueue(
      [
        item('tarde', state('learned', { dueAt: new Date(2026, 11, 1) })),
        item('provisional', state('provisional')),
        item('pronto', state('learned', { dueAt: new Date(2026, 10, 12) })),
      ],
      20,
    );
    expect(ids(queue)).toEqual(['pronto', 'tarde']);
  });
});
