import { StudyDirection } from '../../../core/models/study-direction';
import { DEFAULT_LEARNING_CONFIG as config } from './learning-config';
import {
  AttemptGrade,
  AttemptKind,
  AttemptOutcome,
  LearningState,
  applyAttempt,
  describeStatus,
  difficultyReasons,
} from './learning-state';

type Step = [Date, AttemptGrade, AttemptKind?, StudyDirection?];

/** 2 nov 2026 (lunes) + `day` días, a la hora local indicada. */
function at(day: number, hour: number, minute = 0): Date {
  return new Date(2026, 10, 2 + day, hour, minute);
}

function run(steps: readonly Step[], start: LearningState | null = null) {
  let state = start;
  const outcomes: AttemptOutcome[] = [];
  for (const [date, grade, kind = 'self_assessment', direction = 'en_es'] of steps) {
    const outcome = applyAttempt(state, { at: date, grade, kind, direction }, config);
    outcomes.push(outcome);
    state = outcome.state;
  }
  return { state: state!, outcomes, statuses: outcomes.map((outcome) => outcome.state.status) };
}

/** El ejemplo del enunciado: un fallo por la mañana y cuatro aciertos repartidos en el día. */
const SAME_DAY: Step[] = [
  [at(0, 9), 'again'],
  [at(0, 9, 15), 'good'],
  [at(0, 10, 30), 'good'],
  [at(0, 14), 'good'],
  [at(0, 19), 'good'],
];

