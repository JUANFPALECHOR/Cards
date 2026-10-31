import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { ConfirmService } from '../../../../core/feedback/confirm.service';
import { ToastService } from '../../../../core/feedback/toast.service';
import { toAppError } from '../../../../core/supabase/app-error';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { IconButton } from '../../../../shared/ui/atoms/icon-button/icon-button';
import { Skeleton } from '../../../../shared/ui/atoms/skeleton/skeleton';
import { EmptyState } from '../../../../shared/ui/molecules/empty-state/empty-state';
import { pluralize } from '../../../../shared/utils/text';
import { VocabularyPanel } from '../../../vocabulary/components/vocabulary-panel/vocabulary-panel';
import { StudySetFormDialog } from '../../components/study-set-form-dialog/study-set-form-dialog';
import { StudySetsRepository } from '../../data/study-sets.repository';
import { StudySet, StudySetInput } from '../../models/study-set';
import { StudySetsStore } from '../../state/study-sets.store';

type DetailStatus = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  selector: 'app-study-set-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Button,
    Icon,
    IconButton,
    Skeleton,
    EmptyState,
    VocabularyPanel,
    StudySetFormDialog,
  ],
  templateUrl: './study-set-detail-page.html',
  styleUrl: './study-set-detail-page.scss',
})
export class StudySetDetailPage {
  /** Parámetro de ruta :setId. */
  readonly setId = input.required<string>();

  private readonly repository = inject(StudySetsRepository);
  private readonly store = inject(StudySetsStore);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  protected readonly set = signal<StudySet | null>(null);
  protected readonly status = signal<DetailStatus>('loading');
  protected readonly error = signal<string | null>(null);
  protected readonly wordCount = signal(0);
  protected readonly wordLabel = computed(() => pluralize(this.wordCount(), 'palabra', 'palabras'));

  protected readonly editing = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.setId();
      untracked(() => void this.load(id));
    });
  }

  protected retry(): void {
    void this.load(this.setId());
  }

  protected onCountChange(count: number): void {
    this.wordCount.set(count);
    this.store.setWordCount(this.setId(), count);
  }

  protected openEdit(): void {
    this.saveError.set(null);
    this.editing.set(true);
  }

  protected closeEdit(): void {
    this.editing.set(false);
  }

  protected async saveEdit(input: StudySetInput): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const updated = await this.store.update(this.setId(), input);
      this.set.set(updated);
      this.title.setTitle(`${updated.name} · English Learning`);
      this.editing.set(false);
      this.toast.success('Conjunto actualizado.');
    } catch (error) {
      const appError = toAppError(error);
      this.saveError.set(
        appError.kind === 'conflict' ? 'Ya tienes un conjunto con ese nombre.' : appError.message,
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const set = this.set();
    if (!set) return;
    const confirmed = await this.confirm.ask({
      title: `¿Eliminar «${set.name}»?`,
      message: `Se eliminarán también sus ${this.wordLabel()} y todo su historial de estudio. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar conjunto',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await this.store.remove(set.id);
      this.toast.success(`Conjunto «${set.name}» eliminado.`);
      await this.router.navigate(['/sets']);
    } catch (error) {
      this.toast.error(toAppError(error).message);
    }
  }

  private async load(id: string): Promise<void> {
    this.status.set('loading');
    this.error.set(null);
    try {
      const set = await this.repository.get(id);
      this.set.set(set);
      this.wordCount.set(set.wordCount);
      this.title.setTitle(`${set.name} · English Learning`);
      this.status.set('ready');
    } catch (error) {
      const appError = toAppError(error);
      this.status.set(appError.kind === 'not-found' ? 'not-found' : 'error');
      this.error.set(appError.message);
    }
  }
}
