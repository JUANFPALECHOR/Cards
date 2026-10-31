import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DIRECTION_LABELS } from '../../../../core/models/study-direction';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import { InputControl } from '../../../../shared/ui/atoms/input/input';
import { FormField } from '../../../../shared/ui/molecules/form-field/form-field';
import {
  SegmentOption,
  SegmentedControl,
} from '../../../../shared/ui/molecules/segmented-control/segmented-control';
import {
  MAX_OPTIONS,
  canUseMultipleChoice,
  distinctAnswerCount,
} from '../../domain/quiz-generator';
import { QuizConfig, QuizDirectionOption, QuizItem, QuizTypeOption } from '../../models/quiz';

const DEFAULT_COUNT = 10;

/** Configuración previa del cuestionario: tipo, dirección y cantidad de preguntas. */
@Component({
  selector: 'app-quiz-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon, InputControl, FormField, SegmentedControl],
  styleUrl: './quiz-setup.scss',
  templateUrl: './quiz-setup.html',
})
export class QuizSetup {
  readonly items = input.required<readonly QuizItem[]>();
  /** Configuración inicial (p. ej. la del cuestionario anterior). */
  readonly initial = input<QuizConfig | null>(null);
  readonly start = output<QuizConfig>();

  protected readonly type = signal<QuizTypeOption>('multiple-choice');
  protected readonly direction = signal<QuizDirectionOption>('en_es');
  protected readonly countText = signal(String(DEFAULT_COUNT));
  protected readonly submitted = signal(false);

  protected readonly max = computed(() => this.items().length);
  protected readonly multipleChoiceAvailable = computed(() =>
    canUseMultipleChoice(this.items(), this.direction()),
  );
  protected readonly fewOptions = computed(() => {
    const directions =
      this.direction() === 'both'
        ? (['en_es', 'es_en'] as const)
        : [this.direction() as 'en_es' | 'es_en'];
    return directions.some((dir) => distinctAnswerCount(this.items(), dir) < MAX_OPTIONS);
  });

  protected readonly typeOptions = computed<readonly SegmentOption<QuizTypeOption>[]>(() => [
    {
      value: 'multiple-choice',
      label: 'Selección múltiple',
      description: 'Elige entre opciones',
      disabled: !this.multipleChoiceAvailable(),
    },
    { value: 'written', label: 'Respuesta escrita', description: 'Escribe la traducción' },
    {
      value: 'mixed',
      label: 'Mixto',
      description: 'Ambos tipos',
      disabled: !this.multipleChoiceAvailable(),
    },
  ]);

  protected readonly directionOptions: readonly SegmentOption<QuizDirectionOption>[] = [
    { value: 'en_es', label: DIRECTION_LABELS.en_es },
    { value: 'es_en', label: DIRECTION_LABELS.es_en },
    { value: 'both', label: 'Ambas direcciones' },
  ];

  protected readonly countError = computed(() => {
    const text = this.countText().trim();
    const value = Number(text);
    if (!text || !Number.isInteger(value)) return 'Escribe un número entero.';
    if (value < 1 || value > this.max()) return `Elige entre 1 y ${this.max()} preguntas.`;
    return null;
  });

  constructor() {
    effect(() => {
      const initial = this.initial();
      const max = this.max();
      untracked(() => {
        if (initial) {
          this.type.set(initial.type);
          this.direction.set(initial.direction);
        }
        this.setCount(Math.min(initial?.count ?? DEFAULT_COUNT, max));
      });
    });

    // Si la selección múltiple deja de ser posible en la dirección elegida, se pasa a escrita.
    effect(() => {
      if (!this.multipleChoiceAvailable() && untracked(this.type) !== 'written') {
        this.type.set('written');
      }
    });
  }

  protected onCountInput(event: Event): void {
    this.countText.set((event.target as HTMLInputElement).value);
  }

  protected useAll(): void {
    this.setCount(this.max());
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (this.countError()) return;
    this.start.emit({
      type: this.type(),
      direction: this.direction(),
      count: Number(this.countText()),
    });
  }

  private setCount(value: number): void {
    this.countText.set(String(value));
  }
}
