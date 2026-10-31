import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toAppError } from '../../../../core/supabase/app-error';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { Skeleton } from '../../../../shared/ui/atoms/skeleton/skeleton';
import { EmptyState } from '../../../../shared/ui/molecules/empty-state/empty-state';
import { PageHeader } from '../../../../shared/ui/molecules/page-header/page-header';
import { SegmentedBar } from '../../../../shared/ui/molecules/segmented-bar/segmented-bar';
import { StatTile } from '../../../../shared/ui/molecules/stat-tile/stat-tile';
import { formatDueDay } from '../../../../shared/utils/dates';
import { pluralize } from '../../../../shared/utils/text';
import { difficultyReasons } from '../../../spaced-repetition/domain/learning-state';
import { LEARNING_CONFIG } from '../../../spaced-repetition/srs-algorithm';
import { RecentAttempts } from '../../components/recent-attempts/recent-attempts';
import { WeeklyChart } from '../../components/weekly-chart/weekly-chart';
import { ProgressData, ProgressRepository } from '../../data/progress.repository';
import { buildProgressSummary } from '../../domain/progress-stats';
import { statusSegments } from '../../domain/status-segments';

type PageStatus = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-progress-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Button,
    Icon,
    Skeleton,
    EmptyState,
    PageHeader,
    SegmentedBar,
    StatTile,
    RecentAttempts,
    WeeklyChart,
  ],
  templateUrl: './progress-page.html',
  styleUrl: './progress-page.scss',
})
export class ProgressPage {
  private readonly repository = inject(ProgressRepository);
  protected readonly config = inject(LEARNING_CONFIG);

  protected readonly status = signal<PageStatus>('loading');
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<ProgressData | null>(null);
  protected readonly skeletons = [1, 2, 3, 4];

  protected readonly summary = computed(() => {
    const data = this.data();
    return data ? buildProgressSummary(data, new Date()) : null;
  });
  protected readonly segments = computed(() => {
    const summary = this.summary();
    return summary ? statusSegments(summary.counts) : [];
  });

  protected readonly isEmpty = computed(() => {
    const summary = this.summary();
    return !!summary && summary.total === 0 && summary.totalAnswers === 0;
  });

  protected readonly accuracyValue = computed(() => {
    const accuracy = this.summary()?.accuracy;
    return accuracy === null || accuracy === undefined ? '—' : `${accuracy}%`;
  });

  protected readonly accuracyCaption = computed(() => {
    const summary = this.summary();
    if (!summary || summary.totalAnswers === 0) return 'Aún no has respondido ninguna tarjeta';
    const base = `${summary.correctAnswers} de ${pluralize(summary.totalAnswers, 'respuesta', 'respuestas')}`;
    return summary.hardAnswers > 0 ? `${base} · ${summary.hardAnswers} con dificultad` : base;
  });

  protected readonly streakCaption = computed(() => {
    const summary = this.summary();
    if (!summary || summary.streak === 0) return 'Estudia hoy para empezar una racha';
    const days = summary.streak === 1 ? 'día seguido' : 'días seguidos';
    return summary.studiedToday
      ? `${days} · hoy ya estudiaste`
      : `${days} · estudia hoy para mantenerla`;
  });

  protected readonly dueCaption = computed(() => {
    const summary = this.summary();
    if (!summary) return null;
    if (summary.dueNow > 0) return 'Listas para repasar ahora';
    return summary.nextDueAt
      ? `Próximo repaso: ${formatDueDay(summary.nextDueAt)}`
      : 'Nada programado';
  });

  constructor() {
    void this.load();
  }

  protected reload(): void {
    void this.load();
  }

  protected words(count: number): string {
    return pluralize(count, 'palabra', 'palabras');
  }

  protected reasonOf(word: ProgressData['attention'][number]): string {
    return difficultyReasons(word.state)[0] ?? 'Ha tenido errores últimamente.';
  }

  protected dueLabel(date: Date): string {
    return formatDueDay(date);
  }

  private async load(): Promise<void> {
    this.status.set('loading');
    this.error.set(null);
    try {
      this.data.set(await this.repository.getProgress());
      this.status.set('ready');
    } catch (error) {
      this.error.set(toAppError(error).message);
      this.status.set('error');
    }
  }
}
