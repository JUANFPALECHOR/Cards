import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Bloque de carga. Decorativo: el contenedor que carga debe anunciar el estado (aria-busy). */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.border-radius]': 'radius()',
  },
  styles: `
    :host {
      display: block;
      background: var(--color-border);
      animation: pulse 1.4s ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
      }
    }
    @keyframes pulse {
      50% {
        opacity: 0.5;
      }
    }
  `,
  template: ``,
})
export class Skeleton {
  readonly width = input('100%');
  readonly height = input('1rem');
  readonly radius = input('var(--radius-sm)');
}