describe('aprendizaje adaptativo', () => {
  it('1 · reconoce el dominio durante el mismo día (dominada provisionalmente)', () => {
    const { state, statuses } = run(SAME_DAY);

    expect(statuses).toEqual(['learning', 'learning', 'learning', 'learning', 'provisional']);
    expect(state.mastery).toBeGreaterThanOrEqual(config.provisional.minMastery);
    expect(state.provisionalAt).toEqual(at(0, 19));
    // La retención se comprueba otro día: el próximo repaso es mañana desde la medianoche.
    expect(state.dueAt).toEqual(at(1, 0));
    expect(describeStatus(state, config)).toContain('otro día');
  });

  it('2 · repetir de inmediato no infla el dominio ni la racha', () => {
    const { state, outcomes } = run([
      [at(0, 9), 'good'],
      [at(0, 9, 2), 'good'],
      [at(0, 9, 4), 'good'],
      [at(0, 9, 6), 'good'],
    ]);

    expect(outcomes.slice(1).map((outcome) => outcome.evidence)).toEqual([
      'immediate',
      'immediate',
      'immediate',
    ]);
    expect(state.attempts).toBe(4);
    expect(state.successes).toBe(4);
    expect(state.streak).toBe(1);
    expect(state.mastery).toBe(outcomes[0].state.mastery);
    expect(state.dueAt).toEqual(outcomes[0].state.dueAt);
  });

  it('2 · varios aciertos separados pero en menos de 2 horas no bastan para dominarla', () => {
    const quick = run([
      [at(0, 9), 'good'],
      [at(0, 9, 15), 'good'],
      [at(0, 9, 30), 'good'],
      [at(0, 9, 45), 'good'],
      [at(0, 10), 'good'],
    ]);
    expect(quick.state.mastery).toBeGreaterThanOrEqual(config.provisional.minMastery);
    expect(quick.state.status).toBe('learning');

    const later = run([[at(0, 11, 5), 'good']], quick.state);
    expect(later.state.status).toBe('provisional');
  });

  it('3 · fallar después de varios aciertos baja el dominio y la programa enseguida', () => {
    const mastered = run(SAME_DAY).state;
    const { state, outcomes } = run([[at(0, 20), 'again']], mastered);

    expect(outcomes[0].previousStatus).toBe('provisional');
    expect(state.status).toBe('learning');
    expect(state.lapses).toBe(1);
    expect(state.mastery).toBe(Math.round(mastered.mastery / 2));
    expect(state.streak).toBe(0);
    expect(state.dueAt).toEqual(at(0, 20, 10));
  });

  it('un fallo repetido de inmediato no se castiga dos veces', () => {
    const { state, outcomes } = run([
      [at(0, 9), 'again'],
      [at(0, 9, 2), 'again'],
    ]);
    expect(outcomes[1].evidence).toBe('immediate');
    expect(state.failures).toBe(2);
    expect(state.recent).toBe('a');
    expect(state.difficulty).toBe(outcomes[0].state.difficulty);
  });

  it('4 · una palabra difícil deja de serlo cuando mejora y después puede dominarse', () => {
    const struggling = run([
      [at(0, 9), 'again'],
      [at(0, 9, 20), 'again'],
      [at(0, 9, 40), 'again'],
    ]);
    expect(struggling.statuses).toEqual(['learning', 'learning', 'difficult']);
    expect(difficultyReasons(struggling.state)[0]).toBe('Fallaste 3 de tus últimos 3 intentos.');

    const improving = run(
      [
        [at(0, 10), 'good'],
        [at(0, 10, 20), 'good'],
        [at(0, 10, 40), 'good'],
        [at(0, 11), 'good'],
        [at(0, 12), 'good'],
      ],
      struggling.state,
    );
    // Sigue difícil tras un acierto aislado (histéresis) y sale con aciertos consistentes.
    expect(improving.statuses).toEqual([
      'difficult',
      'difficult',
      'learning',
      'learning',
      'provisional',
    ]);
  });

  it('5 · los cuestionarios escritos pesan más que la selección múltiple', () => {
    const steps = (kind: AttemptKind): Step[] => [
      [at(0, 9), 'good', kind],
      [at(0, 10), 'good', kind],
      [at(0, 11, 30), 'good', kind],
    ];
    const written = run(steps('written'));
    const choice = run(steps('multiple_choice'));

    expect(written.state.status).toBe('provisional');
    expect(choice.state.status).toBe('learning');
    expect(choice.state.mastery).toBeLessThan(written.state.mastery);
  });

  it('«Me costó» suma menos dominio y programa un intervalo más corto que «La sabía»', () => {
    const hard = run([[at(0, 9), 'hard']]).state;
    const good = run([[at(0, 9), 'good']]).state;

    expect(hard.successes).toBe(1);
    expect(hard.hardCount).toBe(1);
    expect(hard.mastery).toBeLessThan(good.mastery);
    expect(hard.dueAt.getTime()).toBeLessThan(good.dueAt.getTime());
  });

  it('6 · pasa a aprendida al comprobar la retención en días distintos', () => {
    const provisional = run(SAME_DAY).state;
    const { statuses, state } = run(
      [
        [at(1, 9), 'good'],
        [at(4, 10), 'good'],
      ],
      provisional,
    );

    expect(statuses).toEqual(['provisional', 'learned']);
    expect(state.learnedAt).toEqual(at(4, 10));
    expect(state.retentionPoints).toBeGreaterThanOrEqual(config.learned.minRetentionPoints);
    expect(describeStatus(state, config)).toContain('días distintos');
  });

  it('6 · acertar un día tras otro también demuestra retención', () => {
    const { statuses } = run([
      [at(0, 10), 'good'],
      [at(1, 10), 'good'],
      [at(2, 10), 'good'],
      [at(3, 10), 'good'],
    ]);
    expect(statuses).toEqual(['learning', 'learning', 'learning', 'learned']);
  });

  it('no la marca como aprendida por una cantidad fija de aciertos el mismo día', () => {
    const steps: Step[] = Array.from({ length: 12 }, (_, i) => [at(0, 8 + i), 'good']);
    expect(run(steps).state.status).toBe('provisional');
  });

  it('7 · olvidar una palabra aprendida la devuelve a aprendizaje y obliga a comprobarla de nuevo', () => {
    const learned = run(
      [
        [at(1, 9), 'good'],
        [at(4, 10), 'good'],
      ],
      run(SAME_DAY).state,
    ).state;
    const { state } = run([[at(20, 9), 'again']], learned);

    expect(state.status).toBe('learning');
    expect(state.lapses).toBe(1);
    expect(state.retentionPoints).toBe(0);
    expect(state.learnedAt).toEqual(learned.learnedAt);
    expect(state.dueAt).toEqual(at(20, 9, 10));
  });

  it('los intervalos de las aprendidas crecen pero nunca superan el máximo', () => {
    let state = run([[at(1, 9), 'good']], run(SAME_DAY).state).state;
    let day = 1;
    for (let i = 0; i < 8; i++) {
      day += Math.round(state.intervalMinutes / 1440);
      state = run([[at(day, 9), 'good']], state).state;
    }
    expect(state.status).toBe('learned');
    expect(state.intervalMinutes).toBe(config.schedule.maxIntervalDays * 1440);
    expect(state.dueAt.getTime()).toBeGreaterThan(at(day, 9).getTime());
  });

  it('un repaso adelantado mantiene la programación sin ampliarla', () => {
    const provisional = run(SAME_DAY).state;
    const { state } = run([[at(0, 21), 'good']], provisional);
    expect(state.status).toBe('provisional');
    expect(state.dueAt).toEqual(provisional.dueAt);
    expect(state.retentionPoints).toBe(0);
  });

  it('9 · registra cada dirección por separado y detecta la que más cuesta', () => {
    const { state } = run([
      [at(0, 9), 'good', 'self_assessment', 'en_es'],
      [at(0, 9, 20), 'again', 'self_assessment', 'es_en'],
      [at(0, 9, 40), 'good', 'self_assessment', 'en_es'],
      [at(0, 10), 'again', 'self_assessment', 'es_en'],
      [at(0, 10, 20), 'good', 'self_assessment', 'en_es'],
      [at(0, 10, 40), 'again', 'self_assessment', 'es_en'],
    ]);

    expect(state.directions).toEqual({
      en_es: { attempts: 3, failures: 0 },
      es_en: { attempts: 3, failures: 3 },
    });
    expect(state.status).toBe('difficult');
    expect(difficultyReasons(state)).toContain('Te cuesta más en Español → Inglés.');
  });

  it('prioriza la palabra con más errores recientes, no solo por porcentaje histórico', () => {
    const series = (grades: AttemptGrade[]): Step[] =>
      grades.map((grade, i) => [at(0, 8, 0 + i * 20), grade] as Step);
    const g = 'good' as const;
    const a = 'again' as const;
    const achieve = run(series([a, a, g, a, a, g, a, a, g, a])).state;
    const improve = run(series([g, g, g, a, g, g, g, g, g])).state;
    const purpose = run(series(Array(12).fill(g))).state;

    expect(achieve.status).toBe('difficult');
    expect(improve.status).not.toBe('difficult');
    expect(purpose.status).not.toBe('difficult');
    expect(achieve.difficulty).toBeGreaterThan(improve.difficulty);
    expect(improve.difficulty).toBeGreaterThan(purpose.difficulty);

    // Muchos errores antiguos y una mejora sostenida: ya no es difícil.
    const recovered = run(series([a, a, a, a, a, a, a, g, g, g, g, g, g, g, g])).state;
    expect(recovered.status).not.toBe('difficult');
    expect(recovered.difficulty).toBeLessThan(config.difficult.exitScore);
  });

  it('describe el estado de una palabra nueva', () => {
    expect(describeStatus(null, config)).toBe('Aún no la has practicado.');
  });
});
