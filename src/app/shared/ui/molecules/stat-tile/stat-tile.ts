import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, IconName } from '../../atoms/icon/icon';

export type StatTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

/** Indicador numérico con etiqueta, explicación breve y acción opcional (contenido proyectado). */
@Component({
  selector: 'app-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '[attr.data-tone]': 'tone()', '[attr.data-layout]': 'layout()' },
  styleUrl: './stat-tile.scss',
  template: `
    <div class="top">
      <span class="icon"><app-icon [name]="icon()" [size]="20" /></span>
      <p class="label">{{ label() }}</p>
    </div>
    <p class="value">{{ value() }}</p>
    @if (caption(); as text) {
      <p class="caption">{{ text }}</p>
    }
    <ng-content />
  `,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly caption = input<string | null>(null);
  readonly icon = input.required<IconName>();
  readonly tone = input<StatTone>('primary');
  readonly layout = input<'stacked' | 'row'>('stacked');
}
