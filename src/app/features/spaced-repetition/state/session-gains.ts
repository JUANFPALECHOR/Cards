import { computed, signal } from '@angular/core';
import { AttemptOutcome, isMastered } from '../domain/learning-state';

/**
 * Avances de una sesión (palabras que pasaron a dominadas o aprendidas), calculados con los
 * resultados reales que devuelve el registro de cada respuesta.
 */
export class SessionGains {
  private readonly masteredIds = signal<ReadonlySet<string>>(new Set());
  private readonly learnedIds = signal<ReadonlySet<string>>(new Set());

  readonly mastered = computed(() => this.masteredIds().size);
  readonly learned = computed(() => this.learnedIds().size);

  readonly message = computed(() => {
    const mastered = this.mastered();
    const learned = this.learned();
    if (mastered === 0 && learned === 0) return null;
    const parts: string[] = [];
    if (mastered > 0) {
      parts.push(
        mastered === 1 ? '1 palabra pasó a dominada' : `${mastered} palabras pasaron a dominadas`,
      );
    }
    if (learned > 0) {
      parts.push(
        learned === 1 ? '1 palabra quedó aprendida' : `${learned} palabras quedaron aprendidas`,
      );
    }
    return `¡Avance! ${parts.join(' y ')} en esta sesión.`;
  });

  reset(): void {
    this.masteredIds.set(new Set());
    this.learnedIds.set(new Set());
  }

  track(itemId: string, outcome: AttemptOutcome): void {
    const { state, previousStatus } = outcome;
    if (isMastered(state.status) && !isMastered(previousStatus)) {
      this.masteredIds.update((ids) => new Set(ids).add(itemId));
    }
    if (state.status === 'learned' && previousStatus !== 'learned') {
      this.learnedIds.update((ids) => new Set(ids).add(itemId));
    }
  }
}
