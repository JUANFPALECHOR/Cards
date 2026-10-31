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
import { toAppError } from '../../../../core/supabase/app-error';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { Skeleton } from '../../../../shared/ui/atoms/skeleton/skeleton';
import { EmptyState } from '../../../../shared/ui/molecules/empty-state/empty-state';
import { PageHeader } from '../../../../shared/ui/molecules/page-header/page-header';
import { AttemptGrade, AttemptKind } from '../../../spaced-repetition/domain/learning-state';
import { LearningRecorder } from '../../../spaced-repetition/state/learning-recorder';
import { SessionGains } from '../../../spaced-repetition/state/session-gains';
import { StudySet } from '../../../study-sets/models/study-set';
import { StudyMaterialService } from '../../../vocabulary/data/study-material.service';
import { QuizResults } from '../../components/quiz-results/quiz-results';
import { QuizSession } from '../../components/quiz-session/quiz-session';
import { QuizSetup } from '../../components/quiz-setup/quiz-setup';
import { buildQuiz, summarizeQuiz } from '../../domain/quiz-generator';
import { QuizAnswer, QuizConfig, QuizItem, QuizQuestion } from '../../models/quiz';

type PageStatus = 'loading' | 'ready' | 'not-found' | 'error';
type Phase = 'setup' | 'session' | 'results';

/**
 * Cuestionario de un conjunto. Cada respuesta se registra (mode = practice) y actualiza el
 * aprendizaje de la palabra. Reconocer entre opciones pesa menos que escribir la traducción.
 */
@Component({
  selector: 'app-quiz-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    Button,
    Icon,
    Skeleton,
    EmptyState,
    PageHeader,
    QuizResults,
    QuizSession,
    QuizSetup,
  ],
  templateUrl: './quiz-page.html',
  styles: `
    .notices {
      display: grid;
      gap: var(--space-2);
      max-width: 40rem;
      margin: 0 auto var(--space-4);
    }
  `,
})
export class QuizPage {
  readonly setId = input.required<string>();

  private readonly material = inject(StudyMaterialService);
  private readonly recorder = inject(LearningRecorder);
  private readonly toast = inject(ToastService);
  private readonly title = inject(Title);

  protected readonly status = signal<PageStatus>('loading');
  protected readonly error = signal<string | null>(null);
  protected readonly set = signal<StudySet | null>(null);
  protected readonly items = signal<readonly QuizItem[]>([]);

  protected readonly phase = signal<Phase>('setup');
  protected readonly config = signal<QuizConfig | null>(null);
  protected readonly questions = signal<readonly QuizQuestion[]>([]);
  protected readonly notices = signal<readonly string[]>([]);
  protected readonly answers = signal<readonly QuizAnswer[]>([]);
  protected readonly result = computed(() => summarizeQuiz(this.answers()));
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

  protected start(config: QuizConfig): void {
    const quiz = buildQuiz(this.items(), config);
    this.config.set(config);
    this.questions.set(quiz.questions);
    this.notices.set(quiz.notices);
    this.answers.set([]);
    this.gains.reset();
    this.saveErrorShown = false;
    this.phase.set('session');
  }

  protected repeat(): void {
    const config = this.config();
    if (config) this.start(config);
  }

  protected backToSetup(): void {
    this.phase.set('setup');
  }

  protected onAnswered(answer: QuizAnswer): void {
    const itemId = answer.question.itemId;
    this.recorder
      .record({
        itemId,
        grade: quizGrade(answer),
        kind: quizKind(answer),
        direction: answer.question.direction,
        source: 'quiz',
        mode: 'practice',
      })
      .then((outcome) => this.gains.track(itemId, outcome))
      .catch((error: unknown) => {
        if (this.saveErrorShown) return;
        this.saveErrorShown = true;
        this.toast.error(`No se pudo guardar tu progreso. ${toAppError(error).message}`);
      });
  }

  protected onFinished(answers: readonly QuizAnswer[]): void {
    this.answers.set(answers);
    this.phase.set('results');
  }

  private async load(setId: string): Promise<void> {
    this.status.set('loading');
    this.phase.set('setup');
    try {
      const { set, items } = await this.material.load(setId);
      this.set.set(set);
      items.forEach((item) => this.recorder.remember(item.id, item.learning));
      this.items.set(items.map(({ id, term, translation }) => ({ id, term, translation })));
      this.title.setTitle(`Cuestionario · ${set.name} · English Learning`);
      this.status.set('ready');
    } catch (error) {
      const appError = toAppError(error);
      this.error.set(appError.message);
      this.status.set(appError.kind === 'not-found' ? 'not-found' : 'error');
    }
  }
}

/** Una tilde de menos no es un fallo de memoria: cuenta como «La sabía». */
export function quizGrade(answer: QuizAnswer): AttemptGrade {
  return answer.outcome === 'incorrect' ? 'again' : 'good';
}

/** Reconocer entre opciones y escribir la traducción tienen pesos distintos. */
export function quizKind(answer: QuizAnswer): AttemptKind {
  return answer.question.type === 'multiple-choice' ? 'multiple_choice' : 'written';
}
