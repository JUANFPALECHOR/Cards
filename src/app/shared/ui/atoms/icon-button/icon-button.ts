import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Botón cuadrado que solo contiene un icono. `label` es obligatorio: es su nombre accesible.
 * Uso: <button appIconButton label="Cerrar"><app-icon name="close" /></button>
 */
@Component({
  selector: 'button[appIconButton]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    '[attr.aria-label]': 'label()',
    '[attr.data-size]': 'size()',
  },
  styleUrl: './icon-button.scss',
  template: `<ng-content />`,
})
export class IconButton {
  readonly label = input.required<string>();
  readonly size = input<'sm' | 'md'>('md');
}
