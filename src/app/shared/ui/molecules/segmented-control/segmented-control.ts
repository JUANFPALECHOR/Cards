import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { Icon, IconName } from '../../atoms/icon/icon';

export interface SegmentOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
  readonly icon?: IconName;
  readonly tone?: 'primary' | 'success' | 'neutral';
}

let nextId = 0;

/**
 * Selección única entre pocas opciones. Usa radios nativos dentro de un fieldset:
 * flechas del teclado, lectores de pantalla y formularios funcionan sin código extra.
 */
@Component({
  selector: 'app-segmented-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '[attr.data-appearance]': 'appearance()' },
  styleUrl: './segmented-control.scss',
  template: `
    <fieldset>
      <legend class="legend">{{ legend() }}</legend>
      <div class="options">
        @for (option of options(); track option.value) {
          <label
            class="option"
            [class.is-selected]="option.value === value()"
            [class.is-disabled]="option.disabled"
          >
            <input
              type="radio"
              class="sr-only"
              [name]="name"
              [value]="option.value"
              [checked]="option.value === value()"
              [disabled]="!!option.disabled"
              (change)="value.set(option.value)"
            />
            @if (appearance() === 'cards' && option.icon) {
              <span class="option-icon" [attr.data-tone]="option.tone ?? 'primary'">
                <app-icon [name]="option.icon" [size]="22" />
              </span>
            }
            <span class="option-copy">
              <span class="option-label">{{ option.label }}</span>
              @if (option.description; as description) {
                <span class="option-description">{{ description }}</span>
              }
            </span>
            @if (appearance() === 'cards') {
              <span class="radio-indicator" aria-hidden="true"></span>
            }
          </label>
        }
      </div>
    </fieldset>
  `,
})
export class SegmentedControl<T extends string> {
  readonly legend = input.required<string>();
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly value = model.required<T>();
  readonly appearance = input<'default' | 'cards'>('default');

  protected readonly name = `segmented-${++nextId}`;
}
