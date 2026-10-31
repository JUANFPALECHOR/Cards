import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InputControl } from '../../atoms/input/input';
import { FormField } from './form-field';

@Component({
  imports: [FormField, InputControl],
  template: `
    <app-form-field label="Nombre" [hint]="hint()" [error]="error()" required>
      <input appInput />
    </app-form-field>
  `,
})
class Host {
  readonly hint = signal<string | null>('Máximo 100 caracteres');
  readonly error = signal<string | null>(null);
}

describe('FormField', () => {
  function setup() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      label: element.querySelector('label')!,
      input: element.querySelector('input')!,
      element,
    };
  }

  it('enlaza la etiqueta con el control', () => {
    const { label, input } = setup();

    expect(input.id).toBeTruthy();
    expect(label.getAttribute('for')).toBe(input.id);
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('describe el control con la ayuda cuando no hay error', () => {
    const { input, element } = setup();
    const hintId = input.getAttribute('aria-describedby');

    expect(element.querySelector(`#${hintId}`)?.textContent).toContain('Máximo 100 caracteres');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('marca el control como inválido y lo describe con el error', async () => {
    const { fixture, input, element } = setup();

    fixture.componentInstance.error.set('El nombre es obligatorio.');
    await fixture.whenStable();

    const errorId = input.getAttribute('aria-describedby');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector(`#${errorId}`)?.textContent).toContain(
      'El nombre es obligatorio.',
    );
  });
});
