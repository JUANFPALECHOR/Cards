import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Indicador de carga. Con `label` se anuncia a lectores de pantalla;
 * sin él es decorativo (p. ej. dentro de un botón con aria-busy).
 */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.role]': 'label() ? "status" : null',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[style.--spinner-size]': 'size() + "px"',
  },
  styleUrl: './spinner.scss',
  template: `
    <svg viewBox="0 0 24 24" fill="none" focusable="false">
      <circle class="track" cx="12" cy="12" r="9.5" stroke-width="3" />
      <circle class="arc" cx="12" cy="12" r="9.5" stroke-width="3" pathLength="100" />
    </svg>
    @if (label(); as text) {
      <span class="sr-only">{{ text }}</span>
    }
  `,
})
export class Spinner {
  readonly size = input(20);
  readonly label = input<string | null>(null);
}
