import { Injectable, effect, inject, untracked } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { StudyDirection } from '../../../core/models/study-direction';
import { AppError, toAppError } from '../../../core/supabase/app-error';
import {
  AttemptGrade,
  AttemptKind,
  AttemptOutcome,
  LearningState,
  applyAttempt,
} from '../domain/learning-state';
import {
  LearningRepository,
  PracticeMode,
  PracticeSource,
  RecordResult,
} from '../data/learning.repository';
import { LEARNING_CONFIG } from '../srs-algorithm';

export interface AttemptRequest {
  readonly itemId: string;
  readonly grade: AttemptGrade;
  readonly kind: AttemptKind;
  readonly direction: StudyDirection;
  readonly source: PracticeSource;
  readonly mode: PracticeMode;
}

/** Recalcular tras un conflicto (otra pestaña escribió antes) como máximo estas veces. */
const MAX_TRIES = 3;

/**
 * Registra cada respuesta: calcula el nuevo estado con el algoritmo y lo guarda junto con el intento.
 *
 *   · Idempotente: cada intento lleva un id; si la red falla se reenvía una vez con el mismo id y
 *     el servidor no lo duplica.
 *   · Concurrencia: si otra pestaña o dispositivo actualizó la palabra, se relee y se recalcula.
 *   · Los intentos de una misma palabra se procesan en orden.
 */
@Injectable({ providedIn: 'root' })
export class LearningRecorder {
  private readonly repository = inject(LearningRepository);
  private readonly config = inject(LEARNING_CONFIG);
  private readonly auth = inject(AuthService);

  /** Último estado conocido por palabra (null = nueva). */
  private readonly known = new Map<string, LearningState | null>();
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor() {
    let previous: string | null | undefined;
    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (previous !== undefined && previous !== userId) this.known.clear();
        previous = userId;
      });
    });
  }

  /** Estados leídos al cargar material de estudio. No reemplaza uno más reciente ya conocido. */
  remember(itemId: string, state: LearningState | null): void {
    const current = this.known.get(itemId);
    if (current && (!state || current.version > state.version)) return;
    this.known.set(itemId, state);
  }

  record(request: AttemptRequest): Promise<AttemptOutcome> {
    const before = this.queues.get(request.itemId) ?? Promise.resolve();
    const task = before.then(
      () => this.persist(request),
      () => this.persist(request),
    );
    this.queues.set(request.itemId, task);
    const release = () => {
      if (this.queues.get(request.itemId) === task) this.queues.delete(request.itemId);
    };
    task.then(release, release);
    return task;
  }

  private async persist(request: AttemptRequest): Promise<AttemptOutcome> {
    const attemptId = crypto.randomUUID();
    const at = new Date();
    let previous = this.known.has(request.itemId)
      ? (this.known.get(request.itemId) ?? null)
      : await this.repository.getState(request.itemId);

    for (let tries = 0; tries < MAX_TRIES; tries++) {
      const outcome = applyAttempt(
        previous,
        { grade: request.grade, kind: request.kind, direction: request.direction, at },
        this.config,
      );
      const result = await this.send(request, attemptId, previous, outcome.state);
      if (result === 'recorded') {
        this.known.set(request.itemId, outcome.state);
        return outcome;
      }

      previous = await this.repository.getState(request.itemId);
      this.known.set(request.itemId, previous);
      // Un reenvío que el servidor ya había guardado: el estado releído ya incluye este intento.
      if (result === 'duplicate' && previous) return { ...outcome, state: previous };
    }
    throw new AppError(
      'conflict',
      'Tu respuesta no se guardó porque la palabra cambió en otra pestaña. Inténtalo de nuevo.',
    );
  }

  private async send(
    request: AttemptRequest,
    attemptId: string,
    previous: LearningState | null,
    state: LearningState,
  ): Promise<RecordResult> {
    const record = { ...request, attemptId, expectedVersion: previous?.version ?? 0, state };
    try {
      return await this.repository.recordAttempt(record);
    } catch (error) {
      const appError = toAppError(error);
      // Si se cortó la conexión, puede que el servidor sí lo guardara: reenviar con el mismo id es seguro.
      if (appError.kind !== 'network') throw appError;
      return this.repository.recordAttempt(record).catch((retryError: unknown) => {
        throw toAppError(retryError);
      });
    }
  }
}
