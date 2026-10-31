import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeTone =
  'neutral' | 'primary' | 'accent' | 'success' | 'danger' | 'warning' | 'info';

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-tone]': 'tone()' },
  styles: `
    :host {
      --badge-bg: var(--color-surface-sunken);
      --badge-fg: var(--color-text-muted);
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      min-height: 1.5rem;
      padding: 0 var(--space-2);
      font-size: var(--font-size-xs);
      font-weight: var(--font-weight-semibold);
      line-height: 1;
      white-space: nowrap;
      color: var(--badge-fg);
      background: var(--badge-bg);
      border-radius: var(--radius-full);
    }
    :host([data-tone='primary']) {
      --badge-bg: var(--color-primary-soft);
      --badge-fg: var(--color-on-primary-soft);
    }
    :host([data-tone='accent']) {
      --badge-bg: var(--color-accent-soft);
      --badge-fg: var(--color-on-accent-soft);
    }
    :host([data-tone='success']) {
      --badge-bg: var(--color-success-soft);
      --badge-fg: var(--color-on-success-soft);
    }
    :host([data-tone='danger']) {
      --badge-bg: var(--color-danger-soft);
      --badge-fg: var(--color-on-danger-soft);
    }
    :host([data-tone='warning']) {
      --badge-bg: var(--color-warning-soft);
      --badge-fg: var(--color-on-warning-soft);
    }
    :host([data-tone='info']) {
      --badge-bg: var(--color-info-soft);
      --badge-fg: var(--color-on-info-soft);
    }
  `,
  template: `<ng-content />`,
})
export class Badge {
  readonly tone = input<BadgeTone>('neutral');
}
