import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth/auth.service';
import { AppError } from '../../../core/supabase/app-error';
import { createAuthStub } from '../../../../testing/auth-stub';
import {
  AttemptRecord,
  LearningRepository,
  StateRow,
  stateFromRow,
  stateToRow,
} from '../data/learning.repository';
import { DEFAULT_LEARNING_CONFIG } from '../domain/learning-config';
import { LearningState, applyAttempt } from '../domain/learning-state';
import { AttemptRequest, LearningRecorder } from './learning-recorder';

const REQUEST: AttemptRequest = {
  itemId: 'item-1',
  grade: 'good',
  kind: 'self_assessment',
  direction: 'en_es',
  source: 'flashcard',
  mode: 'practice',
};

/** Repositorio en memoria que imita record_learning_attempt (idempotencia y versiones). */
function createFakeRepository() {
  const states = new Map<string, LearningState>();
  const attemptIds = new Set<string>();
  const calls: AttemptRecord[] = [];
  const repository = {
    calls,
    states,
    getState: vi.fn(async (itemId: string) => states.get(itemId) ?? null),
    recordAttempt: vi.fn(async (record: AttemptRecord) => {
      calls.push(record);
      if (attemptIds.has(record.attemptId)) return 'duplicate' as const;
      if ((states.get(record.itemId)?.version ?? 0) !== record.expectedVersion) {
        return 'conflict' as const;
      }
      attemptIds.add(record.attemptId);
      // Simula el viaje por la base de datos: serializar, incrementar la versión y volver a leer.
      const row = { ...(stateToRow(record.state) as object), version: record.expectedVersion + 1 };
      states.set(record.itemId, stateFromRow(row as StateRow));
      return 'recorded' as const;
    }),
  };
  return repository;
}

describe('LearningRecorder', () => {
  let repository: ReturnType<typeof createFakeRepository>;
  let auth: ReturnType<typeof createAuthStub>;
  let recorder: LearningRecorder;

  beforeEach(() => {
    repository = createFakeRepository();
    auth = createAuthStub();
    TestBed.configureTestingModule({
      providers: [
        { provide: LearningRepository, useValue: repository },
        { provide: AuthService, useValue: auth },
      ],
    });
    recorder = TestBed.inject(LearningRecorder);
    TestBed.tick();
  });

  it('guarda el intento con el estado calculado y la versión esperada', async () => {
    const outcome = await recorder.record(REQUEST);

    expect(outcome.previousStatus).toBe('new');
    expect(outcome.state.attempts).toBe(1);
    expect(repository.calls).toHaveLength(1);
    expect(repository.calls[0]).toEqual(
      expect.objectContaining({
        itemId: 'item-1',
        grade: 'good',
        kind: 'self_assessment',
        expectedVersion: 0,
      }),
    );
  });

  it('8 · varias respuestas seguidas se encadenan sin duplicarse ni perderse', async () => {
    await Promise.all([
      recorder.record(REQUEST),
      recorder.record(REQUEST),
      recorder.record(REQUEST),
    ]);

    expect(repository.states.get('item-1')?.attempts).toBe(3);
    expect(repository.calls.map((call) => call.expectedVersion)).toEqual([0, 1, 2]);
    expect(new Set(repository.calls.map((call) => call.attemptId)).size).toBe(3);
  });

  it('8 · si se corta la red reenvía el MISMO intento y el servidor no lo duplica', async () => {
    const real = repository.recordAttempt.getMockImplementation()!;
    repository.recordAttempt.mockImplementationOnce(async (record) => {
      await real(record); // el servidor lo guardó…
      throw new TypeError('Failed to fetch'); // …pero la respuesta no llegó
    });

    const outcome = await recorder.record(REQUEST);

    expect(repository.calls).toHaveLength(2);
    expect(repository.calls[0].attemptId).toBe(repository.calls[1].attemptId);
    expect(repository.states.get('item-1')?.attempts).toBe(1);
    expect(outcome.state.attempts).toBe(1);
  });

  it('si otra pestaña actualizó la palabra, relee el estado y recalcula', async () => {
    const otherTab = applyAttempt(
      null,
      { grade: 'again', kind: 'written', direction: 'es_en', at: new Date() },
      DEFAULT_LEARNING_CONFIG,
    ).state;
    recorder.remember('item-1', null);
    repository.states.set('item-1', { ...otherTab, version: 1 });

    const outcome = await recorder.record(REQUEST);

    expect(repository.calls.map((call) => call.expectedVersion)).toEqual([0, 1]);
    expect(outcome.state.attempts).toBe(2);
    expect(outcome.state.failures).toBe(1);
  });

  it('12 · tras recargar, continúa desde el estado guardado en la base de datos', async () => {
    await recorder.record(REQUEST);
    const saved = repository.states.get('item-1')!;

    // Recarga: un servicio nuevo sin nada en memoria.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: LearningRepository, useValue: repository },
        { provide: AuthService, useValue: createAuthStub() },
      ],
    });
    const fresh = TestBed.inject(LearningRecorder);
    const outcome = await fresh.record({ ...REQUEST, grade: 'again' });

    expect(repository.getState).toHaveBeenCalledWith('item-1');
    expect(outcome.state.attempts).toBe(saved.attempts + 1);
    expect(outcome.state.version).toBe(saved.version + 1);
  });

  it('16 · propaga los errores de Supabase con un mensaje comprensible', async () => {
    repository.recordAttempt.mockRejectedValueOnce({ code: '42501', message: 'permission denied' });

    await expect(recorder.record(REQUEST)).rejects.toBeInstanceOf(AppError);
    // Un error no bloquea las respuestas siguientes de la misma palabra.
    await expect(recorder.record(REQUEST)).resolves.toBeDefined();
  });

  it('17 · olvida los estados en memoria al cambiar de usuario', async () => {
    recorder.remember('item-1', null);
    auth.userId.set('user-2');
    TestBed.tick();
    repository.getState.mockClear();

    await recorder.record(REQUEST);

    expect(repository.getState).toHaveBeenCalledWith('item-1');
  });

  it('remember no reemplaza un estado más reciente', async () => {
    await recorder.record(REQUEST);
    recorder.remember('item-1', null);
    repository.getState.mockClear();

    const outcome = await recorder.record(REQUEST);

    expect(repository.getState).not.toHaveBeenCalled();
    expect(outcome.state.attempts).toBe(2);
  });
});

describe('estado ↔ fila', () => {
  it('12 · el estado sobrevive al viaje de ida y vuelta por la base de datos', () => {
    const state = applyAttempt(
      null,
      { grade: 'hard', kind: 'written', direction: 'es_en', at: new Date(2026, 10, 2, 9) },
      DEFAULT_LEARNING_CONFIG,
    ).state;
    const row = { ...(stateToRow(state) as object), version: state.version } as StateRow;

    expect(stateFromRow(row)).toEqual(state);
  });
});
