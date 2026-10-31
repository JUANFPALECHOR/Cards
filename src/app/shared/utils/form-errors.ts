import { AbstractControl, ValidationErrors } from '@angular/forms';

/** Obligatorio que además rechaza texto formado solo por espacios. */
export function requiredText(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  return typeof value === 'string' && value.trim().length > 0 ? null : { required: true };
}

/**
 * Mensaje del primer error del control, solo cuando conviene mostrarlo:
 * tras salir del campo (touched) o tras intentar enviar el formulario.
 */
export function controlErrorMessage(
  control: AbstractControl,
  submitted: boolean,
  messages: Readonly<Record<string, string>>,
): string | null {
  if (control.valid || !(control.touched || submitted)) return null;
  const key = Object.keys(messages).find((name) => control.hasError(name));
  return key ? messages[key] : null;
}
