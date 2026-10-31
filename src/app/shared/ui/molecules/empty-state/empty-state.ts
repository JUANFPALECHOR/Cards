import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon, IconName } from '../../atoms/icon/icon';

/** Estado vacío o de error: explica qué ocurre y ofrece la siguiente acción (contenido proyectado). */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '[attr.data-tone]': 'tone()' },
  styles: `
    :host {
      --empty-icon-bg: var(--color-primary-soft);
      --empty-icon-fg: var(--color-on-primary-soft);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-12) var(--space-6);
      text-align: center;
      background: var(--color-surface);
      border: 1px dashed var(--color-border-strong);
      border-radius: var(--radius-xl);
    }
    :host([data-tone='danger']) {
      --empty-icon-bg: var(--color-danger-soft);
      --empty-icon-fg: var(--color-on-danger-soft);
      border-style: solid;
    }
    :host([data-tone='success']) {
      --empty-icon-bg: var(--color-success-soft);
      --empty-icon-fg: var(--color-on-success-soft);
    }
    .icon {
      display: grid;
      place-items: center;
      width: 3.5rem;
      height: 3.5rem;
      margin-bottom: var(--space-1);
      color: var(--empty-icon-fg);
      background: var(--empty-icon-bg);
      border-radius: var(--radius-lg);
    }
    .title {
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-semibold);
      line-height: var(--line-height-snug);
      text-wrap: balance;
    }
    .description {
      max-width: 40ch;
      color: var(--color-text-muted);
    }
    .actions:not(:empty) {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--space-3);
      margin-top: var(--space-2);
    }
  `,
  template: `
    <span class="icon"><app-icon [name]="icon()" [size]="26" /></span>
    @if (level() === 2) {
      <h2 class="title">{{ title() }}</h2>
    } @else {
      <h3 class="title">{{ title() }}</h3>
    }
    @if (description(); as text) {
      <p class="description">{{ text }}</p>
    }
    <div class="actions"><ng-content /></div>
  `,
})
export class EmptyState {
  readonly icon = input<IconName>('info');
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly tone = input<'primary' | 'danger' | 'success'>('primary');
  /** Nivel del encabezado según la jerarquía de la página. */
  readonly level = input<2 | 3>(2);
}
