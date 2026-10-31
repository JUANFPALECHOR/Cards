import { Directive, HostAttributeToken, InjectionToken, Signal, inject } from '@angular/core';

/**
 * Contexto que aporta un contenedor de campo (FormField, SearchField) al control que envuelve:
 * id para el <label>, descripciones y estado de validación.
 */
export interface FormFieldContext {
  readonly controlId: string;
  readonly describedBy: Signal<string | null>;
  readonly invalid: Signal<boolean>;
  readonly required: Signal<boolean>;
}

export const FORM_FIELD_CONTEXT = new InjectionToken<FormFieldContext>('FORM_FIELD_CONTEXT');

/** Átomo de campo de texto. Los estilos viven en shared/styles/_controls.scss. */
@Directive({
  selector: 'input[appInput], textarea[appInput], select[appInput]',
  host: {
    class: 'input',
    '[attr.id]': 'field?.controlId ?? ownId',
    '[attr.aria-describedby]': 'field?.describedBy()',
    '[attr.aria-invalid]': 'field?.invalid() ? "true" : null',
    '[attr.aria-required]': 'field?.required() ? "true" : null',
  },
})
export class InputControl {
  protected readonly field = inject(FORM_FIELD_CONTEXT, { optional: true });
  /** Respeta un id estático cuando el control se usa fuera de un contenedor de campo. */
  protected readonly ownId = inject(new HostAttributeToken('id'), { optional: true });
}
