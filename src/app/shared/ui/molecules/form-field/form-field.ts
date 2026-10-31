import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { FORM_FIELD_CONTEXT, FormFieldContext } from '../../atoms/input/input';
import { Icon } from '../../atoms/icon/icon';

let nextId = 0;

/**
 * Etiqueta + control + ayuda + error, enlazados para lectores de pantalla.
 * El mensaje de error lo decide la página (p. ej. a partir del estado del FormControl).
 *
 * <app-form-field label="Nombre" [error]="nameError()" required>
 *   <input appInput formControlName="name" />
 * </app-form-field>
 */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  providers: [{ provide: FORM_FIELD_CONTEXT, useExisting: FormField }],
  styleUrl: './form-field.scss',
  template: `
    <label class="label" [for]="controlId">
      {{ label() }}
      @if (required()) {
        <span class="required" aria-hidden="true">*</span>
      }
    </label>
    <ng-content />
    @if (error(); as message) {
      <p class="message error" [id]="errorId">
        <app-icon name="alert" [size]="16" />
        {{ message }}
      </p>
    } @else if (hint(); as text) {
      <p class="message hint" [id]="hintId">{{ text }}</p>
    }
  `,
})
export class FormField implements FormFieldContext {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly required = input(false, { transform: booleanAttribute });

  readonly controlId = `field-${++nextId}`;
  protected readonly hintId = `${this.controlId}-hint`;
  protected readonly errorId = `${this.controlId}-error`;

  readonly invalid = computed(() => !!this.error());
  readonly describedBy = computed(() =>
    this.error() ? this.errorId : this.hint() ? this.hintId : null,
  );
}
