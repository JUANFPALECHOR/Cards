import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Skeleton } from '../../../../shared/ui/atoms/skeleton/skeleton';
import { Modal } from '../../../../shared/ui/organisms/modal/modal';
import { WordEntry } from '../../data/learning.repository';
import { LEARNING_STATUS_SHORT_LABELS, isDue, isMastered } from '../../domain/learning-state';
import { ReviewMode } from '../../domain/review-queue';
import { wordProgress } from '../../domain/word-progress';
import { LEARNING_CONFIG } from '../../srs-algorithm';
import { WordGroup } from '../review-stats/review-stats';

const COPY: Record<
  WordGroup,
  { title: string; description: string; empty: string; action: string; mode: ReviewMode }
> = {
  due: {
    title: 'Pendientes',
    description: 'Palabras que toca repasar ahora, las más difíciles primero.',
    empty: 'No tienes palabras pendientes ahora mismo.',
    action: 'Empezar repaso',
    mode: 'smart',
  },
  difficult: {
    title: 'Difíciles',
    description: 'Las palabras que más te cuestan últimamente.',
    empty: 'No tienes palabras difíciles. ¡Bien hecho!',
    action: 'Practicarlas',
    mode: 'difficult',
  },
  mastered: {
    title: 'Dominadas',
    description: 'Aprendidas y dominadas provisionalmente (falta comprobarlas otro día).',
    empty: 'Aún no dominas ninguna palabra. Acierta varias veces a lo largo del día.',
    action: 'Repasar aprendidas',
    mode: 'learned',
  },
};

/** Lista de las palabras de una tarjeta de Repasar, con su estado y avance. */
@Component({
  selector: 'app-word-group-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Skeleton, Modal],
  styleUrl: './word-group-sheet.scss',
  template: `
    <app-modal
      size="md"
      [open]="group() !== null"
      [title]="copy().title + (rows() ? ' · ' + rows()!.length : '')"
      [description]="copy().description"
      (closeRequested)="closed.emit()"
    >
      @if (rows(); as list) {
        @if (list.length === 0) {
          <p class="empty">{{ copy().empty }}</p>
        } @else {
          <ul class="words">
            @for (row of list; track row.itemId) {
              <li [attr.data-status]="row.status">
                <span class="text">
                  <span class="term" lang="en">{{ row.term }}</span>
                  <span class="translation" lang="es">{{ row.translation }}</span>
                </span>
                <span class="meta">
                  <span class="dot"></span>{{ labels[row.status] }} · {{ row.percent }}%
                </span>
              </li>
            }
          </ul>
        }
      } @else {
        <div aria-busy="true" aria-label="Cargando palabras">
          <app-skeleton height="12rem" radius="var(--radius-lg)" />
        </div>
      }
      <div class="actions">
        @if (canPractice()) {
          <button appButton type="button" (click)="practice.emit(copy().mode)">
            {{ copy().action }}
          </button>
        }
        <a appButton variant="secondary" routerLink="/progress/words">Avance por palabra</a>
      </div>
    </app-modal>
  `,
})
export class WordGroupSheet {
  private readonly config = inject(LEARNING_CONFIG);

  readonly group = input<WordGroup | null>(null);
  /** null mientras carga. */
  readonly words = input<readonly WordEntry[] | null>(null);
  readonly closed = output<void>();
  readonly practice = output<ReviewMode>();

  protected readonly labels = LEARNING_STATUS_SHORT_LABELS;
  /** Último grupo abierto: mantiene el contenido mientras se anima el cierre. */
  private readonly shown = linkedSignal<WordGroup | null, WordGroup>({
    source: this.group,
    computation: (group, previous) => group ?? previous?.value ?? 'due',
  });
  protected readonly copy = computed(() => COPY[this.shown()]);

  protected readonly rows = computed(() => {
    const words = this.words();
    const group = this.shown();
    if (!words) return null;
    const now = new Date();
    return words
      .filter(({ state }) => {
        if (!state) return false;
        if (group === 'due') return isDue(state, now);
        if (group === 'difficult') return state.status === 'difficult';
        return isMastered(state.status);
      })
      .map((word) => ({
        ...word,
        status: word.state!.status,
        difficulty: word.state!.difficulty,
        percent: wordProgress(word.state, this.config).percent,
      }))
      .sort((a, b) => (group === 'mastered' ? b.percent - a.percent : b.difficulty - a.difficulty));
  });

  protected readonly canPractice = computed(() => {
    const rows = this.rows();
    if (!rows?.length) return false;
    return this.shown() !== 'mastered' || rows.some((row) => row.status === 'learned');
  });
}
