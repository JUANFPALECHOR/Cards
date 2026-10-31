import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  model,
  output,
} from '@angular/core';
import { DIRECTION_LABELS, StudyDirection } from '../../../../core/models/study-direction';
import { Button } from '../../../../shared/ui/atoms/button/button';
import { Icon } from '../../../../shared/ui/atoms/icon/icon';
import {
  SegmentOption,
  SegmentedControl,
} from '../../../../shared/ui/molecules/segmented-control/segmented-control';
import { pluralize } from '../../../../shared/utils/text';

/** Configuración previa de una sesión de flashcards: dirección y resumen de lo que se va a estudiar. */
@Component({
  selector: 'app-study-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Icon, SegmentedControl],
  host: { '[attr.data-appearance]': 'appearance()' },
  styleUrl: './study-setup.scss',
  template: `
    <app-segmented-control
      legend="Dirección de estudio"
      [appearance]="appearance() === 'plain' ? 'cards' : 'default'"
      [options]="directionOptions"
      [(value)]="direction"
    />
    <p class="info">
      <app-icon name="cards" [size]="18" />
      <span>
        {{ cardLabel() }} {{ ordered() ? 'por orden de prioridad' : 'en orden aleatorio' }}. Las que
        no sepas se repetirán al final.
      </span>
    </p>
    <ng-content />
    <button appButton size="lg" type="button" (click)="start.emit()">
      @if (ordered()) {
        <app-icon name="play" [size]="22" />
      }
      {{ ordered() ? 'Empezar repaso' : 'Empezar' }}
    </button>
  `,
})
export class StudySetup {
  readonly cardCount = input.required<number>();
  /** Las tarjetas llegan ordenadas por prioridad (Repasar) en lugar de barajadas. */
  readonly ordered = input(false, { transform: booleanAttribute });
  readonly direction = model.required<StudyDirection>();
  readonly start = output<void>();
  readonly appearance = input<'panel' | 'plain'>('panel');

  protected readonly directionOptions: readonly SegmentOption<StudyDirection>[] = [
    {
      value: 'en_es',
      label: DIRECTION_LABELS.en_es,
      description: 'Ves la palabra en inglés',
      icon: 'languages',
    },
    {
      value: 'es_en',
      label: DIRECTION_LABELS.es_en,
      description: 'Ves la traducción en español',
      icon: 'repeat',
      tone: 'neutral',
    },
  ];

  protected readonly cardLabel = computed(() => pluralize(this.cardCount(), 'tarjeta', 'tarjetas'));
}
