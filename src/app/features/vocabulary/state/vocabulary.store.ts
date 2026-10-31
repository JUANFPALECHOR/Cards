import { Injectable, computed, inject, signal } from '@angular/core';
import { toAppError } from '../../../core/supabase/app-error';
import { VocabularyRepository } from '../data/vocabulary.repository';
import { VocabularyInput, VocabularyItem } from '../models/vocabulary-item';

export type VocabularyStatus = 'loading' | 'ready' | 'error';

/** Vocabulario de un conjunto. Se provee a nivel de componente: vive lo mismo que la pantalla. */
@Injectable()
export class VocabularyStore {
  private readonly repository = inject(VocabularyRepository);

  private readonly list = signal<readonly VocabularyItem[]>([]);
  private readonly loadStatus = signal<VocabularyStatus>('loading');
  private readonly loadError = signal<string | null>(null);
  private setId: string | null = null;
  private request = 0;

  readonly items = this.list.asReadonly();
  readonly status = this.loadStatus.asReadonly();
  readonly error = this.loadError.asReadonly();
  readonly count = computed(() => this.list().length);

  async load(setId: string): Promise<void> {
    this.setId = setId;
    // Si cambia el conjunto antes de que termine una carga, se descarta la respuesta antigua.
    const request = ++this.request;
    this.loadStatus.set('loading');
    this.loadError.set(null);
    try {
      const items = await this.repository.listBySet(setId);
      if (request !== this.request) return;
      this.list.set(items);
      this.loadStatus.set('ready');
    } catch (error) {
      if (request !== this.request) return;
      this.loadError.set(toAppError(error).message);
      this.loadStatus.set('error');
    }
  }

  reload(): Promise<void> {
    return this.setId ? this.load(this.setId) : Promise.resolve();
  }

  async create(input: VocabularyInput): Promise<VocabularyItem> {
    if (!this.setId) throw new Error('VocabularyStore: no hay conjunto cargado.');
    const created = await this.repository.create(this.setId, input);
    this.list.update((items) => [...items, created]);
    return created;
  }

  async update(id: string, input: VocabularyInput): Promise<VocabularyItem> {
    const updated = await this.repository.update(id, input);
    this.list.update((items) => items.map((item) => (item.id === id ? updated : item)));
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.list.update((items) => items.filter((item) => item.id !== id));
  }
}
