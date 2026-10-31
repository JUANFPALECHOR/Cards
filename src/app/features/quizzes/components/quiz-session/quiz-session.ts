import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { languagesOf } from '../../../../core/models/study-direction';
import { Badge } from '../../../../shared/ui/atoms/badge/badge';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { InputControl } from '../../../../shared/ui/atoms/input/input';
import { FormField } from '../../../../shared/ui/molecules/form-field/form-field';
import { ProgressBar } from '../../../../shared/ui/molecules/progress-bar/progress-bar';
import { gradeAnswer } from '../../domain/quiz-generator';
import { QuizAnswer, QuizQuestion } from '../../models/quiz';

type OptionState = 'correct' | 'wrong' | 'dimmed' | null;

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Desarrollo del cuestionario: una pregunta a la vez, con validación inmediata.
 * Emite cada respuesta (`answered`) y la lista completa al terminar (`finished`).
 * Teclado: 1–4 eligen una opción; Enter avanza tras ver la corrección.
 */
@Component({
  selector: 'app-quiz-session',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge, Button, Icon, InputControl, FormField, ProgressBar],
  host: { '(document:keydown)': 'onKeydown($event)' },
  styleUrl: './quiz-session.scss',
  templateUrl: './quiz-session.html',
})
export class QuizSession {
  readonly questions = input.required<readonly QuizQuestion[]>();
  readonly answered = output<QuizAnswer>();
  readonly finished = output<readonly QuizAnswer[]>();

  private readonly injector = inject(Injector);
  private readonly promptRef = viewChild<ElementRef<HTMLElement>>('prompt');
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('answerInput');
  // #nextButton está sobre un componente (appButton): se lee el elemento DOM, no la instancia.
  private readonly nextRef = viewChild<string, ElementRef<HTMLButtonElement>>('nextButton', {
    read: ElementRef,
  });

  protected readonly letters = LETTERS;
  protected readonly index = signal(0);
  protected readonly answers = signal<readonly QuizAnswer[]>([]);
  protected readonly feedback = signal<QuizAnswer | null>(null);
  protected readonly written = signal('');
  protected readonly writtenError = signal<string | null>(null);

  protected readonly total = computed(() => this.questions().length);
  protected readonly question = computed(() => this.questions()[this.index()] ?? null);
  /** Lista de un elemento: recrea la pregunta para reiniciar foco y estado visual. */
  protected readonly current = computed(() => {
    const question = this.question();
    return question ? [question] : [];
  });
  protected readonly isLast = computed(() => this.index() >= this.total() - 1);
  protected readonly languages = computed(() => {
    const question = this.question();
    return question ? languagesOf(question.direction) : { prompt: 'en', answer: 'es' };
  });

  constructor() {
    effect(() => {
      this.questions();
      untracked(() => {
        this.index.set(0);
        this.answers.set([]);
        this.resetQuestion();
      });
    });
  }

  protected optionState(option: string): OptionState {
    const feedback = this.feedback();
    if (!feedback) return null;
    if (option === feedback.question.answer) return 'correct';
    if (option === feedback.given) return 'wrong';
    return 'dimmed';
  }

  protected choose(option: string): void {
    const question = this.question();
    if (!question || this.feedback()) return;
    this.record(gradeAnswer(question, option));
  }

  protected onWrittenInput(event: Event): void {
    this.written.set((event.target as HTMLInputElement).value);
    this.writtenError.set(null);
  }

  protected submitWritten(event: Event): void {
    event.preventDefault();
    const question = this.question();
    if (!question || this.feedback()) return;
    if (!this.written().trim()) {
      this.writtenError.set('Escribe tu respuesta antes de comprobar.');
      return;
    }
    this.record(gradeAnswer(question, this.written()));
  }

  protected next(): void {
    if (!this.feedback()) return;
    if (this.isLast()) {
      this.finished.emit(this.answers());
      return;
    }
    this.index.update((index) => index + 1);
    this.resetQuestion();
    afterNextRender(
      () => {
        const question = this.question();
        if (question?.type === 'written') {
          this.inputRef()?.nativeElement.focus();
        } else {
          this.promptRef()?.nativeElement.focus();
        }
      },
      { injector: this.injector },
    );
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const question = this.question();
    if (!question || question.type !== 'multiple-choice' || this.feedback()) return;
    if ((event.target as HTMLElement | null)?.closest('input, textarea, dialog[open]')) return;

    const option = question.options?.[Number(event.key) - 1];
    if (option !== undefined) {
      event.preventDefault();
      this.choose(option);
    }
  }

  private record(answer: QuizAnswer): void {
    this.feedback.set(answer);
    this.answers.update((answers) => [...answers, answer]);
    this.answered.emit(answer);
    afterNextRender(() => this.nextRef()?.nativeElement.focus(), { injector: this.injector });
  }

  private resetQuestion(): void {
    this.feedback.set(null);
    this.written.set('');
    this.writtenError.set(null);
  }
}
