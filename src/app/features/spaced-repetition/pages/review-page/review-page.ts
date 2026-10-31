import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../../core/feedback/toast.service';
import { StudyDirection } from '../../../../core/models/study-direction';
import { toAppError } from '../../../../core/supabase/app-error';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { Skeleton } from '../../../../shared/ui/atoms/skeleton/skeleton';
import { EmptyState } from '../../../../shared/ui/molecules/empty-state/empty-state';
import {
  SegmentOption,
  SegmentedControl,
} from '../../../../shared/ui/molecules/segmented-control/segmented-control';
import { StatTile } from '../../../../shared/ui/molecules/stat-tile/stat-tile';
import { currentTimeZone, formatDueDay } from '../../../../shared/utils/dates';
import { pluralize } from '../../../../shared/utils/text';
import {
  CardAnswer,
  FlashcardSession,
} from '../../../flashcards/components/flashcard-session/flashcard-session';
import { SessionSummary } from '../../../flashcards/components/session-summary/session-summary';
import { StudySetup } from '../../../flashcards/components/study-setup/study-setup';
import { SessionSummary as Summary } from '../../../flashcards/domain/study-session';
import { StudyCard } from '../../../flashcards/models/study-card';
import { ReviewCompanion } from '../../components/review-companion/review-companion';
import { LearningOverview, LearningRepository, QueueEntry } from '../../data/learning.repository';
import {
  MAX_DIFFICULT_CARDS,
  MAX_REVIEW_CARDS,
  NEW_ITEMS_PER_REVIEW,
} from '../../domain/learning-config';
import {
  ReviewMode,
  buildDifficultQueue,
  buildLearnedQueue,
  buildSmartQueue,
} from '../../domain/review-queue';
import { LearningRecorder } from '../../state/learning-recorder';
import { SessionGains } from '../../state/session-gains';

type PageStatus = 'loading' | 'ready' | 'error';
type Phase = 'setup' | 'session' | 'summary';

const MODES: readonly ReviewMode[] = ['smart', 'difficult', 'learned'];

/**
 * Repasar, con tres modos:
 *   · Repaso inteligente (recomendado): pendientes por prioridad, difíciles primero, y palabras nuevas.
 *   · Mis dificultades: solo las palabras que más cuestan, se puedan o no repasar todavía.
 *   · Aprendidas: palabras con retención comprobada.
 * Todas las respuestas actualizan el aprendizaje (mode = srs). `?mode=difficult` abre ese modo.
 */
@Component({
  selector: 'app-review-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Button,
    Icon,
    Skeleton,
    EmptyState,
    ReviewCompanion,
    SegmentedControl,
    StatTile,
    FlashcardSession,
    SessionSummary,
    StudySetup,
  ],
  templateUrl: './review-page.html',
  styleUrl: './review-page.scss',
})
export class ReviewPage {
  /** Parámetro de consulta ?mode= (smart | difficult | learned). */
  readonly mode = input<string | undefined>(undefined);

  private readonly learning = inject(LearningRepository);
  private readonly recorder = inject(LearningRecorder);
  private readonly toast = inject(ToastService);

  protected readonly status = signal<PageStatus>('loading');
  protected readonly error = signal<string | null>(null);
  protected readonly overview = signal<LearningOverview | null>(null);
  protected readonly candidates = signal<readonly QueueEntry[]>([]);
  protected readonly selectedMode = linkedSignal<ReviewMode>(() => parseMode(this.mode()));
  /** Modo de los candidatos cargados (evita mostrar una cola de otro modo mientras carga). */
  private readonly loadedMode = signal<ReviewMode | null>(null);

  protected readonly phase = signal<Phase>('setup');
  protected readonly direction = signal<StudyDirection>('en_es');
  protected readonly cards = signal<readonly StudyCard[]>([]);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly gains = new SessionGains();

  protected readonly queue = computed(() => {
    const candidates = this.candidates();
    switch (this.loadedMode()) {
      case 'smart':
        return buildSmartQueue(candidates, new Date(), {
          maxCards: MAX_REVIEW_CARDS,
          newLimit: NEW_ITEMS_PER_REVIEW,
        });
      case 'difficult':
        return buildDifficultQueue(candidates, MAX_DIFFICULT_CARDS);
      case 'learned':
        return buildLearnedQueue(candidates, MAX_REVIEW_CARDS);
      default:
        return [];
    }
  });
  protected readonly queueLoading = computed(() => this.loadedMode() !== this.selectedMode());
  protected readonly newInQueue = computed(
    () => this.queue().filter((entry) => entry.state === null).length,
  );

