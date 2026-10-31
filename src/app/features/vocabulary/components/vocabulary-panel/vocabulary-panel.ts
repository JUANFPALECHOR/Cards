import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { ConfirmService } from '../../../../core/feedback/confirm.service';
import { ToastService } from '../../../../core/feedback/toast.service';
import { toAppError } from '../../../../core/supabase/app-error';
import { Badge } from '../../../../shared/ui/atoms/badge/badge';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { Skeleton } from '../../../../shared/ui/atoms/skeleton/skeleton';
import { EmptyState } from '../../../../shared/ui/molecules/empty-state/empty-state';
import { SearchField } from '../../../../shared/ui/molecules/search-field/search-field';
import { matchesSearch } from '../../../../shared/utils/text';
import { VocabularyItem } from '../../models/vocabulary-item';
import { VocabularyStore } from '../../state/vocabulary.store';
import {
  VocabularyFormDialog,
  VocabularySaveRequest,
} from '../vocabulary-form-dialog/vocabulary-form-dialog';
import { VocabularyRow } from '../vocabulary-row/vocabulary-row';

/** Gestión del vocabulario de un conjunto: lista, búsqueda, alta, edición y borrado. */
@Component({
  selector: 'app-vocabulary-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Badge,
    Button,
    Icon,
    Skeleton,
    EmptyState,
    SearchField,
    VocabularyFormDialog,
    VocabularyRow,
  ],
  providers: [VocabularyStore],
  templateUrl: './vocabulary-panel.html',
  styleUrl: './vocabulary-panel.scss',
})
export class VocabularyPanel {
  readonly setId = input.required<string>();
  /** Número de palabras tras cada cambio (para mantener contadores sincronizados). */
  readonly countChange = output<number>();

  private readonly store = inject(VocabularyStore);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly status = this.store.status;
  protected readonly error = this.store.error;
  protected readonly items = this.store.items;
  protected readonly count = this.store.count;
  protected readonly query = signal('');
  protected readonly filtered = computed(() =>
    this.items().filter((item) =>
      matchesSearch(this.query(), item.term, item.translation, item.example, item.notes),
    ),
  );

  protected readonly dialogOpen = signal(false);
  protected readonly editing = signal<VocabularyItem | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly resetToken = signal(0);
  protected readonly skeletons = [1, 2, 3];

  constructor() {
    effect(() => {
      const setId = this.setId();
      untracked(() => void this.store.load(setId));
    });
  }

  protected reload(): void {
    void this.store.reload();
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.saveError.set(null);
    this.dialogOpen.set(true);
  }

  protected openEdit(item: VocabularyItem): void {
    this.editing.set(item);
    this.saveError.set(null);
    this.dialogOpen.set(true);
  }

  protected closeDialog(): void {
    this.dialogOpen.set(false);
  }

  protected async save({ input, addAnother }: VocabularySaveRequest): Promise<void> {
    const editing = this.editing();
    this.saving.set(true);
    this.saveError.set(null);
    try {
      if (editing) {
        await this.store.update(editing.id, input);
        this.dialogOpen.set(false);
        this.toast.success('Palabra actualizada.');
      } else {
        await this.store.create(input);
        this.countChange.emit(this.count());
        if (addAnother) {
          this.resetToken.update((token) => token + 1);
          this.toast.success(`«${input.term}» agregada. Puedes escribir la siguiente.`);
        } else {
          this.dialogOpen.set(false);
          this.toast.success(`«${input.term}» agregada.`);
        }
      }
    } catch (error) {
      this.saveError.set(toAppError(error).message);
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(item: VocabularyItem): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: `¿Eliminar «${item.term}»?`,
      message: 'También se eliminará su historial de estudio. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await this.store.remove(item.id);
      this.countChange.emit(this.count());
      this.toast.success(`«${item.term}» eliminada.`);
    } catch (error) {
      this.toast.error(toAppError(error).message);
    }
  }
}
