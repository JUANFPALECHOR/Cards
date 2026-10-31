import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  StudyDirection,
  answerOf,
  languagesOf,
  promptOf,
} from '../../../../core/models/study-direction';
import { Badge } from '../../../../shared/ui/atoms/badge/badge';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { ProgressBar } from '../../../../shared/ui/molecules/progress-bar/progress-bar';
import { AttemptGrade } from '../../../spaced-repetition/domain/learning-state';
import {
  SessionSummary,
  StudySession,
  answerCurrent,
  currentEntry,
  isFinished,
  startSession,
  summarize,
} from '../../domain/study-session';
import { StudyCard } from '../../models/study-card';
import { Flashcard } from '../flashcard/flashcard';

export interface CardAnswer {
  readonly card: StudyCard;
  readonly grade: AttemptGrade;
}

const LANGUAGE_LABELS = { en: 'Inglés', es: 'Español' } as const;

const GRADE_KEYS: Record<string, AttemptGrade | undefined> = {
  '1': 'again',
  ArrowLeft: 'again',
  '2': 'hard',
  ArrowDown: 'hard',
  '3': 'good',
  ArrowRight: 'good',
};

/**
 * Sesión de flashcards: muestra la tarjeta actual, la autoevaluación y el avance.
 * Girar la tarjeta no cuenta como acierto: hay que elegir «No la sabía», «Me costó» o «La sabía».
 * No persiste nada: emite cada primer intento (`answered`) y el resumen final (`finished`).
 *
 * Teclado: Espacio/Enter gira · 1 o ← = No la sabía · 2 o ↓ = Me costó · 3 o → = La sabía.
 */
@Component({
  selector: 'app-flashcard-session',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge, Button, Icon, ProgressBar, Flashcard],
  host: { '(document:keydown)': 'onKeydown($event)' },
  styleUrl: './flashcard-session.scss',
  templateUrl: './flashcard-session.html',
})
export class FlashcardSession {
  readonly cards = input.required<readonly StudyCard[]>();
  readonly direction = input.required<StudyDirection>();
  /** Muestra el conjunto de origen en cada tarjeta (Repasar mezcla conjuntos). */
  readonly showSetName = input(false, { transform: booleanAttribute });

  readonly answered = output<CardAnswer>();
  readonly finished = output<SessionSummary>();

  private readonly injector = inject(Injector);
  private readonly cardRef = viewChild(Flashcard);

  protected readonly session = signal<StudySession<StudyCard>>(startSession([]));
  protected readonly flipped = signal(false);
  protected readonly instant = signal(false);

  protected readonly entry = computed(() => currentEntry(this.session()));
  /** Se usa como lista de un elemento para recrear la tarjeta (siempre por su cara frontal). */
  protected readonly current = computed(() => {
    const entry = this.entry();
    return entry ? [{ key: this.session().position, entry }] : [];
  });
  protected readonly position = computed(() => this.session().position);
  protected readonly total = computed(() => this.session().entries.length);
  protected readonly languages = computed(() => languagesOf(this.direction()));
  protected readonly labels = computed(() => ({
    prompt: LANGUAGE_LABELS[this.languages().prompt],
    answer: LANGUAGE_LABELS[this.languages().answer],
  }));

  constructor() {
    effect(() => {
      const cards = this.cards();
      untracked(() => {
        this.session.set(startSession(cards));
        this.flipped.set(false);
      });
    });
  }

  protected promptOf(card: StudyCard): string {
    return promptOf(card, this.direction());
  }

  protected answerOf(card: StudyCard): string {
    return answerOf(card, this.direction());
  }

  protected toggle(fromKeyboard: boolean): void {
    this.instant.set(fromKeyboard);
    this.flipped.update((value) => !value);
  }

  protected reveal(event: MouseEvent): void {
    this.instant.set(event.detail === 0);
    this.flipped.set(true);
    this.focusCard();
  }

  protected answer(grade: AttemptGrade): void {
    const entry = this.entry();
    if (!entry || !this.flipped()) return;

    if (!entry.retry) {
      this.answered.emit({ card: entry.card, grade });
    }

    const next = answerCurrent(this.session(), grade);
    this.session.set(next);
    this.flipped.set(false);
    this.instant.set(false);

    if (isFinished(next)) {
      this.finished.emit(summarize(next.results));
    } else {
      this.focusCard();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, dialog[open]')) return;

    const isActivation = event.key === ' ' || event.key === 'Enter';
    // Sobre un botón o enlace, Espacio/Enter ya los activa el navegador.
    if (isActivation && target?.closest('button, a')) return;

    if (isActivation) {
      event.preventDefault();
      this.toggle(true);
      return;
    }
    const grade = this.flipped() ? GRADE_KEYS[event.key] : undefined;
    if (grade) {
      event.preventDefault();
      this.answer(grade);
    }
  }

  private focusCard(): void {
    afterNextRender(() => this.cardRef()?.focus(), { injector: this.injector });
  }
}
