import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FORM_FIELD_CONTEXT, FormFieldContext, InputControl } from '../../atoms/input/input';
import { Icon } from '../../atoms/icon/icon';
import { IconButton } from '../../atoms/icon-button/icon-button';

let nextId = 0;

/** Buscador con etiqueta accesible (oculta visualmente) y botón para limpiar. */
@Component({
  selector: 'app-search-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, IconButton, InputControl],
  providers: [{ provide: FORM_FIELD_CONTEXT, useExisting: SearchField }],
  styleUrl: './search-field.scss',
  template: `
    <label class="sr-only" [for]="controlId">{{ label() }}</label>
    <app-icon class="search-icon" name="search" [size]="18" />
    <input
      #control
      appInput
      type="search"
      autocomplete="off"
      enterkeyhint="search"
      [placeholder]="placeholder()"
      [value]="value()"
      (input)="onInput($event)"
      (keydown.escape)="clear()"
    />
    @if (value()) {
      <button appIconButton class="clear" size="sm" label="Limpiar búsqueda" (click)="clear()">
        <app-icon name="close" [size]="16" />
      </button>
    }
  `,
})
export class SearchField implements FormFieldContext {
  readonly label = input.required<string>();
  readonly placeholder = input('Buscar…');
  readonly value = model('');

  readonly controlId = `search-${++nextId}`;
  readonly describedBy = signal<string | null>(null).asReadonly();
  readonly invalid = computed(() => false);
  readonly required = computed(() => false);

  private readonly control = viewChild.required<ElementRef<HTMLInputElement>>('control');

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected clear(): void {
    this.value.set('');
    this.control().nativeElement.focus();
  }
}
