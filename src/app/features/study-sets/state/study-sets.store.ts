import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { toAppError } from '../../../core/supabase/app-error';
import { StudySetsRepository } from '../data/study-sets.repository';
import { StudySet, StudySetInput } from '../models/study-set';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Estado compartido de "Mis conjuntos". Muestra los datos en caché al volver a la pantalla
 * mientras los refresca en segundo plano, y evita peticiones duplicadas simultáneas.
 */
@Injectable({ providedIn: 'root' })
export class StudySetsStore {
  private readonly repository = inject(StudySetsRepository);
  private readonly auth = inject(AuthService);

  private readonly items = signal<readonly StudySet[]>([]);
  private readonly loadStatus = signal<LoadStatus>('idle');
  private readonly loadError = signal<string | null>(null);
  private inFlight: Promise<void> | null = null;

  readonly sets = this.items.asReadonly();
  readonly status = this.loadStatus.asReadonly();
  readonly error = this.loadError.asReadonly();
  readonly hasData = computed(() => this.loadStatus() === 'ready');

  constructor() {
    // Al cambiar de usuario (o cerrar sesión) no puede quedar nada de la cuenta anterior en memoria.
    let previous: string | null | undefined;
    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (previous !== undefined && previous !== userId) this.reset();
        previous = userId;
      });
    });
  }

  load(): Promise<void> {
    this.inFlight ??= this.fetch().finally(() => (this.inFlight = null));
    return this.inFlight;
  }

  async create(input: StudySetInput): Promise<StudySet> {
    const created = await this.repository.create(input);
    this.items.update((sets) => [created, ...sets]);
    return created;
  }

  async update(id: string, input: StudySetInput): Promise<StudySet> {
    const updated = await this.repository.update(id, input);
    this.items.update((sets) => sortByUpdated(sets.map((set) => (set.id === id ? updated : set))));
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.items.update((sets) => sets.filter((set) => set.id !== id));
  }

  /** Mantiene el contador de palabras al día cuando se edita el vocabulario desde el detalle. */
  setWordCount(id: string, wordCount: number): void {
    this.items.update((sets) => sets.map((set) => (set.id === id ? { ...set, wordCount } : set)));
  }

  private reset(): void {
    this.items.set([]);
    this.loadStatus.set('idle');
    this.loadError.set(null);
    this.inFlight = null;
  }

  private async fetch(): Promise<void> {
    const hadData = this.loadStatus() === 'ready';
    if (!hadData) this.loadStatus.set('loading');
    this.loadError.set(null);
    try {
      this.items.set(await this.repository.list());
      this.loadStatus.set('ready');
    } catch (error) {
      this.loadError.set(toAppError(error).message);
      // Si ya había datos se conservan; la página informa del fallo sin vaciar la lista.
      if (!hadData) this.loadStatus.set('error');
    }
  }
}

function sortByUpdated(sets: readonly StudySet[]): StudySet[] {
  return [...sets].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
