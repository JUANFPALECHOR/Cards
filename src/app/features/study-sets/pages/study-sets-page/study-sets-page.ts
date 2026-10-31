import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../core/feedback/toast.service';
import { toAppError } from '../../../../core/supabase/app-error';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { Skeleton } from '../../../../shared/ui/atoms/skeleton/skeleton';
import { EmptyState } from '../../../../shared/ui/molecules/empty-state/empty-state';
import { SearchField } from '../../../../shared/ui/molecules/search-field/search-field';
import { matchesSearch } from '../../../../shared/utils/text';
import { StudySetCard } from '../../components/study-set-card/study-set-card';
import { StudySetsArtwork } from '../../components/study-sets-artwork/study-sets-artwork';
import { StudySetsBackdrop } from '../../components/study-sets-backdrop/study-sets-backdrop';
import { StudySetFormDialog } from '../../components/study-set-form-dialog/study-set-form-dialog';
import { StudySetInput } from '../../models/study-set';
import { StudySetsStore } from '../../state/study-sets.store';

/** Pantalla inicial: "Mis conjuntos". */
@Component({
  selector: 'app-study-sets-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Button,
    FormsModule,
    Icon,
    Skeleton,
    EmptyState,
    SearchField,
    StudySetCard,
    StudySetsArtwork,
    StudySetsBackdrop,
    StudySetFormDialog,
  ],
  templateUrl: './study-sets-page.html',
  styleUrl: './study-sets-page.scss',
})
export class StudySetsPage {
  private readonly store = inject(StudySetsStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly status = this.store.status;
  protected readonly error = this.store.error;
  protected readonly sets = this.store.sets;
  protected readonly query = signal('');
  protected readonly wordFilter = signal<'all' | 'with-words' | 'empty'>('all');
  protected readonly sort = signal<'recent' | 'oldest' | 'name'>('recent');

  protected readonly filtered = computed(() => {
    const matches = this.sets().filter(
      (set) =>
        matchesSearch(this.query(), set.name, set.description) &&
        (this.wordFilter() === 'all' ||
          (this.wordFilter() === 'with-words' ? set.wordCount > 0 : set.wordCount === 0)),
    );
    return matches.sort((a, b) => {
      if (this.sort() === 'name') return a.name.localeCompare(b.name, 'es');
      const byDate = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      return this.sort() === 'oldest' ? -byDate : byDate;
    });
  });

  protected clearFilters(): void {
    this.query.set('');
    this.wordFilter.set('all');
  }

  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly skeletons = [1, 2, 3];

  constructor() {
    void this.store.load();
  }

  protected reload(): void {
    void this.store.load();
  }

  protected openCreate(): void {
    this.saveError.set(null);
    this.creating.set(true);
  }

  protected closeCreate(): void {
    this.creating.set(false);
  }

  protected async create(input: StudySetInput): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const created = await this.store.create(input);
      this.creating.set(false);
      this.toast.success(`Conjunto «${created.name}» creado. Ahora agrega sus palabras.`);
      await this.router.navigate(['/sets', created.id]);
    } catch (error) {
      const appError = toAppError(error);
      this.saveError.set(
        appError.kind === 'conflict' ? 'Ya tienes un conjunto con ese nombre.' : appError.message,
      );
    } finally {
      this.saving.set(false);
    }
  }
}
