import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toAppError } from '../../../../core/supabase/app-error';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { Skeleton } from '../../../../shared/ui/atoms/skeleton/skeleton';
import { EmptyState } from '../../../../shared/ui/molecules/empty-state/empty-state';
import { PageHeader } from '../../../../shared/ui/molecules/page-header/page-header';
import {
  SegmentOption,
  SegmentedControl,
} from '../../../../shared/ui/molecules/segmented-control/segmented-control';
import { formatDueDay } from '../../../../shared/utils/dates';
import { LearningRepository, WordEntry } from '../../../spaced-repetition/data/learning.repository';
import {
  LEARNING_STATUS_SHORT_LABELS,
  difficultyReasons,
} from '../../../spaced-repetition/domain/learning-state';
import { Requirement, wordProgress } from '../../../spaced-repetition/domain/word-progress';
import { LEARNING_CONFIG } from '../../../spaced-repetition/srs-algorithm';

type PageStatus = 'loading' | 'ready' | 'error';
type Filter = 'near' | 'difficult' | 'all';

const timeFormatter = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' });

/**
 * Avance de cada palabra hacia «Aprendida», con los requisitos reales del algoritmo
 * (word-progress.ts): qué cumple, qué le falta y desde cuándo puede completarlo.
 */
@Component({
  selector: 'app-word-progress-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Button, Icon, Skeleton, EmptyState, PageHeader, SegmentedControl],
  templateUrl: './word-progress-page.html',
  styleUrl: './word-progress-page.scss',
})
export class WordProgressPage {
  private readonly learning = inject(LearningRepository);
  protected readonly config = inject(LEARNING_CONFIG);

  protected readonly status = signal<PageStatus>('loading');
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<Filter>('near');
  private readonly words = signal<readonly WordEntry[]>([]);
  private readonly now = signal(new Date());

  private readonly rows = computed(() =>
    this.words().map((entry) => {
      const progress = wordProgress(entry.state, this.config);
      return {
        ...entry,
        progress,
        mastered: progress.requirements.filter((item) => item.stage === 'mastered'),
        learned: progress.requirements.filter((item) => item.stage === 'learned'),
        reason: entry.state && entry.state.failures > 0 ? difficultyReasons(entry.state)[0] : null,
      };
    }),
  );

  /** Practicadas y aún no aprendidas, de más a menos avance. */
  private readonly near = computed(() =>
    this.rows()
      .filter((row) => row.state && row.progress.status !== 'learned')
      .sort((a, b) => b.progress.percent - a.progress.percent),
  );
  /** Con fallos, de más a menos dificultad. */
  private readonly difficult = computed(() =>
    this.rows()
      .filter((row) => row.state && row.state.failures > 0)
      .sort((a, b) => b.state!.difficulty - a.state!.difficulty),
  );
  private readonly all = computed(() =>
    [...this.rows()].sort(
      (a, b) => b.progress.percent - a.progress.percent || a.term.localeCompare(b.term, 'en'),
    ),
  );

  protected readonly visible = computed(() => {
    switch (this.filter()) {
      case 'near':
        return this.near();
      case 'difficult':
        return this.difficult();
      case 'all':
        return this.all();
    }
  });

  protected readonly options = computed((): SegmentOption<Filter>[] => [
    { value: 'near', label: `Cerca · ${this.near().length}` },
    { value: 'difficult', label: `Errores · ${this.difficult().length}` },
    { value: 'all', label: `Todas · ${this.rows().length}` },
  ]);

  protected readonly statusLabels = LEARNING_STATUS_SHORT_LABELS;

  constructor() {
    void this.load();
  }

  protected reload(): void {
    void this.load();
  }

  protected setFilter(filter: Filter): void {
    this.filter.set(filter);
  }

  protected dueLabel(dueAt: Date): string {
    return dueAt.getTime() <= this.now().getTime() ? 'ahora' : moment(dueAt, this.now());
  }

  /** «Cuenta desde hoy a las 14:30» si un acierto antes de esa hora aún no lo completa. */
  protected readyLabel(requirement: Requirement): string | null {
    const readyAt = requirement.readyAt;
    if (!readyAt || readyAt.getTime() <= this.now().getTime()) return null;
    return `Un acierto lo cumple desde ${moment(readyAt, this.now())}`;
  }

  private async load(): Promise<void> {
    this.status.set('loading');
    this.error.set(null);
    try {
      this.words.set(await this.learning.getWords());
      this.now.set(new Date());
      if (this.near().length === 0 && this.difficult().length === 0) this.filter.set('all');
      this.status.set('ready');
    } catch (error) {
      this.error.set(toAppError(error).message);
      this.status.set('error');
    }
  }
}

/** «hoy a las 14:30», «mañana a las 09:00»; a medianoche basta el día. */
function moment(date: Date, now: Date): string {
  const day = formatDueDay(date, now);
  return date.getHours() === 0 && date.getMinutes() === 0
    ? day
    : `${day} a las ${timeFormatter.format(date)}`;
}
