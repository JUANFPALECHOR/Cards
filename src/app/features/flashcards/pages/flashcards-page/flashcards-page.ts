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
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../../core/feedback/toast.service';
import { StudyDirection } from '../../../../core/models/study-direction';
import { toAppError } from '../../../../core/supabase/app-error';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { Skeleton } from '../../../../shared/ui/atoms/skeleton/skeleton';
import { EmptyState } from '../../../../shared/ui/molecules/empty-state/empty-state';
import { PageHeader } from '../../../../shared/ui/molecules/page-header/page-header';
import { shuffle } from '../../../../shared/utils/random';
import { LearningRecorder } from '../../../spaced-repetition/state/learning-recorder';
import { SessionGains } from '../../../spaced-repetition/state/session-gains';
import { StudySet } from '../../../study-sets/models/study-set';
import { StudyMaterialService } from '../../../vocabulary/data/study-material.service';
import { CardAnswer, FlashcardSession } from '../../components/flashcard-session/flashcard-session';
import { SessionSummary } from '../../components/session-summary/session-summary';
import { StudySetup } from '../../components/study-setup/study-setup';
import { SessionSummary as Summary } from '../../domain/study-session';
import { StudyCard } from '../../models/study-card';

type PageStatus = 'loading' | 'ready' | 'not-found' | 'error';
type Phase = 'setup' | 'session' | 'summary';

/**
 * Flashcards de práctica de un conjunto. Cada respuesta se registra (mode = practice) y actualiza el
 * aprendizaje de la palabra: dominio, dificultad y próximo repaso.
 */
@Component({
  selector: 'app-flashcards-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Button,
    Icon,
    Skeleton,
    EmptyState,
    PageHeader,
    FlashcardSession,
    SessionSummary,
    StudySetup,
  ],
  templateUrl: './flashcards-page.html',
})
export class FlashcardsPage {
  readonly setId = input.required<string>();

  private readonly material = inject(StudyMaterialService);
  private readonly recorder = inject(LearningRecorder);
  private readonly toast = inject(ToastService);
  private readonly title = inject(Title);

  protected readonly status = signal<PageStatus>('loading');
  protected readonly error = signal<string | null>(null);
  protected readonly set = signal<StudySet | null>(null);
  protected readonly cards = signal<readonly StudyCard[]>([]);

  protected readonly phase = signal<Phase>('setup');
  protected readonly direction = signal<StudyDirection>('en_es');
  protected readonly sessionCards = signal<readonly StudyCard[]>([]);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly backLabel = computed(() => this.set()?.name ?? 'Volver al conjunto');
  protected readonly gains = new SessionGains();

  private saveErrorShown = false;

  constructor() {
    effect(() => {
      const id = this.setId();
      untracked(() => void this.load(id));
    });
  }

  protected retry(): void {
    void this.load(this.setId());
  }

  protected start(): void {
    this.sessionCards.set(shuffle(this.cards()));
    this.summary.set(null);
    this.gains.reset();
    this.saveErrorShown = false;
    this.phase.set('session');
  }

  protected backToSetup(): void {
    this.phase.set('setup');
  }

  protected onAnswered({ card, grade }: CardAnswer): void {
    this.recorder
      .record({
        itemId: card.id,
        grade,
        kind: 'self_assessment',
        direction: this.direction(),
        source: 'flashcard',
        mode: 'practice',
      })
      .then((outcome) => this.gains.track(card.id, outcome))
      .catch((error: unknown) => {
        // Un solo aviso por sesión: la práctica continúa aunque falle el guardado.
        if (this.saveErrorShown) return;
        this.saveErrorShown = true;
        this.toast.error(`No se pudo guardar tu progreso. ${toAppError(error).message}`);
      });
  }

  protected onFinished(summary: Summary): void {
    this.summary.set(summary);
    this.phase.set('summary');
  }

  private async load(setId: string): Promise<void> {
    this.status.set('loading');
    this.phase.set('setup');
    try {
      const { set, items } = await this.material.load(setId);
      this.set.set(set);
      items.forEach((item) => this.recorder.remember(item.id, item.learning));
      this.cards.set(
        items.map((item) => ({
          id: item.id,
          term: item.term,
          translation: item.translation,
          example: item.example,
          pronunciation: item.pronunciation,
          setName: set.name,
        })),
      );
      this.title.setTitle(`Flashcards · ${set.name} · English Learning`);
      this.status.set('ready');
    } catch (error) {
      const appError = toAppError(error);
      this.error.set(appError.message);
      this.status.set(appError.kind === 'not-found' ? 'not-found' : 'error');
    }
  }
}
