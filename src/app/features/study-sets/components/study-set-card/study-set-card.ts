import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from '../../../../shared/ui/atoms/badge/badge';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { IconButton } from '../../../../shared/ui/atoms/icon-button/icon-button';
import { SegmentedBar } from '../../../../shared/ui/molecules/segmented-bar/segmented-bar';
import {
  StatusCounts,
  countStatuses,
  statusSegments,
} from '../../../progress/domain/status-segments';
import { VocabularyRepository } from '../../../vocabulary/data/vocabulary.repository';
import { formatDate } from '../../../../shared/utils/dates';
import { pluralize } from '../../../../shared/utils/text';
import { StudySet } from '../../models/study-set';

/** Tarjeta de un conjunto. Toda la tarjeta enlaza al detalle; las acciones de estudio quedan por encima. */
@Component({
  selector: 'app-study-set-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Badge, Button, Icon, IconButton, SegmentedBar],
  styleUrl: './study-set-card.scss',
  template: `
    <article class="card">
      <div class="head">
        <span class="mark"><app-icon name="stack" [size]="26" /></span>
        <app-badge [tone]="set().wordCount ? 'primary' : 'neutral'">{{ wordLabel() }}</app-badge>
      </div>
      <h2 class="title">
        <a class="link" [routerLink]="['/sets', set().id]">{{ set().name }}</a>
      </h2>
      @if (set().description; as description) {
        <p class="description">{{ description }}</p>
      }
      <div class="progress-section" aria-live="polite">
        @if (progress(); as current) {
          <div class="progress-label">
            <span>Progreso</span>
            <span>{{ current.counts.learned }} / {{ current.total }} aprendidas</span>
          </div>
          <app-segmented-bar
            compact
            [segments]="current.segments"
            [label]="'Estado de las ' + current.total + ' palabras de ' + set().name"
          />
        } @else {
          <div class="progress-label">
            <span>Progreso</span>
            <span>{{ progressFailed() ? 'No disponible' : 'Cargando…' }}</span>
          </div>
          @if (progressFailed()) {
            <button class="retry-progress" type="button" (click)="retryProgress()">
              Reintentar progreso
            </button>
          } @else {
            <div class="progress-placeholder" aria-hidden="true"></div>
          }
        }
      </div>
      <div class="meta-row">
        <p class="meta">
          <app-icon name="calendar" [size]="18" /> Actualizado el {{ updatedLabel() }}
        </p>
        <button
          class="manage"
          appIconButton
          [label]="'Gestionar ' + set().name"
          [routerLink]="['/sets', set().id]"
        >
          <app-icon name="more-vertical" [size]="20" />
        </button>
      </div>
      <div class="actions">
        @if (set().wordCount > 0) {
          <a
            appButton
            class="practice-button"
            [routerLink]="['/sets', set().id, 'flashcards']"
            [attr.aria-label]="'Flashcards de ' + set().name"
          >
            <app-icon name="play" [size]="20" /> Flashcards
          </a>
          <a
            appButton
            variant="secondary"
            [routerLink]="['/sets', set().id, 'quiz']"
            [attr.aria-label]="'Cuestionario de ' + set().name"
          >
            <app-icon name="quiz" [size]="20" /> Cuestionario
          </a>
        } @else {
          <p class="hint">Agrega palabras para empezar a estudiar.</p>
        }
      </div>
    </article>
  `,
})
export class StudySetCard {
  readonly set = input.required<StudySet>();
  private readonly vocabulary = inject(VocabularyRepository);
  private readonly progressAttempt = signal(0);
  protected readonly progress = signal<{
    counts: StatusCounts;
    total: number;
    segments: ReturnType<typeof statusSegments>;
  } | null>(null);
  protected readonly progressFailed = signal(false);

  protected readonly wordLabel = computed(() =>
    pluralize(this.set().wordCount, 'palabra', 'palabras'),
  );
  protected readonly updatedLabel = computed(() => formatDate(this.set().updatedAt));

  constructor() {
    effect((onCleanup) => {
      const set = this.set();
      this.progressAttempt();
      let active = true;
      onCleanup(() => {
        active = false;
      });
      this.progress.set(null);
      this.progressFailed.set(false);
      if (set.wordCount === 0) {
        this.progress.set(toProgress(countStatuses([])));
        return;
      }
      // Cada palabra cuenta en un único estado: la barra suma exactamente el total.
      void this.vocabulary.listBySet(set.id).then(
        (items) => {
          if (active) this.progress.set(toProgress(countStatuses(items.map((i) => i.status))));
        },
        () => {
          if (active) this.progressFailed.set(true);
        },
      );
    });
  }

  protected retryProgress(): void {
    this.progressAttempt.update((attempt) => attempt + 1);
  }
}

function toProgress(counts: StatusCounts) {
  return {
    counts,
    total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    segments: statusSegments(counts),
  };
}