  protected readonly modeNote = computed(() => {
    switch (this.selectedMode()) {
      case 'smart': {
        const fresh = this.newInQueue();
        const extra = fresh > 0 ? `, intercaladas con ${pluralize(fresh, 'nueva', 'nuevas')}` : '';
        return `Primero las difíciles y las que toca repasar${extra}. Tus respuestas deciden cuándo vuelve cada palabra.`;
      }
      case 'difficult':
        return 'Solo las palabras que más te cuestan. Practicarlas mejora su dominio, pero quedan aprendidas solo cuando las recuerdas en días distintos.';
      case 'learned':
        return 'Palabras con retención comprobada. Acertarlas mantiene o amplía su intervalo; si fallas una, vuelve a aprendizaje.';
    }
  });

  protected readonly totalItems = computed(() => {
    const counts = this.overview()?.counts;
    return counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : 0;
  });
  protected readonly masteredCount = computed(() => {
    const counts = this.overview()?.counts;
    return counts ? counts.provisional + counts.learned : 0;
  });
  protected readonly nextDueLabel = computed(() => {
    const overview = this.overview();
    if (!overview) return null;
    if (overview.dueNow > 0) return 'Ahora';
    return overview.nextDueAt ? capitalize(formatDueDay(overview.nextDueAt)) : 'Sin programar';
  });

  protected readonly modeOptions = computed((): SegmentOption<ReviewMode>[] => {
    const overview = this.overview();
    const counts = overview?.counts;
    return [
      {
        value: 'smart',
        label: 'Repaso inteligente',
        icon: 'brain',
        description: `Recomendado · ${pluralize(overview?.dueNow ?? 0, 'pendiente', 'pendientes')}`,
      },
      {
        value: 'difficult',
        label: 'Mis dificultades',
        icon: 'target',
        description: pluralize(counts?.difficult ?? 0, 'palabra difícil', 'palabras difíciles'),
      },
      {
        value: 'learned',
        label: 'Aprendidas',
        icon: 'check-circle',
        tone: 'success',
        description: pluralize(counts?.learned ?? 0, 'palabra', 'palabras'),
      },
    ];
  });

  private saveErrorShown = false;
  private request = 0;

  constructor() {
    // El modo puede llegar por la URL después de crear el componente: se carga cuando ya se conoce.
    let firstLoad = true;
    effect(() => {
      const mode = this.selectedMode();
      untracked(() => {
        if (firstLoad) {
          firstLoad = false;
          void this.load();
        } else if (mode !== this.loadedMode()) {
          void this.loadQueue(mode);
        }
      });
    });
  }

  protected reload(): void {
    void this.load();
  }

  protected selectMode(mode: ReviewMode): void {
    this.selectedMode.set(mode);
  }

  protected start(): void {
    this.cards.set(
      this.queue().map((entry) => ({
        id: entry.itemId,
        term: entry.term,
        translation: entry.translation,
        example: entry.example,
        pronunciation: entry.pronunciation,
        setName: entry.setName,
      })),
    );
    this.summary.set(null);
    this.gains.reset();
    this.saveErrorShown = false;
    this.phase.set('session');
  }

  protected onAnswered({ card, grade }: CardAnswer): void {
    this.recorder
      .record({
        itemId: card.id,
        grade,
        kind: 'self_assessment',
        direction: this.direction(),
        source: 'flashcard',
        mode: 'srs',
      })
      .then((outcome) => this.gains.track(card.id, outcome))
      .catch((error: unknown) => {
        if (this.saveErrorShown) return;
        this.saveErrorShown = true;
        this.toast.error(`No se pudo guardar tu repaso. ${toAppError(error).message}`);
      });
  }

  protected onFinished(summary: Summary): void {
    this.summary.set(summary);
    this.phase.set('summary');
  }

  private async load(): Promise<void> {
    this.status.set('loading');
    this.phase.set('setup');
    this.error.set(null);
    try {
      const [overview] = await Promise.all([
        this.learning.getOverview(currentTimeZone()),
        this.loadQueue(this.selectedMode(), true),
      ]);
      this.overview.set(overview);
      this.status.set('ready');
    } catch (error) {
      this.error.set(toAppError(error).message);
      this.status.set('error');
    }
  }

  /** Carga los candidatos del modo; con `rethrow` el error lo gestiona la carga completa. */
  private async loadQueue(mode: ReviewMode, rethrow = false): Promise<void> {
    const request = ++this.request;
    this.phase.set('setup');
    try {
      const candidates = await this.learning.getQueue(mode, NEW_ITEMS_PER_REVIEW);
      if (request !== this.request) return;
      candidates.forEach((entry) => this.recorder.remember(entry.itemId, entry.state));
      this.candidates.set(candidates);
      this.loadedMode.set(mode);
    } catch (error) {
      if (rethrow) throw error;
      if (request !== this.request) return;
      this.toast.error(toAppError(error).message);
      this.selectedMode.set(this.loadedMode() ?? 'smart');
    }
  }
}

function parseMode(value: string | undefined): ReviewMode {
  return MODES.includes(value as ReviewMode) ? (value as ReviewMode) : 'smart';
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('es') + text.slice(1);
}
